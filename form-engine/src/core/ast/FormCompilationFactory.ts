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
import { ASTNode } from '@form-engine/core/types/engine.type'
import { PseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import CircularDependencyError from '@form-engine/errors/CircularDependencyError'
import {
  StructuralContext,
  structuralTraverse,
  StructuralVisitResult,
  VisitorResult,
} from '@form-engine/core/ast/traverser/StructuralTraverser'
import { isLoadTransitionNode, isSubmitTransitionNode } from '@form-engine/core/typeguards/transition-nodes'
import { isBlockStructNode, isJourneyStructNode, isStepStructNode } from '@form-engine/core/typeguards/structure-nodes'
import { isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'
import { isPseudoNode } from '@form-engine/core/typeguards/nodes'
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
    this.findStepArtefactRelevantNodes(rootNode, nodeRegistry, metadataRegistry)
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

    this.findJourneyMetadataArtefactRelevantNodes(rootNode, nodeRegistry, metadataRegistry)
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

  findStepArtefactRelevantNodes(
    rootNode: JourneyASTNode,
    nodeRegistry: NodeRegistry,
    metadataRegistry: MetadataRegistry,
  ) {
    const nodes: (ASTNode | PseudoNode)[] = []

    structuralTraverse(rootNode, {
      enterNode: (node: ASTNode, ctx: StructuralContext): VisitorResult => {
        // Handle OnLoad transitions whose owner is ancestor of step
        if (isLoadTransitionNode(node)) {
          // Find the Journey/Step node that owns this OnLoad transition
          const ownerNode = ctx.ancestors
            .filter(ancestor => isJourneyStructNode(ancestor) || isStepStructNode(ancestor))
            .at(-1)

          if (ownerNode && metadataRegistry.get(ownerNode.id, 'isAncestorOfStep')) {
            // Owner is ancestor of step - traverse this OnLoad subtree
            structuralTraverse(node, {
              enterNode(childNode: ASTNode): VisitorResult {
                nodes.push(childNode)
                return StructuralVisitResult.CONTINUE
              },
            })
          }

          // Skip in outer traversal - we already handled this subtree (or decided not to)
          return StructuralVisitResult.SKIP
        }

        // Handle Step nodes marked as ancestor of step
        if (isStepStructNode(node) && metadataRegistry.get(node.id, 'isAncestorOfStep')) {
          // Traverse entire Step subtree
          structuralTraverse(node, {
            enterNode(childNode: ASTNode): VisitorResult {
              nodes.push(childNode)
              return StructuralVisitResult.CONTINUE
            },
          })

          // Skip in outer traversal - we already handled this subtree
          return StructuralVisitResult.SKIP
        }

        if (isJourneyStructNode(node) && metadataRegistry.get(node.id, 'isAncestorOfStep')) {
          nodes.push(node)
        }

        return StructuralVisitResult.CONTINUE
      },
    })

    return [...nodes, ...this.findRelevantPseudoNodes(nodes, nodeRegistry)]
  }

  findJourneyMetadataArtefactRelevantNodes(
    rootNode: JourneyASTNode,
    nodeRegistry: NodeRegistry,
    metadataRegistry: MetadataRegistry,
  ) {
    const nodes: (ASTNode | PseudoNode)[] = []

    structuralTraverse(rootNode, {
      enterNode: (node: ASTNode, ctx: StructuralContext): VisitorResult => {
        // Handle OnLoad transitions whose owner is ancestor of step
        if (isLoadTransitionNode(node)) {
          // We need to look back in ancestors for the last Journey/Step node
          const ownerNode = ctx.ancestors
            .filter(ancestor => isJourneyStructNode(ancestor) || isStepStructNode(ancestor))
            .at(-1)

          if (ownerNode && metadataRegistry.get(ownerNode.id, 'isAncestorOfStep')) {
            // Owner is ancestor of step - traverse this OnLoad subtree
            structuralTraverse(node, {
              enterNode(childNode: ASTNode): VisitorResult {
                nodes.push(childNode)
                return StructuralVisitResult.CONTINUE
              },
            })
          }

          // Skip in outer traversal - we already handled this subtree (or decided not to)
          return StructuralVisitResult.SKIP
        }

        // Handle OnSubmit transitions from all steps
        if (isSubmitTransitionNode(node)) {
          const ownerNode = ctx.ancestors
            .filter(ancestor => isStepStructNode(ancestor))
            .at(-1)

          if (ownerNode) {
            structuralTraverse(node, {
              enterNode(childNode: ASTNode): VisitorResult {
                nodes.push(childNode)
                return StructuralVisitResult.CONTINUE
              },
            })
          }

          // Skip in outer traversal - we already handled this subtree (or decided not to)
          return StructuralVisitResult.SKIP
        }

        // Collect this node
        nodes.push(node)

        return StructuralVisitResult.CONTINUE
      },

      enterProperty: (key: string, value: any, ctx: StructuralContext): VisitorResult => {
        const { parent } = ctx

        // Journey nodes: only traverse specific properties
        if (isJourneyStructNode(parent)) {
          const allowedProps = ['path', 'title', 'description', 'journeys', 'steps', 'onLoad']
          return allowedProps.includes(key) ? StructuralVisitResult.CONTINUE : StructuralVisitResult.SKIP
        }

        // Step nodes: only traverse specific properties
        if (isStepStructNode(parent)) {
          const allowedProps = ['path', 'title', 'description', 'entry', 'onSubmission', 'blocks', 'onLoad']
          return allowedProps.includes(key) ? StructuralVisitResult.CONTINUE : StructuralVisitResult.SKIP
        }

        // Block nodes: only traverse specific properties
        if (isBlockStructNode(parent)) {
          const allowedProps = ['code', 'validate', 'dependent', 'formatPipeline', 'defaultValue']
          return allowedProps.includes(key) ? StructuralVisitResult.CONTINUE : StructuralVisitResult.SKIP
        }

        return StructuralVisitResult.CONTINUE
      },
    })

    return [...nodes, ...this.findRelevantPseudoNodes(nodes, nodeRegistry)]
  }

  /**
   * Find all pseudo nodes referenced by the given AST nodes
   * @param nodes - Array of AST nodes to scan for references
   * @param nodeRegistry - Registry containing all pseudo nodes
   */
  private findRelevantPseudoNodes(nodes: (ASTNode | PseudoNode)[], nodeRegistry: NodeRegistry): PseudoNode[] {
    // Extract reference nodes from collected nodes
    const referenceNodes = nodes.filter(isReferenceExprNode)

    // Extract identifiers from reference nodes
    const identifiers = {
      answers: new Set<string>(), // Answer() and Data() base field codes
      query: new Set<string>(), // Query() param names
      params: new Set<string>(), // Params() param names
    }

    referenceNodes.forEach(refNode => {
      const path = refNode.properties.get('path') as string[]

      if (!Array.isArray(path) || path.length < 2) {
        return
      }

      const source = path[0] // 'answers', 'data', 'post', 'query', 'params'
      const identifier = path[1] // 'firstName', 'user', 'redirect_url', etc.

      switch (source) {
        case 'answers':
        case 'data':
        case 'post': {
          // Extract base field code (before the dot)
          const baseFieldCode = identifier.split('.')[0]
          identifiers.answers.add(baseFieldCode)
          break
        }
        case 'query':
          identifiers.query.add(identifier)
          break

        case 'params':
          identifiers.params.add(identifier)
          break
        default:
          break
      }
    })

    // Filter pseudo nodes from registry that match those identifiers
    return (
      Array.from(nodeRegistry.getAll().values())
        .filter(isPseudoNode)
        .filter(pseudoNode => {
          switch (pseudoNode.type) {
            case PseudoNodeType.ANSWER_LOCAL:
            case PseudoNodeType.ANSWER_REMOTE:
            case PseudoNodeType.DATA:
            case PseudoNodeType.POST:
              return identifiers.answers.has(pseudoNode.properties.baseFieldCode)

            case PseudoNodeType.QUERY:
              return identifiers.query.has(pseudoNode.properties.paramName)

            case PseudoNodeType.PARAMS:
              return identifiers.params.has(pseudoNode.properties.paramName)

            default:
              return false
          }
        })
    )
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
