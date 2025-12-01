import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import RegistrationTraverser from '@form-engine/core/ast/registration/RegistrationTraverser'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { NodeCompilationPipeline } from '@form-engine/core/ast/compilation/NodeCompilationPipeline'
import { FormInstanceDependencies } from '@form-engine/core/types/engine.type'
import { findRelevantNodes } from '@form-engine/core/ast/utils/findRelevantNodes'
import { CompilationDependencies } from '@form-engine/core/ast/compilation/CompilationDependencies'

/**
 * FormCompilationFactory - Compiles journey definitions into per-step artefacts
 *
 * Each artefact contains:
 * - Unified AST with smart filtering (full rendering for current step, metadata for others)
 * - Dependency graph for evaluation ordering
 * - Compiled thunk handlers
 *
 * Compilation phases:
 * 1. Transform - Convert JourneyDefinition into AST nodes
 * 2. Normalize - Apply normalizers to standardize AST structure
 * 3. Register - Register all nodes in the registry
 * 4. Metadata - Set compile-time metadata for current step scope
 * 5. Pseudo-nodes - Create answer/data pseudo-nodes
 * 6. Filter - Select relevant nodes for this step's artefact
 * 7. Wire - Build dependency graph
 * 8. Compile - Generate thunk handlers
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

    // Compile artefact for each step
    return compilationDependencies.nodeRegistry.findByType<StepASTNode>(ASTNodeType.STEP)
      .map(stepNode => this.compileForStep(rootNode, stepNode, compilationDependencies.clone()))
  }

  /**
   * Compile artefact for a specific step
   */
  private compileForStep(
    rootNode: JourneyASTNode,
    stepNode: StepASTNode,
    compilationDependencies: CompilationDependencies,
  ) {
    // Phase 4 - Setup step scope metadata
    NodeCompilationPipeline.setCompileTimeMetadata(rootNode, stepNode, compilationDependencies)

    // Phase 5 - Add pseudo-nodes
    NodeCompilationPipeline.createPseudoNodes(compilationDependencies)

    // Phase 6 - Filter to relevant nodes for this step
    const specialisedNodeRegistry = new NodeRegistry()

    findRelevantNodes(rootNode, compilationDependencies.nodeRegistry, compilationDependencies.metadataRegistry).forEach(
      node => specialisedNodeRegistry.register(node.id, node),
    )

    const artefact = new CompilationDependencies(
      compilationDependencies.nodeIdGenerator,
      compilationDependencies.nodeFactory,
      compilationDependencies.pseudoNodeFactory,
      specialisedNodeRegistry,
      compilationDependencies.metadataRegistry,
    )

    // Phase 7 - Wire dependency graph
    NodeCompilationPipeline.wireDependencies(artefact)

    // Phase 8 - Compile thunk handlers
    NodeCompilationPipeline.compileThunks(artefact)

    return {
      artefact,
      currentStepId: stepNode.id,
    }
  }
}

export type CompiledForm = ReturnType<FormCompilationFactory['compile']>
export type CompilationArtefact = ReturnType<FormCompilationFactory['compileForStep']>['artefact']
