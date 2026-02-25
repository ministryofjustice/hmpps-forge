import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import RegistrationTraverser from '@form-engine/core/compilation/traversers/RegistrationTraverser'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { NodeCompilationPipeline } from '@form-engine/core/compilation/NodeCompilationPipeline'
import { FormInstanceDependencies, NodeId } from '@form-engine/core/types/engine.type'
import { CompilationDependencies } from '@form-engine/core/compilation/CompilationDependencies'
import { NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'

export type StepIndex = Map<NodeId, StepASTNode>

export interface SharedCompiledForm {
  rootNode: JourneyASTNode
  sharedDependencies: CompilationDependencies
  stepIndex: StepIndex
}

/**
 * FormCompilationFactory - Compiles journey definitions into per-step artefacts
 *
 * Each artefact contains:
 * - Full AST with all nodes
 * - Dependency graph for evaluation ordering
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

    // Phase 2 - Normalize AST nodes
    NodeCompilationPipeline.normalize(rootNode, sharedDependencies, NodeIDCategory.COMPILE_AST)

    // Phase 3 - Register nodes
    new RegistrationTraverser(sharedDependencies.nodeRegistry).register(rootNode)

    // Phase 4 - Set parent metadata
    NodeCompilationPipeline.setParentMetadata(rootNode, sharedDependencies)

    // Phase 5 - Wire static dependencies
    NodeCompilationPipeline.wireStaticDependencies(sharedDependencies)

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

    // Phase 8 - Wire step-scope dependencies (pseudo nodes and onLoad transitions)
    NodeCompilationPipeline.wireStepScopeDependencies(compilationDependencies)

    // Phase 9 - Compile thunk handlers
    NodeCompilationPipeline.compileThunks(compilationDependencies, this.formInstanceDependencies.functionRegistry)

    return {
      artefact: compilationDependencies,
      currentStepId: stepNode.id,
    }
  }
}

export type CompiledForm = ReturnType<FormCompilationFactory['compile']>
export type CompiledStep = ReturnType<FormCompilationFactory['compileStep']>
export type CompilationArtefact = CompiledStep['artefact']
