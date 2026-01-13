import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import RegistrationTraverser from '@form-engine/core/compilation/traversers/RegistrationTraverser'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { NodeCompilationPipeline } from '@form-engine/core/compilation/NodeCompilationPipeline'
import { FormInstanceDependencies } from '@form-engine/core/types/engine.type'
import { CompilationDependencies } from '@form-engine/core/compilation/CompilationDependencies'

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
   * Main entry point - compile a journey definition into per-step artefacts
   */
  compile(journeyDef: JourneyDefinition) {
    const compilationDependencies = new CompilationDependencies()

    // Phase 1 - Transform JourneyDefinition into AST nodes
    const rootNode = NodeCompilationPipeline.transform(journeyDef, compilationDependencies) as JourneyASTNode

    // Phase 2 - Normalize AST nodes
    NodeCompilationPipeline.normalize(rootNode, compilationDependencies)

    // Phase 3 - Register nodes
    new RegistrationTraverser(compilationDependencies.nodeRegistry).register(rootNode)

    // Phase 4 - Set parent metadata
    NodeCompilationPipeline.setParentMetadata(rootNode, compilationDependencies)

    // Phase 5 - Wire static dependencies
    NodeCompilationPipeline.wireStaticDependencies(compilationDependencies)

    // Compile artefact for each step using overlays
    return compilationDependencies.nodeRegistry.findByType<StepASTNode>(ASTNodeType.STEP).map(stepNode => {
      const { deps: overlayDeps } = compilationDependencies.createOverlay()

      return this.compileForStep(rootNode, stepNode, overlayDeps)
    })
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
export type CompilationArtefact = ReturnType<FormCompilationFactory['compileForStep']>['artefact']
