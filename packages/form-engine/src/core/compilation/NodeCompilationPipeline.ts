import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import NodeRegistry from '@form-engine/core/compilation/registries/NodeRegistry'
import MetadataRegistry from '@form-engine/core/compilation/registries/MetadataRegistry'
import PseudoNodeCreator from '@form-engine/core/compilation/traversers/PseudoNodeCreator'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'
import { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { BlockType, ExpressionType } from '@form-engine/form/types/enums'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { CompilationDependencies } from '@form-engine/core/compilation/CompilationDependencies'
import ThunkCompilerFactory from '@form-engine/core/compilation/thunks/ThunkCompilerFactory'

/**
 * NodeCompilationPipeline - Reusable compilation phases for AST nodes
 *
 * Encapsulates the compilation pipeline phases (normalization, pseudo node creation)
 * so they can be reused for both:
 * - Compile-time: Full tree compilation in FormCompilationFactory
 * - Runtime: Subset compilation for dynamically created nodes
 *
 * This ensures runtime nodes go through the same compilation pipeline as
 * compile-time nodes, maintaining consistency.
 */
export class NodeCompilationPipeline {
  /**
   * Compile Phase 1: Transform JSON into AST nodes
   */
  static transform(json: any, compilationDependencies: CompilationDependencies) {
    return compilationDependencies.nodeFactory.createNode(json)
  }

  /**
   * Compile Phase 6: Set step-scope metadata (isCurrentStep, isDescendantOfStep, isAncestorOfStep)
   *
   * Walks UP from the step node via attachedToParentNode metadata to mark ancestors,
   * then walks DOWN through the step subtree to mark descendants.
   */
  static setStepScopeMetadata(
    _rootNode: JourneyASTNode,
    stepNode: StepASTNode,
    compilationDependencies: CompilationDependencies,
  ): void {
    const { metadataRegistry } = compilationDependencies

    // Mark the step node itself
    metadataRegistry.set(stepNode.id, 'isCurrentStep', true)
    metadataRegistry.set(stepNode.id, 'isAncestorOfStep', true)
    metadataRegistry.set(stepNode.id, 'isDescendantOfStep', true)

    // Walk UP: Mark all ancestors as isAncestorOfStep
    let currentId = metadataRegistry.get<NodeId>(stepNode.id, 'attachedToParentNode')

    while (currentId) {
      metadataRegistry.set(currentId, 'isAncestorOfStep', true)
      currentId = metadataRegistry.get<NodeId>(currentId, 'attachedToParentNode')
    }

    // Walk DOWN: Mark all descendants as isDescendantOfStep
    this.markDescendants(stepNode, metadataRegistry)
  }

  private static markDescendants(node: ASTNode, metadataRegistry: MetadataRegistry): void {
    if (!(node as any).properties) {
      return
    }

    Object.values((node as any).properties).forEach((value: unknown) => {
      this.walkDescendantValues(value, metadataRegistry)
    })
  }

  private static walkDescendantValues(value: unknown, metadataRegistry: MetadataRegistry): void {
    if (value === null || value === undefined || typeof value !== 'object') {
      return
    }

    if (Array.isArray(value)) {
      value.forEach(item => this.walkDescendantValues(item, metadataRegistry))

      return
    }

    if (isASTNode(value)) {
      metadataRegistry.set(value.id, 'isDescendantOfStep', true)
      this.markDescendants(value, metadataRegistry)

      return
    }

    Object.values(value).forEach(v => this.walkDescendantValues(v, metadataRegistry))
  }

  /**
   * Compile Phase 7 / Runtime Phase 5: Create pseudo nodes for fields
   *
   * Scans the provided nodes and creates pseudo nodes for data sources:
   * - ANSWER_LOCAL: Field answers on current step
   * - ANSWER_REMOTE: Field answers from other steps
   * - POST: Raw form submission data
   * - QUERY: URL query parameters
   * - PARAMS: URL path parameters
   * - REQUEST: Request metadata exposed via Request.*
   * - SESSION: Session data exposed via Session()
   * - DATA: External data loaded via onLoad
   *
   * Pseudo nodes are automatically registered in the node registry.
   *
   * @param compilationDependencies
   */
  static createPseudoNodes(compilationDependencies: CompilationDependencies, scanSource?: NodeRegistry): void {
    const registry = scanSource ?? compilationDependencies.nodeRegistry

    const creator = new PseudoNodeCreator(
      compilationDependencies.nodeRegistry,
      compilationDependencies.pseudoNodeFactory,
      compilationDependencies.metadataRegistry,
    )

    creator.createForFields(registry.findByType<FieldBlockASTNode>(BlockType.FIELD))
    creator.createForReferences(registry.findByType<ReferenceASTNode>(ExpressionType.REFERENCE))
  }

  /**
   * Compile Phase 9 / Runtime Phase 7: Compile thunk handlers
   *
   * Creates thunk handlers for all nodes in the registry.
   * Handlers are registered in the thunkHandlerRegistry for runtime evaluation.
   *
   * Pass 1: Creates all handlers
   * Pass 2: Computes isAsync metadata for hybrid handlers
   *
   * @param compilationDependencies - Contains all compilation artifacts
   * @param functionRegistry - Registry of user-defined functions (for async metadata)
   */
  static compileThunks(compilationDependencies: CompilationDependencies, functionRegistry: FunctionRegistry): void {
    new ThunkCompilerFactory().compile(compilationDependencies, functionRegistry)
  }
}
