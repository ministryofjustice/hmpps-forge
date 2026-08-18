import type { ASTNode, NodeId } from '../../contracts/ast/ast.type'
import { ASTNodeType } from '../../contracts/ast/enums'
import type { JourneyASTNode, StepASTNode } from '../../contracts/ast/structures.type'
import type { FieldModel } from '../../contracts/models/fieldModel.type'
import type { CompilationModel, JourneyModel, StepModel } from '../../contracts/models/compilationModel.type'
import type { RouteMetadataModel } from '../../../concerns/route/contracts/routeMetadataModel.type'
import type ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import type { AnalysisRegistries, JourneyAnalysisContext, StepAnalysisContext } from './concernAnalyzers.type'
import Ancestry from './shared/Ancestry'
import AuthoredValueClassifier from './shared/AuthoredValueClassifier'
import FieldModelBuilder from './shared/FieldModelBuilder'
import NodeLabeller from './shared/NodeLabeller'
import OwnershipIndex from './shared/OwnershipIndex'
import MountInfoAnalyzer from './shared/MountInfoAnalyzer'
import ReachabilityAnalyzer from '../../../concerns/reachability/analysis/ReachabilityAnalyzer'
import AnswerCleardownAnalyzer from '../../../concerns/answer-cleardown/analysis/AnswerCleardownAnalyzer'
import AnswerPreparationAnalyzer from '../../../concerns/answer-preparation/analysis/AnswerPreparationAnalyzer'
import HookAnalyzer from '../../../concerns/hooks/analysis/HookAnalyzer'
import ValidationAnalyzer from '../../../concerns/validation/analysis/ValidationAnalyzer'
import ResolveAnalyzer from '../../../concerns/resolve/analysis/ResolveAnalyzer'
import RouteAnalyzer from '../../../concerns/route/analysis/RouteAnalyzer'
import ForgeInternalError from '../../../errors/ForgeInternalError'

type StepIndex = Map<NodeId, StepASTNode>

export default class CompilationModelBuilder {
  private readonly ancestry = new Ancestry()

  private readonly classifier = new AuthoredValueClassifier()

  private readonly labels = new NodeLabeller()

  private readonly ownershipIndex: OwnershipIndex

  private readonly fieldModelBuilder: FieldModelBuilder

  private readonly mountInfoAnalyzer: MountInfoAnalyzer

  private readonly reachabilityAnalyzer = new ReachabilityAnalyzer()

  private readonly answerCleardownAnalyzer = new AnswerCleardownAnalyzer()

  private readonly answerPreparationAnalyzer = new AnswerPreparationAnalyzer()

  private readonly hookAnalyzer = new HookAnalyzer()

  private readonly validationAnalyzer = new ValidationAnalyzer()

  private readonly resolveAnalyzer = new ResolveAnalyzer()

  private readonly routeAnalyzer = new RouteAnalyzer()

  constructor(
    nodeIndex: ASTNodeIndex,
    private readonly registries: AnalysisRegistries,
  ) {
    this.ownershipIndex = new OwnershipIndex(nodeIndex, this.ancestry)
    this.fieldModelBuilder = new FieldModelBuilder(registries.componentRegistry)
    this.mountInfoAnalyzer = new MountInfoAnalyzer(this.ancestry)
  }

  build(stepIndex: StepIndex): CompilationModel {
    const routeMetadata = new Map<NodeId, RouteMetadataModel>()
    const journeys = new Map<NodeId, JourneyModel>()
    const stepFields = this.buildStepFields(stepIndex)

    stepIndex.forEach((stepNode, stepId) => {
      if (!this.isJourneyNode(stepNode.parent)) {
        throw new ForgeInternalError(`Step "${stepId}" was not registered under a journey`)
      }
    })

    // One walk covers every journey — including container-only journeys that
    // have no steps — so route metadata is collected in the same pass and steps
    // stay in document order (which the reachability state table depends on).
    this.ownershipIndex.journeys().forEach(({ journeyNode, stepNodes }) => {
      const journeyContext = this.createJourneyContext(journeyNode, stepNodes, stepFields)

      journeys.set(journeyNode.id, this.buildJourneyModel(journeyContext, stepFields))
      routeMetadata.set(journeyNode.id, this.routeAnalyzer.analyzeJourney(journeyContext))
      stepNodes.forEach(stepNode => {
        routeMetadata.set(stepNode.id, this.routeAnalyzer.analyzeStep(this.createStepContext(stepNode, stepFields)))
      })
    })

    return { routeMetadata, journeys }
  }

