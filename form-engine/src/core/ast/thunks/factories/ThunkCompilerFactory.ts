import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import { PseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { isPseudoNode } from '@form-engine/core/typeguards/nodes'
import {
  isReferenceExprNode,
  isFormatExprNode,
  isPipelineExprNode,
  isConditionalExprNode,
  isFunctionExprNode,
  isEffectExprNode,
  isIterateExprNode,
  isNextExprNode,
  isValidationExprNode,
} from '@form-engine/core/typeguards/expression-nodes'
import {
  isLoadTransitionNode,
  isAccessTransitionNode,
  isActionTransitionNode,
  isSubmitTransitionNode,
} from '@form-engine/core/typeguards/transition-nodes'
import { ThunkHandler, MetadataComputationDependencies } from '@form-engine/core/ast/thunks/types'
import { isHybridHandler } from '@form-engine/core/ast/thunks/typeguards'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'
import { isBlockStructNode, isJourneyStructNode, isStepStructNode } from '@form-engine/core/typeguards/structure-nodes'
import ScopeReferenceHandler from '@form-engine/core/ast/thunks/handlers/references/ScopeReferenceHandler'
import AnswersReferenceHandler from '@form-engine/core/ast/thunks/handlers/references/AnswersReferenceHandler'
import DataReferenceHandler from '@form-engine/core/ast/thunks/handlers/references/DataReferenceHandler'
import PostReferenceHandler from '@form-engine/core/ast/thunks/handlers/references/PostReferenceHandler'
import QueryReferenceHandler from '@form-engine/core/ast/thunks/handlers/references/QueryReferenceHandler'
import ParamsReferenceHandler from '@form-engine/core/ast/thunks/handlers/references/ParamsReferenceHandler'
import IterateHandler from '@form-engine/core/ast/thunks/handlers/expressions/IterateHandler'
import ConditionalHandler from '@form-engine/core/ast/thunks/handlers/expressions/ConditionalHandler'
import AndPredicateHandler from '@form-engine/core/ast/thunks/handlers/expressions/AndPredicateHandler'
import OrPredicateHandler from '@form-engine/core/ast/thunks/handlers/expressions/OrPredicateHandler'
import XorPredicateHandler from '@form-engine/core/ast/thunks/handlers/expressions/XorPredicateHandler'
import NotPredicateHandler from '@form-engine/core/ast/thunks/handlers/expressions/NotPredicateHandler'
import TestPredicateHandler from '@form-engine/core/ast/thunks/handlers/expressions/TestPredicateHandler'
import FunctionHandler from '@form-engine/core/ast/thunks/handlers/expressions/FunctionHandler'
import EffectHandler from '@form-engine/core/ast/thunks/handlers/expressions/EffectHandler'
import BlockHandler from '@form-engine/core/ast/thunks/handlers/structures/BlockHandler'
import StepHandler from '@form-engine/core/ast/thunks/handlers/structures/StepHandler'
import LoadTransitionHandler from '@form-engine/core/ast/thunks/handlers/transitions/LoadTransitionHandler'
import AccessTransitionHandler from '@form-engine/core/ast/thunks/handlers/transitions/AccessTransitionHandler'
import ActionTransitionHandler from '@form-engine/core/ast/thunks/handlers/transitions/ActionTransitionHandler'
import SubmitTransitionHandler from '@form-engine/core/ast/thunks/handlers/transitions/SubmitTransitionHandler'
import { CompilationDependencies } from '@form-engine/core/ast/compilation/CompilationDependencies'
import JourneyHandler from '@form-engine/core/ast/thunks/handlers/structures/JourneyHandler'
import {
  isPredicateAndNode,
  isPredicateOrNode,
  isPredicateXorNode,
  isPredicateNotNode,
  isPredicateTestNode,
} from '@form-engine/core/typeguards/predicate-nodes'
import ThunkTypeMismatchError from '@form-engine/errors/ThunkTypeMismatchError'
import PostHandler from '@form-engine/core/ast/thunks/handlers/pseudo-nodes/PostHandler'
import QueryHandler from '@form-engine/core/ast/thunks/handlers/pseudo-nodes/QueryHandler'
import ParamsHandler from '@form-engine/core/ast/thunks/handlers/pseudo-nodes/ParamsHandler'
import DataHandler from '@form-engine/core/ast/thunks/handlers/pseudo-nodes/DataHandler'
import AnswerLocalHandler from '@form-engine/core/ast/thunks/handlers/pseudo-nodes/AnswerLocalHandler'
import AnswerRemoteHandler from '@form-engine/core/ast/thunks/handlers/pseudo-nodes/AnswerRemoteHandler'
import PipelineHandler from '@form-engine/core/ast/thunks/handlers/expressions/PipelineHandler'
import FormatHandler from '@form-engine/core/ast/thunks/handlers/expressions/FormatHandler'
import ValidationHandler from '@form-engine/core/ast/thunks/handlers/expressions/ValidationHandler'
import NextHandler from '@form-engine/core/ast/thunks/handlers/expressions/NextHandler'

/**
 * Compiler that orchestrates the creation of thunk handlers for all nodes.
 *
 * Handlers are created using specialized factories based on node type:
 * - Pseudo nodes: PseudoNodeHandlerFactory
 * - Expression nodes: ReferenceHandler, IterateHandler, ConditionalHandler, TestPredicateHandler, AndPredicateHandler, OrPredicateHandler, XorPredicateHandler, NotPredicateHandler, FormatHandler, PipelineHandler, LogicHandlerFactory, FunctionHandlerFactory
 * - Transition nodes: LoadTransitionHandler, AccessTransitionHandler, SubmitTransitionHandler
 * - Structural nodes: JourneyHandler, StepHandler, BlockHandler
 * - Unknown nodes: FallbackHandler
 */
export default class ThunkCompilerFactory {
  /**
   * Compile all nodes into thunk handlers (TWO-PASS)
   *
   * Pass 1: Creates handlers for all nodes
   * Pass 2: Computes isAsync metadata for hybrid handlers
   *
   * This two-pass approach allows handlers to check their dependencies'
   * async metadata during the second pass, enabling sync optimization.
   *
   * @param compilationDependencies - Contains nodeRegistry with all nodes to compile
   * @param functionRegistry - Registry of user-defined functions (for async metadata)
   */
  compile(compilationDependencies: CompilationDependencies, functionRegistry: FunctionRegistry) {
    // PASS 1: Create all handlers
    compilationDependencies.nodeRegistry.getAllEntries().forEach((entry, nodeId) => {
      const handler = this.compileASTNode(nodeId, entry.node)

      compilationDependencies.thunkHandlerRegistry.register(nodeId, handler)
    })

    // PASS 2: Compute isAsync metadata for hybrid handlers
    // Use topological sort to compute in dependency order (leaves → roots)
    // This ensures children compute before parents, so parents see accurate isAsync values
    const metadataDeps: MetadataComputationDependencies = {
      thunkHandlerRegistry: compilationDependencies.thunkHandlerRegistry,
      functionRegistry,
      nodeRegistry: compilationDependencies.nodeRegistry,
      metadataRegistry: compilationDependencies.metadataRegistry,
    }

    const sortResult = compilationDependencies.dependencyGraph.topologicalSort()

    sortResult.sort.forEach(nodeId => {
      const handler = compilationDependencies.thunkHandlerRegistry.get(nodeId)

      if (handler && isHybridHandler(handler)) {
        handler.computeIsAsync(metadataDeps)
      }
    })
  }

  /**
   * Compiles a node into a thunk handler
   *
   * Creates appropriate handler based on node type using typeguards.
   * Handler selection order:
   * 1. Pseudo nodes (AnswerLocal, AnswerRemote, Post, Query, Params, Data)
   * 2. Expression nodes (Reference, Iterate, Conditional, TestPredicate, AndPredicate, OrPredicate, XorPredicate, NotPredicate, Format, Pipeline, Function)
   * 3. Transition nodes (Load, Access, Submit)
   * 4. Structural nodes (Journey, Step, Block)
   * 5. Fallback for unknown types
   *
   * Public to allow runtime node compilation (e.g., collection template instances)
   *
   * @param nodeId - The unique ID of the node
   * @param node - The AST node to compile
   * @returns A ThunkHandler for this node
   */
  compileASTNode(nodeId: NodeId, node: ASTNode | PseudoNode): ThunkHandler {
    // Pseudo nodes
    if (isPseudoNode(node)) {
      switch (node.type) {
        case PseudoNodeType.POST:
          return new PostHandler(nodeId, node)

        case PseudoNodeType.QUERY:
          return new QueryHandler(nodeId, node)

        case PseudoNodeType.PARAMS:
          return new ParamsHandler(nodeId, node)

        case PseudoNodeType.DATA:
          return new DataHandler(nodeId, node)

        case PseudoNodeType.ANSWER_LOCAL:
          return new AnswerLocalHandler(nodeId, node)

        case PseudoNodeType.ANSWER_REMOTE:
          return new AnswerRemoteHandler(nodeId, node)

        default:
          throw ThunkTypeMismatchError.invalidNodeType(nodeId, (node as any).type, [
            PseudoNodeType.POST,
            PseudoNodeType.QUERY,
            PseudoNodeType.PARAMS,
            PseudoNodeType.DATA,
            PseudoNodeType.ANSWER_LOCAL,
            PseudoNodeType.ANSWER_REMOTE,
          ])
      }
    }

    // Reference expressions - route by namespace
    if (isReferenceExprNode(node)) {
      const namespace = node.properties.path[0]

      switch (namespace) {
        case '@scope':
          return new ScopeReferenceHandler(nodeId, node)

        case 'answers':
          return new AnswersReferenceHandler(nodeId, node)

        case 'data':
          return new DataReferenceHandler(nodeId, node)

        case 'post':
          return new PostReferenceHandler(nodeId, node)

        case 'query':
          return new QueryReferenceHandler(nodeId, node)

        case 'params':
          return new ParamsReferenceHandler(nodeId, node)

        default:
          throw ThunkTypeMismatchError.invalidNodeType(nodeId, `REFERENCE:${namespace}`, [
            '@scope',
            'answers',
            'data',
            'post',
            'query',
            'params',
          ])
      }
    }

    // Format expressions
    if (isFormatExprNode(node)) {
      return new FormatHandler(nodeId, node)
    }

    // Pipeline expressions
    if (isPipelineExprNode(node)) {
      return new PipelineHandler(nodeId, node)
    }

    // Iterate expressions
    if (isIterateExprNode(node)) {
      return new IterateHandler(nodeId, node)
    }

    // Conditional expressions
    if (isConditionalExprNode(node)) {
      return new ConditionalHandler(nodeId, node)
    }

    // TEST Predicate expressions
    if (isPredicateTestNode(node)) {
      return new TestPredicateHandler(nodeId, node)
    }

    // AND Predicate expressions
    if (isPredicateAndNode(node)) {
      return new AndPredicateHandler(nodeId, node)
    }

    // OR Predicate expressions
    if (isPredicateOrNode(node)) {
      return new OrPredicateHandler(nodeId, node)
    }

    // XOR Predicate expressions
    if (isPredicateXorNode(node)) {
      return new XorPredicateHandler(nodeId, node)
    }

    // NOT Predicate expressions
    if (isPredicateNotNode(node)) {
      return new NotPredicateHandler(nodeId, node)
    }

    // Effect function expressions (EFFECT)
    if (isEffectExprNode(node)) {
      return new EffectHandler(nodeId, node)
    }

    // Function expressions (CONDITION, TRANSFORMER, GENERATOR)
    if (isFunctionExprNode(node)) {
      return new FunctionHandler(nodeId, node)
    }

    if (isNextExprNode(node)) {
      return new NextHandler(nodeId, node)
    }

    if (isValidationExprNode(node)) {
      return new ValidationHandler(nodeId, node)
    }

    // Transition nodes (LOAD, ACCESS, ACTION, SUBMIT)
    if (isLoadTransitionNode(node)) {
      return new LoadTransitionHandler(nodeId, node)
    }

    if (isAccessTransitionNode(node)) {
      return new AccessTransitionHandler(nodeId, node)
    }

    if (isActionTransitionNode(node)) {
      return new ActionTransitionHandler(nodeId, node)
    }

    if (isSubmitTransitionNode(node)) {
      return new SubmitTransitionHandler(nodeId, node)
    }

    // Structural nodes (JOURNEY, STEP, BLOCK)
    if (isJourneyStructNode(node)) {
      return new JourneyHandler(nodeId, node)
    }

    if (isStepStructNode(node)) {
      return new StepHandler(nodeId, node)
    }

    if (isBlockStructNode(node)) {
      return new BlockHandler(nodeId, node)
    }

    // Fallback for unknown node types
    throw ThunkTypeMismatchError.invalidNodeType(nodeId, node.type, [
      'REFERENCE',
      'FORMAT',
      'PIPELINE',
      'ITERATE',
      'CONDITIONAL',
      'TEST',
      'AND',
      'OR',
      'XOR',
      'NOT',
      'FUNCTION',
      'NEXT',
      'VALIDATION',
      'LOAD',
      'ACCESS',
      'SUBMIT',
      'JOURNEY',
      'STEP',
      'BLOCK',
    ])
  }
}
