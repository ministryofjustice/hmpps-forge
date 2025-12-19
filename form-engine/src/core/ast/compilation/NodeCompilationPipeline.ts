import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import PseudoNodeTraverser from '@form-engine/core/ast/registration/PseudoNodeTraverser'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'
import { MetadataTraverser } from '@form-engine/core/ast/registration/MetadataTraverser'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { AddSelfValueToFieldsNormalizer } from '@form-engine/core/ast/normalizers/AddSelfValueToFields'
import { ConvertFormattersToPipelineNormalizer } from '@form-engine/core/ast/normalizers/ConvertFormattersToPipeline'
import { ResolveSelfReferencesNormalizer } from '@form-engine/core/ast/normalizers/ResolveSelfReferences'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import StructuralWiring from '@form-engine/core/ast/dependencies/wiring/structural/StructuralWiring'
import OnSubmitTransitionWiring from '@form-engine/core/ast/dependencies/wiring/transitions/OnSubmitTransitionWiring'
import OnActionTransitionWiring from '@form-engine/core/ast/dependencies/wiring/transitions/OnActionTransitionWiring'
import AnswerPseudoNodeWiring from '@form-engine/core/ast/dependencies/wiring/pseudo-nodes/AnswerPseudoNodeWiring'
import DataPseudoNodeWiring from '@form-engine/core/ast/dependencies/wiring/pseudo-nodes/DataPseudoNodeWiring'
import QueryPseudoNodeWiring from '@form-engine/core/ast/dependencies/wiring/pseudo-nodes/QueryPseudoNodeWiring'
import ParamsPseudoNodeWiring from '@form-engine/core/ast/dependencies/wiring/pseudo-nodes/ParamsPseudoNodeWiring'
import PostPseudoNodeWiring from '@form-engine/core/ast/dependencies/wiring/pseudo-nodes/PostPseudoNodeWiring'
import ConditionalExpressionWiring from '@form-engine/core/ast/dependencies/wiring/expressions/ConditionalExpressionWiring'
import ReferenceExpressionWiring from '@form-engine/core/ast/dependencies/wiring/expressions/ReferenceExpressionWiring'
import LogicExpressionWiring from '@form-engine/core/ast/dependencies/wiring/expressions/LogicExpressionWiring'
import PipelineExpressionWiring from '@form-engine/core/ast/dependencies/wiring/expressions/PipelineExpressionWiring'
import FunctionExpressionWiring from '@form-engine/core/ast/dependencies/wiring/expressions/FunctionExpressionWiring'
import ValidationExpressionWiring from '@form-engine/core/ast/dependencies/wiring/expressions/ValidationExpressionWiring'
import NextExpressionWiring from '@form-engine/core/ast/dependencies/wiring/expressions/NextExpressionWiring'
import FormatExpressionWiring from '@form-engine/core/ast/dependencies/wiring/expressions/FormatExpressionWiring'
import CollectionExpressionWiring from '@form-engine/core/ast/dependencies/wiring/expressions/CollectionExpressionWiring'
import IterateExpressionWiring from '@form-engine/core/ast/dependencies/wiring/expressions/IterateExpressionWiring'
import { CompilationDependencies } from '@form-engine/core/ast/compilation/CompilationDependencies'
import { NodeIDCategory } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import OnLoadTransitionWiring from '@form-engine/core/ast/dependencies/wiring/transitions/OnLoadTransitionWiring'
import ThunkCompilerFactory from '@form-engine/core/ast/thunks/factories/ThunkCompilerFactory'

/**
 * NodeCompilationPipeline - Reusable compilation phases for AST nodes
 *
 * Encapsulates the compilation pipeline phases (normalization, pseudo node creation,
 * dependency wiring) so they can be reused for both:
 * - Compile-time: Full tree compilation in FormCompilationFactory
 * - Runtime: Subset compilation for dynamically created nodes
 *
 * This ensures runtime nodes go through the same compilation pipeline as
 * compile-time nodes, maintaining consistency.
 */