  private buildStepFields(stepIndex: StepIndex): Map<NodeId, readonly FieldModel[]> {
    const stepFields = new Map<NodeId, readonly FieldModel[]>()

    ;[...stepIndex.keys()].forEach(stepId => {
      stepFields.set(
        stepId,
        this.fieldModelBuilder.buildStepFields(
          this.ownershipIndex.fieldBlocksOf(stepId),
          this.ownershipIndex.mapIterateNodesOf(stepId),
        ),
      )
    })

    return stepFields
  }

  private buildJourneyModel(
    context: JourneyAnalysisContext,
    stepFields: Map<NodeId, readonly FieldModel[]>,
  ): JourneyModel {
    const steps = new Map<NodeId, StepModel>()

    context.stepNodes.forEach(stepNode => {
      steps.set(stepNode.id, this.buildStepModel(stepNode, stepFields))
    })

    const reachability = this.reachabilityAnalyzer.analyzeJourney(context)

    return {
      journeyId: context.journeyNode.id,
      label: reachability.label,
      mountInfo: this.mountInfoAnalyzer.buildJourneyMountInfo(context.journeyNode),
      staticData: this.mountInfoAnalyzer.resolveStaticData(context.journeyNode),
      hooks: this.hookAnalyzer.analyzeJourney(context),
      reachability,
      cleardown: this.answerCleardownAnalyzer.analyzeJourney(context),
      answerPreparation: this.answerPreparationAnalyzer.analyzeJourney(context),
      steps,
    }
  }

  private buildStepModel(stepNode: StepASTNode, stepFields: Map<NodeId, readonly FieldModel[]>): StepModel {
    const context = this.createStepContext(stepNode, stepFields)

    return {
      stepId: stepNode.id,
      label: this.labels.labelFrom([stepNode]),
      mountInfo: this.mountInfoAnalyzer.buildStepMountInfo(stepNode),
      staticData: this.mountInfoAnalyzer.resolveStaticData(stepNode),
      fields: context.fields,
      answerPreparation: this.answerPreparationAnalyzer.analyzeStep(context),
      hooks: this.hookAnalyzer.analyzeStep(context),
      validation: this.validationAnalyzer.analyzeStep(context),
      resolve: this.resolveAnalyzer.analyzeStep(context),
    }
  }

  private createStepContext(
    stepNode: StepASTNode,
    stepFields: Map<NodeId, readonly FieldModel[]>,
  ): StepAnalysisContext {
    return {
      stepNode,
      ownership: this.ownershipIndex,
      ancestry: this.ancestry,
      registries: this.registries,
      classifier: this.classifier,
      fields: stepFields.get(stepNode.id) ?? [],
      labels: this.labels,
    }
  }

  private createJourneyContext(
    journeyNode: JourneyASTNode,
    stepNodes: readonly StepASTNode[],
    stepFields: Map<NodeId, readonly FieldModel[]>,
  ): JourneyAnalysisContext {
    return {
      journeyNode,
      stepNodes,
      ownership: this.ownershipIndex,
      ancestry: this.ancestry,
      registries: this.registries,
      classifier: this.classifier,
      labels: this.labels,
      stepFields,
    }
  }

  private isJourneyNode(node: ASTNode | undefined): node is JourneyASTNode {
    return node?.type === ASTNodeType.JOURNEY
  }
}
