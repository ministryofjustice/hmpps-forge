import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import MetadataRegistry from '@form-engine/core/ast/registration/MetadataRegistry'
import RegistrationTraverser from '@form-engine/core/ast/registration/RegistrationTraverser'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import { NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { AddSelfValueToFieldsNormalizer } from '@form-engine/core/ast/normalizers/AddSelfValueToFields'
import { ConvertFormattersToPipelineNormalizer } from '@form-engine/core/ast/normalizers/ConvertFormattersToPipeline'
import { ResolveSelfReferencesNormalizer } from '@form-engine/core/ast/normalizers/ResolveSelfReferences'
import { ASTNodeType } from '@form-engine/core/types/enums'
import PseudoNodeTraverser from '@form-engine/core/ast/registration/PseudoNodeTraverser'
import { PseudoNodeFactory } from '@form-engine/core/ast/nodes/PseudoNodeFactory'
import DependencyGraph from '@form-engine/core/ast/dependencies/DependencyGraph'
import { MetadataTraverser } from '@form-engine/core/ast/registration/MetadataTraverser'
import { AttachValidationBlockCodeNormalizer } from '@form-engine/core/ast/normalizers/AttachValidationBlockCode'
import CircularDependencyError from '@form-engine/errors/CircularDependencyError'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import StructuralWiring from '@form-engine/core/ast/dependencies/wiring/structural/StructuralWiring'
import OnLoadTransitionWiring from '@form-engine/core/ast/dependencies/wiring/transitions/OnLoadTransitionWiring'
import OnSubmitTransitionWiring from '@form-engine/core/ast/dependencies/wiring/transitions/OnSubmitTransitionWiring'
import AnswerPseudoNodeWiring from '@form-engine/core/ast/dependencies/wiring/pseudo-nodes/AnswerPseudoNodeWiring'
import DataPseudoNodeWiring from '@form-engine/core/ast/dependencies/wiring/pseudo-nodes/DataPseudoNodeWiring'
import QueryPseudoNodeWiring from '@form-engine/core/ast/dependencies/wiring/pseudo-nodes/QueryPseudoNodeWiring'
import ParamsPseudoNodeWiring from '@form-engine/core/ast/dependencies/wiring/pseudo-nodes/ParamsPseudoNodeWiring'
import PostPseudoNodeWiring from '@form-engine/core/ast/dependencies/wiring/pseudo-nodes/PostPseudoNodeWiring'
import ConditionalExpressionWiring from '@form-engine/core/ast/dependencies/wiring/expressions/ConditionalExpressionWiring'
import LogicExpressionWiring from '@form-engine/core/ast/dependencies/wiring/expressions/LogicExpressionWiring'
import PipelineExpressionWiring from '@form-engine/core/ast/dependencies/wiring/expressions/PipelineExpressionWiring'
import FunctionExpressionWiring from '@form-engine/core/ast/dependencies/wiring/expressions/FunctionExpressionWiring'
import ValidationExpressionWiring from '@form-engine/core/ast/dependencies/wiring/expressions/ValidationExpressionWiring'
import FormatExpressionWiring from '@form-engine/core/ast/dependencies/wiring/expressions/FormatExpressionWiring'
import {
  findJourneyMetadataArtefactRelevantNodes,
  findStepArtefactRelevantNodes,
} from '@form-engine/core/ast/utils/findRelevantNodes'

/**
 * TODO: Could probably use breaking this class up a bit, do that another time
 * FormCompiler - Main compilation factory for per-step AST architecture
 *
 * Generates one StepArtefact per step, each containing:
 * - Step AST (heavyweight - full rendering for that specific step)
 * - Journey Metadata AST (lightweight - navigation/validation for all steps)
 * - NodeRegistry (shared between step and journey ASTs for deduplication)
 *
 * Architecture:
 * - Compiles Journey Metadata AST separately for each step (enables future customization)
 * - Flattens nested journeys to generate artefacts for all steps
 * - Currently implements Phase 1A-1B only (JSON→AST + normalization)
 * - Future phases (dependency graph, thunk program) are placeholders
 */
export default class FormCompilationFactory {

  /**
   * Main entry point - compile a journey definition into per-step artefacts
   */
  compile(journeyDef: JourneyDefinition) {
    const { baseNodeIdGenerator, baseNodeRegistry, baseMetadataRegistry, transformedRootNode } =
      this.createTransformedNodesAndRegistry(journeyDef)

    return baseNodeRegistry.findByType<StepASTNode>(ASTNodeType.STEP)
      .map(stepNode =>
        this.createCompilationObject(
          baseNodeIdGenerator,
          baseNodeRegistry,
          baseMetadataRegistry,
          transformedRootNode,
          stepNode,
        ),
      )
  }

  createCompilationObject(
    baseNodeIdGenerator: NodeIDGenerator,
    baseNodeRegistry: NodeRegistry,
    baseMetadataRegistry: MetadataRegistry,
    rootNode: JourneyASTNode,
    stepNode: StepASTNode,
  ) {
    const clonedRegistry = baseNodeRegistry.clone()
    const clonedIdGenerator = baseNodeIdGenerator.clone()
    const clonedMetadataRegistry = baseMetadataRegistry.clone()
    const pseudoNodeFactory = new PseudoNodeFactory(clonedIdGenerator)

    // Phase 4 - Setup step scope metadata (marks which nodes are relevant for this step)
    const metadataTraverser = new MetadataTraverser(clonedMetadataRegistry)
    metadataTraverser.traverse(rootNode, stepNode)

    // Phase 5 - Add pseudo-nodes
    const pseudoNodeTraverser = new PseudoNodeTraverser(clonedRegistry, pseudoNodeFactory, clonedMetadataRegistry)
    pseudoNodeTraverser.createPseudoNodes()

    return {
      journeyMetadataArtefact: this.createJourneyMetadataArtefact(
        clonedIdGenerator,
        clonedRegistry,
        clonedMetadataRegistry,
        rootNode,
      ),
      stepArtefact: this.createStepArtefact(clonedIdGenerator, clonedRegistry, clonedMetadataRegistry, rootNode),
    }
  }

  /**
   * Create base registries, node factories and AST transformation
   * @param journeyDefinition
   */
  createTransformedNodesAndRegistry(journeyDefinition: JourneyDefinition) {
    const baseNodeIdGenerator = new NodeIDGenerator()
    const baseNodeFactory = new NodeFactory(baseNodeIdGenerator)
    const baseNodeRegistry = new NodeRegistry()
    const baseMetadataRegistry = new MetadataRegistry()

    // Phase 1 - Convert JourneyDefinition into AST nodes
    const transformedRootNode = baseNodeFactory.createNode(journeyDefinition) as JourneyASTNode

    // Phase 2 - Normalize AST nodes
    const addSelfValueToFieldsNormalizer = new AddSelfValueToFieldsNormalizer(baseNodeFactory)
    const attachValidationBlockCode = new AttachValidationBlockCodeNormalizer()
    const convertFormattersToPipelineNormalizer = new ConvertFormattersToPipelineNormalizer(baseNodeIdGenerator)
    const resolveSelfReferencesNormalizer = new ResolveSelfReferencesNormalizer()

    addSelfValueToFieldsNormalizer.normalize(transformedRootNode)
    attachValidationBlockCode.normalize(transformedRootNode)
    convertFormattersToPipelineNormalizer.normalize(transformedRootNode)
    resolveSelfReferencesNormalizer.normalize(transformedRootNode)

    // Phase 3 - Register nodes
    const nodeRegistrationTraverser = new RegistrationTraverser(baseNodeRegistry)

    nodeRegistrationTraverser.register(transformedRootNode)

    return {
      baseNodeIdGenerator,
      baseNodeFactory,
      baseNodeRegistry,
      baseMetadataRegistry,
      transformedRootNode,
    }
  }

  /**
   * Creates dependency graph, and thunk program for calculating all the fields/properties on the current Step
   * @param idGenerator
   * @param nodeRegistry
   * @param metadataRegistry
   * @param rootNode
   */
  createStepArtefact(
    idGenerator: NodeIDGenerator,
    nodeRegistry: NodeRegistry,
    metadataRegistry: MetadataRegistry,
    rootNode: JourneyASTNode,
  ) {
    const specialisedNodeRegistry = new NodeRegistry()
    findStepArtefactRelevantNodes(rootNode, nodeRegistry, metadataRegistry)
      .forEach(node => specialisedNodeRegistry.register(node.id, node))

    const graph = this.wireDependencyGraph(specialisedNodeRegistry, metadataRegistry)

    const topologicalSortResults = graph.topologicalSort()

    if (topologicalSortResults.hasCycles) {
      throw new CircularDependencyError({
        message: 'Circular dependencies detected in Step Artefact compilation',
        cycles: topologicalSortResults.cycles,
        code: 'STEP_ARTEFACT_CIRCULAR_DEPENDENCY',
      })
    }

    return {
      graph,
      idGenerator,
      specialisedNodeRegistry,
      metadataRegistry,
    }
  }

  /**
   * Creates dependency graph, and thunk program for calculating Journey metadata
   * @param idGenerator
   * @param nodeRegistry
   * @param metadataRegistry
   * @param rootNode
   */
  createJourneyMetadataArtefact(
    idGenerator: NodeIDGenerator,
    nodeRegistry: NodeRegistry,
    metadataRegistry: MetadataRegistry,
    rootNode: JourneyASTNode,
  ) {
    const specialisedNodeRegistry = new NodeRegistry()

    findJourneyMetadataArtefactRelevantNodes(rootNode, nodeRegistry, metadataRegistry)
      .forEach(node => specialisedNodeRegistry.register(node.id, node))

    const graph = this.wireDependencyGraph(specialisedNodeRegistry, metadataRegistry)

    const topologicalSortResults = graph.topologicalSort()

    if (topologicalSortResults.hasCycles) {
      throw new CircularDependencyError({
        message: 'Circular dependencies detected in Journey Metadata Artefact compilation',
        cycles: topologicalSortResults.cycles,
        code: 'JOURNEY_METADATA_ARTEFACT_CIRCULAR_DEPENDENCY',
      })
    }

    return {
      graph,
      idGenerator,
      specialisedNodeRegistry,
      metadataRegistry,
    }
  }

  /**
   * Create and wire a DependencyGraph for the provided NodeRegistry
   * @param nodeRegistry
   * @param metadataRegistry
   * @private
   */
  private wireDependencyGraph(nodeRegistry: NodeRegistry, metadataRegistry: MetadataRegistry) {
    const graph = new DependencyGraph()
    const wiringContext = new WiringContext(nodeRegistry, metadataRegistry, graph)

    new StructuralWiring(wiringContext).wire()
    new OnLoadTransitionWiring(wiringContext).wire()
    new OnSubmitTransitionWiring(wiringContext).wire()
    new AnswerPseudoNodeWiring(wiringContext).wire()
    new DataPseudoNodeWiring(wiringContext).wire()
    new QueryPseudoNodeWiring(wiringContext).wire()
    new ParamsPseudoNodeWiring(wiringContext).wire()
    new PostPseudoNodeWiring(wiringContext).wire()
    new ConditionalExpressionWiring(wiringContext).wire()
    new LogicExpressionWiring(wiringContext).wire()
    new PipelineExpressionWiring(wiringContext).wire()
    new FunctionExpressionWiring(wiringContext).wire()
    new ValidationExpressionWiring(wiringContext).wire()
    new FormatExpressionWiring(wiringContext).wire()

    return graph
  }
}

export type CompiledForm = ReturnType<FormCompilationFactory['compile']>
export type StepArtefact = ReturnType<FormCompilationFactory['createStepArtefact']>
export type JourneyMetadataArtefact = ReturnType<FormCompilationFactory['createJourneyMetadataArtefact']>