export class NodeCompilationPipeline {
  static transform(json: any, compilationDependencies: CompilationDependencies) {
    return compilationDependencies.nodeFactory.createNode(json)
  }

  /**
   * Phase 2: Normalize nodes
   *
   * Runs all normalizers on the provided nodes. Normalizers modify nodes in-place.
   * Can operate on full tree (compile-time) or subset of nodes (runtime).
   *
   * Normalizers applied:
   * 1. AddSelfValueToFieldsNormalizer - Adds Self() references to field blocks
   * 2. AttachValidationBlockCodeNormalizer - Attaches field codes to validation expressions
   * 3. ConvertFormattersToPipelineNormalizer - Converts formatters arrays to Pipeline expressions
   * 4. ResolveSelfReferencesNormalizer - Resolves Self() references to actual field codes
   *
   * @param nodes - Root node(s) to normalize. Can be single node or array.
   * @param compilationDependencies
   * @param idCategory
   */
  static normalize(
    nodes: ASTNode | ASTNode[],
    compilationDependencies: CompilationDependencies,
    idCategory: NodeIDCategory.COMPILE_AST | NodeIDCategory.RUNTIME_AST = NodeIDCategory.COMPILE_AST,
  ): void {
    const nodesToNormalize = Array.isArray(nodes) ? nodes : [nodes]

    // Create normalizers
    const normalizers = [
      new AddSelfValueToFieldsNormalizer(compilationDependencies.nodeFactory),
      new ConvertFormattersToPipelineNormalizer(compilationDependencies.nodeIdGenerator, idCategory),
      new ResolveSelfReferencesNormalizer(compilationDependencies.nodeIdGenerator, idCategory),
    ]

    // Run each normalizer on each node
    // Normalizers use structuralTraverse internally to walk the tree
    nodesToNormalize.forEach(node => {
      normalizers.forEach(normalizer => {
        normalizer.normalize(node)
      })
    })
  }

  /**
   * Phase 4A: Set compile-time metadata via MetadataTraverser
   *
   * Marks nodes with step-relevant metadata:
   * - isDescendantOfStep: true for step node and all its descendants
   * - isAncestorOfStep: true for parent journeys
   * - attachedToParentNode: NodeId of parent
   * - attachedToParentProperty: Property key on parent
   *
   * @param rootNode - Root journey node to traverse from
   * @param stepNode - Target step node to mark
   * @param compilationDependencies
   */
  static setCompileTimeMetadata(
    rootNode: JourneyASTNode,
    stepNode: StepASTNode,
    compilationDependencies: CompilationDependencies,
  ): void {
    new MetadataTraverser(compilationDependencies.metadataRegistry).traverse(rootNode, stepNode)
  }

  /**
   * Phase 4B: Set metadata for runtime node
   *
   * @param node - Root node to traverse
   * @param compilationDependencies
   */
  static setRuntimeMetadata(node: ASTNode, compilationDependencies: CompilationDependencies): void {
    new MetadataTraverser(compilationDependencies.metadataRegistry).traverseSubtree(node)
  }

  /**
   * Phase 5: Create pseudo nodes for fields
   *
   * Scans the provided nodes and creates pseudo nodes for data sources:
   * - ANSWER_LOCAL: Field answers on current step
   * - ANSWER_REMOTE: Field answers from other steps
   * - POST: Raw form submission data
   * - QUERY: URL query parameters
   * - PARAMS: URL path parameters
   * - DATA: External data loaded via onLoad
   *
   * Pseudo nodes are automatically registered in the node registry.
   *
   * @param compilationDependencies
   */
  static createPseudoNodes(compilationDependencies: CompilationDependencies): void {
    // Create pseudo nodes by scanning the entire registry
    new PseudoNodeTraverser(
      compilationDependencies.nodeRegistry,
      compilationDependencies.pseudoNodeFactory,
      compilationDependencies.metadataRegistry,
    ).createPseudoNodes()
  }

