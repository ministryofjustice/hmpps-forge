import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { NodeCompilationPipeline } from '@form-engine/core/compilation/NodeCompilationPipeline'
import NodeRegistrationWalker from '@form-engine/core/compilation/traversers/NodeRegistrationWalker'
import { AstNodeId, FormInstanceDependencies, NodeId } from '@form-engine/core/types/engine.type'
import { CompilationDependencies } from '@form-engine/core/compilation/CompilationDependencies'
import { NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import StepRuntimePlanBuilder, { StepRuntimePlan } from '@form-engine/core/compilation/StepRuntimePlanBuilder'

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
 * FormCompilationFactory - Compiles journey definitions into per-step artefacts
 *
 * Each artefact contains:
 * - Full AST with all nodes
 * - Compiled thunk handlers
 */
export default class FormCompilationFactory {
  constructor(private readonly formInstanceDependencies: FormInstanceDependencies) {}

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

    const runtimePlan = new StepRuntimePlanBuilder().build(stepNode, compilationDependencies)

    // Phase 9 - Compile thunk handlers
    NodeCompilationPipeline.compileThunks(compilationDependencies, this.formInstanceDependencies.functionRegistry)

    return {
      artefact: compilationDependencies,
      currentStepId: stepNode.id,
      runtimePlan,
    }
  }
}

export type CompiledForm = ReturnType<FormCompilationFactory['compile']>
export type CompilationArtefact = CompiledStep['artefact']
