import type { JourneyDefinition } from '../../authoring/types/structures.type'
import { JourneyASTNode, StepASTNode } from '../types/structures.type'
import { ASTNodeType } from '../types/enums'
import { NodeCompilationPipeline } from './NodeCompilationPipeline'
import NodeRegistrationWalker from './traversers/NodeRegistrationWalker'
import { AstNodeId, JourneyInstanceDependencies, NodeId } from '../types/engine.type'
import { CompilationDependencies } from './CompilationDependencies'
import { NodeIDCategory } from './id-generators/NodeIDGenerator'
import RuntimePlanBuilder, { JourneyRuntimePlan, StepRuntimePlan, ReachabilityRuntimePlan } from './RuntimePlanBuilder'

export type StepIndex = Map<NodeId, StepASTNode>

export type JourneyIndex = Map<NodeId, JourneyASTNode>

export interface SharedCompiledForm {
  rootNode: JourneyASTNode
  sharedDependencies: CompilationDependencies
  stepIndex: StepIndex
  journeyIndex: JourneyIndex
  reachabilityPlans: Map<NodeId, ReachabilityRuntimePlan>
  journeyRuntimePlans: Map<NodeId, JourneyRuntimePlan>
  planBuilder: RuntimePlanBuilder
}

export interface CompiledStep {
  artefact: CompilationDependencies
  currentStepId: AstNodeId
  runtimePlan: StepRuntimePlan
  reachabilityPlan: ReachabilityRuntimePlan
}

/**
 * CompilationFactory - Compiles journey definitions into per-step artefacts
 *
 * Each artefact contains:
 * - Full AST with all nodes
 * - Compiled thunk handlers
 */
export default class CompilationFactory {
  constructor(private readonly journeyInstanceDependencies: JourneyInstanceDependencies) {}

  /**
   * Compile shared artefacts that are invariant across steps.
   */
  compileShared(journeyDef: JourneyDefinition): SharedCompiledForm {
    const sharedDependencies = new CompilationDependencies()

    // Phase 1 - Transform JourneyDefinition into AST nodes
    const rootNode = NodeCompilationPipeline.transform(journeyDef, sharedDependencies) as JourneyASTNode

    // Phase 2-4 - Normalize, register, and set parent metadata in a single pass
    const walker = new NodeRegistrationWalker(
      sharedDependencies.nodeIdGenerator,
      NodeIDCategory.COMPILE_AST,
      sharedDependencies.nodeRegistry,
      sharedDependencies.nodeFactory,
      sharedDependencies.metadataRegistry,
      false,
      sharedDependencies.astNodeTree,
    )

    walker.register(rootNode)

    const stepNodes = sharedDependencies.nodeRegistry.findByType<StepASTNode>(ASTNodeType.STEP)
    const stepIndex: StepIndex = new Map(stepNodes.map(stepNode => [stepNode.id, stepNode]))

    const journeyNodes = sharedDependencies.nodeRegistry.findByType<JourneyASTNode>(ASTNodeType.JOURNEY)
    const journeyIndex: JourneyIndex = new Map(journeyNodes.map(journeyNode => [journeyNode.id, journeyNode]))

    const planBuilder = new RuntimePlanBuilder(
      sharedDependencies.nodeRegistry,
      sharedDependencies.metadataRegistry,
      sharedDependencies.astNodeTree,
    )

    const { reachabilityPlansByStepId: reachabilityPlans, journeyRuntimePlans } = planBuilder.buildAllPlans(
      stepIndex,
      journeyIndex,
    )

    return {
      rootNode,
      sharedDependencies,
      stepIndex,
      journeyIndex,
      reachabilityPlans,
      journeyRuntimePlans,
      planBuilder,
    }
  }

  /**
   * Compile a journey-level artefact with thunk handlers but no step-scope metadata.
   */
  compileJourney(shared: SharedCompiledForm): CompilationArtefact {
    const { deps: overlayDeps } = shared.sharedDependencies.createOverlay()

    NodeCompilationPipeline.createPseudoNodes(overlayDeps)
    NodeCompilationPipeline.compileThunks(overlayDeps, this.journeyInstanceDependencies.functionRegistry)

    return overlayDeps
  }

  /**
   * Compile a single step artefact from shared compilation output.
   */
  compileStep(shared: SharedCompiledForm, stepId: NodeId) {
    const stepNode = shared.stepIndex.get(stepId)

    if (!stepNode) {
      throw new Error(`Unable to compile step "${stepId}" - step not found in shared step index`)
    }

    const { deps: overlayDeps } = shared.sharedDependencies.createOverlay()

    return this.compileForStep(shared.planBuilder, shared.rootNode, stepNode, overlayDeps)
  }

  /**
   * Compile artefact for a specific step
   */
  private compileForStep(
    planBuilder: RuntimePlanBuilder,
    rootNode: JourneyASTNode,
    stepNode: StepASTNode,
    compilationDependencies: CompilationDependencies,
  ) {
    // Phase 6 - Set step-scope metadata (isCurrentStep, isDescendantOfStep, isAncestorOfStep)
    NodeCompilationPipeline.setStepScopeMetadata(rootNode, stepNode, compilationDependencies)

    // Phase 7 - Add pseudo-nodes
    NodeCompilationPipeline.createPseudoNodes(compilationDependencies)

    // Phase 9 - Compile thunk handlers
    NodeCompilationPipeline.compileThunks(compilationDependencies, this.journeyInstanceDependencies.functionRegistry)

    const runtimePlan = planBuilder.buildStepRuntimePlan(stepNode)

    return {
      artefact: compilationDependencies,
      currentStepId: stepNode.id,
      runtimePlan,
    }
  }
}

export type CompiledForm = CompiledStep[]
export type CompilationArtefact = CompiledStep['artefact']