  /**
   * Phase 6: Wire dependency graph
   *
   * Creates dependency edges between nodes based on their relationships.
   * Wirers scan the node registry and add edges to the graph.
   *
   * Edge types created:
   * - STRUCTURAL: Parent-child hierarchy
   * - DATA_FLOW: Data dependencies (expressions, fields)
   * - CONTROL_FLOW: Conditional logic
   * - EFFECT_FLOW: Effect/transition sequencing
   *
   * @param compilationDependencies
   * @param nodeIds - Optional: If provided, only wire the specified nodes (scoped wiring for runtime nodes)
   */
  static wireDependencies(compilationDependencies: CompilationDependencies, nodeIds?: NodeId[]): void {
    const wiringContext = new WiringContext(
      compilationDependencies.nodeRegistry,
      compilationDependencies.metadataRegistry,
      compilationDependencies.dependencyGraph,
    )

    if (nodeIds) {
      // Scoped wiring - only process specified nodes with bidirectional wiring
      new StructuralWiring(wiringContext).wireNodes(nodeIds)

      // Wire lifecycle transitions (entry = onLoad + onAccess, action = onAction, exit = onSubmit)
      new OnLoadTransitionWiring(wiringContext).wireNodes(nodeIds)
      new OnActionTransitionWiring(wiringContext).wireNodes(nodeIds)
      new OnSubmitTransitionWiring(wiringContext).wireNodes(nodeIds)

      // Wire pseudo nodes
      new AnswerPseudoNodeWiring(wiringContext).wireNodes(nodeIds)
      new DataPseudoNodeWiring(wiringContext).wireNodes(nodeIds)
      new QueryPseudoNodeWiring(wiringContext).wireNodes(nodeIds)
      new ParamsPseudoNodeWiring(wiringContext).wireNodes(nodeIds)
      new PostPseudoNodeWiring(wiringContext).wireNodes(nodeIds)

      // Wire expression nodes
      new ConditionalExpressionWiring(wiringContext).wireNodes(nodeIds)
      new LogicExpressionWiring(wiringContext).wireNodes(nodeIds)
      new ReferenceExpressionWiring(wiringContext).wireNodes(nodeIds)
      new PipelineExpressionWiring(wiringContext).wireNodes(nodeIds)
      new FunctionExpressionWiring(wiringContext).wireNodes(nodeIds)
      new ValidationExpressionWiring(wiringContext).wireNodes(nodeIds)
      new NextExpressionWiring(wiringContext).wireNodes(nodeIds)
      new FormatExpressionWiring(wiringContext).wireNodes(nodeIds)
      new CollectionExpressionWiring(wiringContext).wireNodes(nodeIds)
      new IterateExpressionWiring(wiringContext).wireNodes(nodeIds)
    } else {
      // Full wiring - existing behavior for compile-time
      new StructuralWiring(wiringContext).wire()

      // Wire lifecycle transitions (entry = onLoad + onAccess, action = onAction, exit = onSubmit)
      new OnLoadTransitionWiring(wiringContext).wire()
      new OnActionTransitionWiring(wiringContext).wire()
      new OnSubmitTransitionWiring(wiringContext).wire()

      // Wire pseudo nodes
      new AnswerPseudoNodeWiring(wiringContext).wire()
      new DataPseudoNodeWiring(wiringContext).wire()
      new QueryPseudoNodeWiring(wiringContext).wire()
      new ParamsPseudoNodeWiring(wiringContext).wire()
      new PostPseudoNodeWiring(wiringContext).wire()

      // Wire expression nodes
      new ConditionalExpressionWiring(wiringContext).wire()
      new LogicExpressionWiring(wiringContext).wire()
      new ReferenceExpressionWiring(wiringContext).wire()
      new PipelineExpressionWiring(wiringContext).wire()
      new FunctionExpressionWiring(wiringContext).wire()
      new ValidationExpressionWiring(wiringContext).wire()
      new NextExpressionWiring(wiringContext).wire()
      new FormatExpressionWiring(wiringContext).wire()
      new CollectionExpressionWiring(wiringContext).wire()
      new IterateExpressionWiring(wiringContext).wire()
    }
  }

  /**
   * Phase 7: Compile thunk handlers
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
