import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import PseudoNodeTraverser from '@form-engine/core/compilation/traversers/PseudoNodeTraverser'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'
import { MetadataTraverser } from '@form-engine/core/compilation/traversers/MetadataTraverser'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { AddSelfValueToFieldsNormalizer } from '@form-engine/core/compilation/normalizers/AddSelfValueToFields'
import { ResolveSelfReferencesNormalizer } from '@form-engine/core/compilation/normalizers/ResolveSelfReferences'
import { WiringContext } from '@form-engine/core/compilation/dependency-graph/WiringContext'
import StructuralWiring from '@form-engine/core/nodes/structures/StructuralWiring'
import SubmitWiring from '@form-engine/core/nodes/transitions/submit/SubmitWiring'
import ActionWiring from '@form-engine/core/nodes/transitions/action/ActionWiring'
import AccessWiring from '@form-engine/core/nodes/transitions/access/AccessWiring'
import AnswerLocalWiring from '@form-engine/core/nodes/pseudo-nodes/answer-local/AnswerLocalWiring'
import AnswerRemoteWiring from '@form-engine/core/nodes/pseudo-nodes/answer-remote/AnswerRemoteWiring'
import DataWiring from '@form-engine/core/nodes/pseudo-nodes/data/DataWiring'
import QueryWiring from '@form-engine/core/nodes/pseudo-nodes/query/QueryWiring'
import ParamsWiring from '@form-engine/core/nodes/pseudo-nodes/params/ParamsWiring'
import PostWiring from '@form-engine/core/nodes/pseudo-nodes/post/PostWiring'
import ConditionalWiring from '@form-engine/core/nodes/expressions/conditional/ConditionalWiring'
import ReferenceWiring from '@form-engine/core/nodes/expressions/reference/ReferenceWiring'
import AndWiring from '@form-engine/core/nodes/predicates/and/AndWiring'
import OrWiring from '@form-engine/core/nodes/predicates/or/OrWiring'
import XorWiring from '@form-engine/core/nodes/predicates/xor/XorWiring'
import NotWiring from '@form-engine/core/nodes/predicates/not/NotWiring'
import PipelineWiring from '@form-engine/core/nodes/expressions/pipeline/PipelineWiring'
import FunctionWiring from '@form-engine/core/nodes/expressions/function/FunctionWiring'
import ValidationWiring from '@form-engine/core/nodes/expressions/validation/ValidationWiring'
import NextWiring from '@form-engine/core/nodes/expressions/next/NextWiring'
import FormatWiring from '@form-engine/core/nodes/expressions/format/FormatWiring'
import IterateWiring from '@form-engine/core/nodes/expressions/iterate/IterateWiring'
import TestWiring from '@form-engine/core/nodes/predicates/test/TestWiring'
import { CompilationDependencies } from '@form-engine/core/compilation/CompilationDependencies'
import { NodeIDCategory } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import LoadWiring from '@form-engine/core/nodes/transitions/load/LoadWiring'
import ThunkCompilerFactory from '@form-engine/core/compilation/thunks/ThunkCompilerFactory'

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
  /**
   * Compile Phase 1: Transform JSON into AST nodes
   */
  static transform(json: any, compilationDependencies: CompilationDependencies) {
    return compilationDependencies.nodeFactory.createNode(json)
  }

  /**
   * Compile Phase 2 / Runtime Phase 1: Normalize nodes
   *
   * Runs all normalizers on the provided nodes. Normalizers modify nodes in-place.
   * Can operate on full tree (compile-time) or subset of nodes (runtime).
   *
   * Normalizers applied:
   * 1. AddSelfValueToFieldsNormalizer - Adds Self() references to field blocks
   * 2. ResolveSelfReferencesNormalizer - Resolves Self() references to actual field codes
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
   * Compile Phase 4: Set parent metadata via MetadataTraverser
   *
   * Marks nodes with parent attachment metadata:
   * - attachedToParentNode: NodeId of parent
   * - attachedToParentProperty: Property key on parent
   *
   * @param rootNode - Root journey node to traverse from
   * @param compilationDependencies
   */
  static setParentMetadata(rootNode: JourneyASTNode, compilationDependencies: CompilationDependencies): void {
    new MetadataTraverser(compilationDependencies.metadataRegistry).setParentMetadata(rootNode)
  }

  /**
   * Compile Phase 6: Set step-scope metadata (isCurrentStep, isDescendantOfStep, isAncestorOfStep)
   */
  static setStepScopeMetadata(
    rootNode: JourneyASTNode,
    stepNode: StepASTNode,
    compilationDependencies: CompilationDependencies,
  ): void {
    new MetadataTraverser(compilationDependencies.metadataRegistry).setStepScopeMetadata(rootNode, stepNode)
  }

  /**
   * Runtime Phase 3: Set metadata for runtime node
   *
   * @param node - Root node to traverse
   * @param compilationDependencies
   */
  static setRuntimeMetadata(node: ASTNode, compilationDependencies: CompilationDependencies): void {
    new MetadataTraverser(compilationDependencies.metadataRegistry).traverseSubtree(node)
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
   * Compile Phase 5: Wire static dependencies (call ONCE before per-step compilation)
   *
   * Wires AST node relationships that don't depend on step-scope metadata.
   * These edges are invariant across all steps and can be done once then cloned.
   *
   * Includes:
   * - Structural parent-child hierarchy
   * - Expression node dependencies (conditional, logic, reference, pipeline, function, etc.)
   * - Transition wiring that doesn't use step-scope (onAction, onSubmit)
   * - Validation dependencies
   *
   * @param compilationDependencies
   */
  static wireStaticDependencies(compilationDependencies: CompilationDependencies): void {
    const wiringContext = new WiringContext(
      compilationDependencies.nodeRegistry,
      compilationDependencies.metadataRegistry,
      compilationDependencies.dependencyGraph,
    )

    // Structural hierarchy
    new StructuralWiring(wiringContext).wire()

    // Transitions that don't use step-scope metadata
    new AccessWiring(wiringContext).wire()
    new ActionWiring(wiringContext).wire()
    new SubmitWiring(wiringContext).wire()

    // All predicate wiring
    new TestWiring(wiringContext).wire()
    new AndWiring(wiringContext).wire()
    new OrWiring(wiringContext).wire()
    new XorWiring(wiringContext).wire()
    new NotWiring(wiringContext).wire()

    // All expression wiring
    new ConditionalWiring(wiringContext).wire()
    new ReferenceWiring(wiringContext).wire()
    new PipelineWiring(wiringContext).wire()
    new FunctionWiring(wiringContext).wire()
    new ValidationWiring(wiringContext).wire()
    new NextWiring(wiringContext).wire()
    new FormatWiring(wiringContext).wire()
    new IterateWiring(wiringContext).wire()
  }

  /**
   * Compile Phase 8: Wire step-scope dependencies (call PER-STEP after pseudo node creation)
   *
   * Wires relationships that depend on step-scope metadata or pseudo nodes.
   * Must be called after:
   * 1. setStepScopeMetadata() - sets isCurrentStep, isDescendantOfStep, isAncestorOfStep
   * 2. createPseudoNodes() - creates Answer, Data, Query, Params, Post pseudo nodes
   *
   * Includes:
   * - onLoad transition wiring (uses isAncestorOfStep, getCurrentStepNode)
   * - All pseudo node wiring (pseudo nodes are step-specific)
   *
   * @param compilationDependencies
   */
  static wireStepScopeDependencies(compilationDependencies: CompilationDependencies): void {
    const wiringContext = new WiringContext(
      compilationDependencies.nodeRegistry,
      compilationDependencies.metadataRegistry,
      compilationDependencies.dependencyGraph,
    )

    // onLoad uses step-scope metadata (isAncestorOfStep, getCurrentStepNode)
    new LoadWiring(wiringContext).wire()

    // Pseudo node wiring (pseudo nodes are created per-step)
    new AnswerLocalWiring(wiringContext).wire()
    new AnswerRemoteWiring(wiringContext).wire()
    new DataWiring(wiringContext).wire()
    new QueryWiring(wiringContext).wire()
    new ParamsWiring(wiringContext).wire()
    new PostWiring(wiringContext).wire()
  }

  /**
   * Runtime Phase 6: Wire dependency graph for runtime nodes (scoped wiring)
   *
   * Creates dependency edges for dynamically created nodes at runtime.
   * Wires both directions - new nodes to existing graph and existing nodes to new nodes.
   *
   * @param compilationDependencies
   * @param nodeIds - The specific nodes to wire
   */
  static wireRuntimeDependencies(compilationDependencies: CompilationDependencies, nodeIds: NodeId[]): void {
    const wiringContext = new WiringContext(
      compilationDependencies.nodeRegistry,
      compilationDependencies.metadataRegistry,
      compilationDependencies.dependencyGraph,
    )

    // Scoped wiring - only process specified nodes with bidirectional wiring
    new StructuralWiring(wiringContext).wireNodes(nodeIds)

    // Wire lifecycle transitions (entry = onLoad + onAccess, action = onAction, exit = onSubmit)
    new LoadWiring(wiringContext).wireNodes(nodeIds)
    new AccessWiring(wiringContext).wireNodes(nodeIds)
    new ActionWiring(wiringContext).wireNodes(nodeIds)
    new SubmitWiring(wiringContext).wireNodes(nodeIds)

    // Wire pseudo nodes
    new AnswerLocalWiring(wiringContext).wireNodes(nodeIds)
    new AnswerRemoteWiring(wiringContext).wireNodes(nodeIds)
    new DataWiring(wiringContext).wireNodes(nodeIds)
    new QueryWiring(wiringContext).wireNodes(nodeIds)
    new ParamsWiring(wiringContext).wireNodes(nodeIds)
    new PostWiring(wiringContext).wireNodes(nodeIds)

    // Wire predicate nodes
    new TestWiring(wiringContext).wireNodes(nodeIds)
    new AndWiring(wiringContext).wireNodes(nodeIds)
    new OrWiring(wiringContext).wireNodes(nodeIds)
    new XorWiring(wiringContext).wireNodes(nodeIds)
    new NotWiring(wiringContext).wireNodes(nodeIds)

    // Wire expression nodes
    new ConditionalWiring(wiringContext).wireNodes(nodeIds)
    new ReferenceWiring(wiringContext).wireNodes(nodeIds)
    new PipelineWiring(wiringContext).wireNodes(nodeIds)
    new FunctionWiring(wiringContext).wireNodes(nodeIds)
    new ValidationWiring(wiringContext).wireNodes(nodeIds)
    new NextWiring(wiringContext).wireNodes(nodeIds)
    new FormatWiring(wiringContext).wireNodes(nodeIds)
    new IterateWiring(wiringContext).wireNodes(nodeIds)
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
