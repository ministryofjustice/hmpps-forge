import type { ASTNode, NodeId } from '../../contracts/ast/ast.type'
import { ASTNodeType } from '../../contracts/ast/enums'
import type { JourneyASTNode, StepASTNode } from '../../contracts/ast/structures.type'
import type {
  CompilationPlan,
  JourneyCompilationInputs,
  ReachabilityCompilationInputs,
  RouteMetadataCompilationInputs,
  StepCompilationInputs,
} from '../../contracts/plans/compilationPlan.type'
import type { ReachabilityStateTable } from '../../contracts/plans/runtimePlans.type'
import type ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import FieldInventoryAnalyzer from './shared/FieldInventoryAnalyzer'
import RuntimePlanAnalyzer from './shared/RuntimePlanAnalyzer'
import ReachabilityPlanAnalyzer from '../../concerns/reachability/analysis/ReachabilityPlanAnalyzer'
import AnswerPreparationInputAnalyzer from '../../concerns/answer-preparation/analysis/AnswerPreparationInputAnalyzer'
import HookInputAnalyzer from '../../concerns/hooks/analysis/HookInputAnalyzer'
import ValidationInputAnalyzer from '../../concerns/validation/analysis/ValidationInputAnalyzer'
import ResolveInputAnalyzer from '../../concerns/resolve/analysis/ResolveInputAnalyzer'
import RouteMetadataInputAnalyzer from '../../concerns/route/analysis/RouteMetadataInputAnalyzer'
import ForgeInternalError from '../../errors/ForgeInternalError'

type StepIndex = Map<NodeId, StepASTNode>
type JourneyIndex = Map<NodeId, JourneyASTNode>

export default class CompilationPlanBuilder {
  private readonly runtimePlanAnalyzer: RuntimePlanAnalyzer

  private readonly reachabilityPlanAnalyzer: ReachabilityPlanAnalyzer

  private readonly answerPreparationInputAnalyzer: AnswerPreparationInputAnalyzer

  private readonly hookInputAnalyzer: HookInputAnalyzer

  private readonly validationInputAnalyzer: ValidationInputAnalyzer

  private readonly resolveInputAnalyzer: ResolveInputAnalyzer

  private readonly routeMetadataInputAnalyzer: RouteMetadataInputAnalyzer

  constructor(nodeRegistry: ASTNodeIndex) {
    const fieldInventoryAnalyzer = new FieldInventoryAnalyzer(nodeRegistry)

    this.runtimePlanAnalyzer = new RuntimePlanAnalyzer()
    this.reachabilityPlanAnalyzer = new ReachabilityPlanAnalyzer(fieldInventoryAnalyzer)
    this.answerPreparationInputAnalyzer = new AnswerPreparationInputAnalyzer(fieldInventoryAnalyzer)
    this.hookInputAnalyzer = new HookInputAnalyzer()
    this.validationInputAnalyzer = new ValidationInputAnalyzer(fieldInventoryAnalyzer)
    this.resolveInputAnalyzer = new ResolveInputAnalyzer(fieldInventoryAnalyzer)
    this.routeMetadataInputAnalyzer = new RouteMetadataInputAnalyzer()
  }

  buildPlan(stepIndex: StepIndex, journeyIndex: JourneyIndex): CompilationPlan {
    const journeyStepMap = new Map<NodeId, { journeyNode: JourneyASTNode; steps: StepASTNode[] }>()
    const stepInputs = new Map<NodeId, StepCompilationInputs>()
    const journeyInputs = new Map<NodeId, JourneyCompilationInputs>()
    const reachabilityInputs = new Map<NodeId, ReachabilityCompilationInputs>()
    const routeMetadataInputs = new Map<NodeId, RouteMetadataCompilationInputs>()

    stepIndex.forEach((stepNode, stepId) => {
      const parentJourney = stepNode.parent

      if (!this.isJourneyNode(parentJourney)) {
        throw new ForgeInternalError(`Step "${stepId}" was not registered under a journey`)
      }

      const parentJourneyId = parentJourney.id

      stepInputs.set(stepId, this.buildStepInputs(stepNode))

      const existingEntry = journeyStepMap.get(parentJourneyId) ?? {
        journeyNode: parentJourney,
        steps: [],
      }

      existingEntry.steps.push(stepNode)
      journeyStepMap.set(parentJourneyId, existingEntry)
    })

    journeyStepMap.forEach(({ journeyNode, steps }, journeyId) => {
      const reachabilityPlan = this.reachabilityPlanAnalyzer.buildReachabilityPlan(steps, journeyNode)

      reachabilityInputs.set(journeyId, {
        reachabilityId: journeyId,
        stateTable: reachabilityPlan.stateTable,
        reachabilityPlan,
        fieldInventorySources: this.reachabilityPlanAnalyzer.buildFieldInventorySources(reachabilityPlan),
      })

      journeyInputs.set(journeyId, this.buildJourneyInputs(journeyNode, reachabilityPlan.stateTable))
    })

    // Route metadata is a per-node concern, collected for every step and journey — including
    // container journeys with no direct steps, which the reachability loop above never visits.
    stepIndex.forEach(stepNode => {
      routeMetadataInputs.set(stepNode.id, this.routeMetadataInputAnalyzer.buildInputs(stepNode))
    })

    journeyIndex.forEach(journeyNode => {
      routeMetadataInputs.set(journeyNode.id, this.routeMetadataInputAnalyzer.buildInputs(journeyNode))
    })

    return {
      stepInputs,
      journeyInputs,
      reachabilityInputs,
      routeMetadataInputs,
    }
  }

  private buildStepInputs(stepNode: StepASTNode): StepCompilationInputs {
    return {
      core: {
        stepNode,
        runtimePlan: this.runtimePlanAnalyzer.buildStepRuntimePlan(stepNode),
        staticData: this.runtimePlanAnalyzer.resolveStaticData(stepNode),
      },
      answerPreparation: this.answerPreparationInputAnalyzer.buildInputs(stepNode),
      hooks: this.hookInputAnalyzer.buildInputs(stepNode),
      validation: this.validationInputAnalyzer.buildInputs(stepNode),
      resolve: this.resolveInputAnalyzer.buildInputs(stepNode),
    }
  }

  private buildJourneyInputs(
    journeyNode: JourneyASTNode,
    stateTable: ReachabilityStateTable,
  ): JourneyCompilationInputs {
    const stepIds = stateTable.entries.map(entry => entry.stepId)

    return {
      runtimePlan: this.runtimePlanAnalyzer.buildJourneyRuntimePlan(journeyNode),
      staticData: this.runtimePlanAnalyzer.resolveStaticData(journeyNode),
      ...this.answerPreparationInputAnalyzer.buildJourneyInputs(stepIds),
      accessHooks: this.hookInputAnalyzer.resolveAccessHooks(journeyNode),
    }
  }

  private isJourneyNode(node: ASTNode | undefined): node is JourneyASTNode {
    return node?.type === ASTNodeType.JOURNEY
  }
}
