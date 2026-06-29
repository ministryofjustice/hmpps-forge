import type { NodeId } from '../../contracts/ast/ast.type'
import type { JourneyASTNode, StepASTNode } from '../../contracts/ast/structures.type'
import type {
  CompilationPlan,
  JourneyCompilationInputs,
  NavigationCompilationInputs,
  StepCompilationInputs,
} from '../../contracts/plans/compilationPlan.type'
import type { ReachabilityStateTable } from '../../contracts/plans/runtimePlans.type'
import type ASTNodeTree from '../ast/ast-state/ASTNodeTree'
import type ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import FieldInventoryAnalyzer from './shared/FieldInventoryAnalyzer'
import RuntimePlanAnalyzer from './shared/RuntimePlanAnalyzer'
import ReachabilityPlanAnalyzer from './reachability/ReachabilityPlanAnalyzer'
import AnswerPreparationInputAnalyzer from './answer-preparation/AnswerPreparationInputAnalyzer'
import HookInputAnalyzer from './hooks/HookInputAnalyzer'
import ValidationInputAnalyzer from './validation/ValidationInputAnalyzer'
import ResolveInputAnalyzer from './resolve/ResolveInputAnalyzer'

type StepIndex = Map<NodeId, StepASTNode>
type JourneyIndex = Map<NodeId, JourneyASTNode>

export default class CompilationPlanBuilder {
  private readonly runtimePlanAnalyzer: RuntimePlanAnalyzer

  private readonly reachabilityPlanAnalyzer: ReachabilityPlanAnalyzer

  private readonly answerPreparationInputAnalyzer: AnswerPreparationInputAnalyzer

  private readonly hookInputAnalyzer: HookInputAnalyzer

  private readonly validationInputAnalyzer: ValidationInputAnalyzer

  private readonly resolveInputAnalyzer: ResolveInputAnalyzer

  constructor(nodeRegistry: ASTNodeIndex, astNodeTree: ASTNodeTree) {
    const fieldInventoryAnalyzer = new FieldInventoryAnalyzer(nodeRegistry, astNodeTree)

    this.runtimePlanAnalyzer = new RuntimePlanAnalyzer(nodeRegistry, astNodeTree)
    this.reachabilityPlanAnalyzer = new ReachabilityPlanAnalyzer(fieldInventoryAnalyzer, this.runtimePlanAnalyzer)
    this.answerPreparationInputAnalyzer = new AnswerPreparationInputAnalyzer(fieldInventoryAnalyzer)
    this.hookInputAnalyzer = new HookInputAnalyzer(nodeRegistry, astNodeTree)
    this.validationInputAnalyzer = new ValidationInputAnalyzer(fieldInventoryAnalyzer)
    this.resolveInputAnalyzer = new ResolveInputAnalyzer(nodeRegistry, astNodeTree, fieldInventoryAnalyzer)
  }

  buildPlan(stepIndex: StepIndex, journeyIndex: JourneyIndex): CompilationPlan {
    const journeyStepMap = new Map<NodeId, StepASTNode[]>()
    const stepInputs = new Map<NodeId, StepCompilationInputs>()
    const journeyInputs = new Map<NodeId, JourneyCompilationInputs>()
    const navigationInputs = new Map<NodeId, NavigationCompilationInputs>()

    stepIndex.forEach((stepNode, stepId) => {
      const ancestors = this.runtimePlanAnalyzer.resolveAncestorIds(stepId)
      const parentJourneyId = ancestors[ancestors.length - 2]

      if (!parentJourneyId) {
        return
      }

      stepInputs.set(stepId, this.buildStepInputs(stepNode, parentJourneyId))

      const existingJourneySteps = journeyStepMap.get(parentJourneyId) ?? []

      existingJourneySteps.push(stepNode)
      journeyStepMap.set(parentJourneyId, existingJourneySteps)
    })

    journeyStepMap.forEach((journeySteps, journeyId) => {
      const journeyNode = journeyIndex.get(journeyId)
      const reachabilityPlan = this.reachabilityPlanAnalyzer.buildReachabilityPlan(
        journeySteps,
        journeyNode,
        journeyIndex,
      )

      navigationInputs.set(journeyId, {
        navigationId: journeyId,
        stateTable: reachabilityPlan.stateTable,
        reachabilityPlan,
        fieldInventorySources: this.reachabilityPlanAnalyzer.buildFieldInventorySources(reachabilityPlan),
      })

      if (journeyNode) {
        journeyInputs.set(journeyId, this.buildJourneyInputs(journeyNode, reachabilityPlan.stateTable))
      }
    })

    return {
      stepInputs,
      journeyInputs,
      navigationInputs,
    }
  }

  private buildStepInputs(stepNode: StepASTNode, navigationId: NodeId): StepCompilationInputs {
    return {
      core: {
        stepNode,
        runtimePlan: this.runtimePlanAnalyzer.buildStepRuntimePlan(stepNode),
        staticData: this.runtimePlanAnalyzer.resolveStaticData(stepNode.id),
        navigationId,
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
      staticData: this.runtimePlanAnalyzer.resolveStaticData(journeyNode.id),
      ...this.answerPreparationInputAnalyzer.buildJourneyInputs(stepIds),
      accessHooks: this.hookInputAnalyzer.resolveAccessHooks(journeyNode.id),
    }
  }
}
