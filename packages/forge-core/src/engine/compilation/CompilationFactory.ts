import type { JourneyDefinition } from '../../authoring/types/structures.type'
import { JourneyASTNode, StepASTNode } from '../types/structures.type'
import { ASTNodeType } from '../types/enums'
import { NodeCompilationPipeline } from './NodeCompilationPipeline'
import NodeRegistrationWalker from './traversers/NodeRegistrationWalker'
import { AstNodeId, JourneyInstanceDependencies, NodeId } from '../types/engine.type'
import { CompilationDependencies } from './CompilationDependencies'
import { NodeIDCategory } from './id-generators/NodeIDGenerator'
import StepRuntimePlanBuilder, { StepRuntimePlan } from './StepRuntimePlanBuilder'

export type StepIndex = Map<NodeId, StepASTNode>

export interface SharedCompiledForm {
  rootNode: JourneyASTNode
  sharedDependencies: CompilationDependencies
  stepIndex: StepIndex
}

export interface CompiledStep {
  artefact: CompilationDependencies
  currentStepId: AstNodeId
  runtimePlan: StepRuntimePlan
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
   * Main entry point - eager compatibility wrapper for per-step artefacts
   */
  compile(journeyDef: JourneyDefinition) {
    const shared = this.compileShared(journeyDef)

    return [...shared.stepIndex.keys()].map(stepId => this.compileStep(shared, stepId))
  }

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

    return {
      rootNode,
      sharedDependencies,
      stepIndex: new Map(stepNodes.map(stepNode => [stepNode.id, stepNode])),
    }
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

    return this.compileForStep(shared.rootNode, stepNode, overlayDeps)
  }

  /**
   * Compile artefact for a specific step
   */
  private compileForStep(
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

    const runtimePlan = new StepRuntimePlanBuilder().build(stepNode, compilationDependencies)

    return {
      artefact: compilationDependencies,
      currentStepId: stepNode.id,
      runtimePlan,
    }
  }
}

export type CompiledForm = ReturnType<CompilationFactory['compile']>
export type CompilationArtefact = CompiledStep['artefact']
