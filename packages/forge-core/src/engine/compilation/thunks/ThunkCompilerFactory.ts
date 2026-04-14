import { ASTNode, NodeId } from '../../types/ast.type'
import { PseudoNode, PseudoNodeType } from '../../types/pseudoNodes.type'
import { isPseudoNode } from '../../typeguards/nodes'
import {
  isReferenceExprNode,
  isFormatExprNode,
  isPipelineExprNode,
  isFunctionExprNode,
  isEffectExprNode,
  isIterateExprNode,
  isValidationExprNode,
  isConditionalExprNode,
  isMatchExprNode,
} from '../../typeguards/expression-nodes'
import { isAccessHookNode, isActionHookNode, isSubmitHookNode } from '../../typeguards/hook-nodes'
import { ThunkHandler, MetadataComputationDependencies } from './types'
import FunctionRegistry from '../../registries/FunctionRegistry'
import { isBlockStructNode, isJourneyStructNode, isStepStructNode } from '../../typeguards/structure-nodes'
import ScopeReferenceHandler from '../../nodes/expressions/reference/scope/ScopeReferenceHandler'
import AnswersReferenceHandler from '../../nodes/expressions/reference/answers/AnswersReferenceHandler'
import DataReferenceHandler from '../../nodes/expressions/reference/data/DataReferenceHandler'
import PostReferenceHandler from '../../nodes/expressions/reference/post/PostReferenceHandler'
import QueryReferenceHandler from '../../nodes/expressions/reference/query/QueryReferenceHandler'
import ParamsReferenceHandler from '../../nodes/expressions/reference/params/ParamsReferenceHandler'
import RequestReferenceHandler from '../../nodes/expressions/reference/request/RequestReferenceHandler'
import SessionReferenceHandler from '../../nodes/expressions/reference/session/SessionReferenceHandler'
import BaseReferenceHandler from '../../nodes/expressions/reference/base/BaseReferenceHandler'
import IterateHandler from '../../nodes/expressions/iterate/IterateHandler'
import ConditionalHandler from '../../nodes/expressions/conditional/ConditionalHandler'
import MatchHandler from '../../nodes/expressions/match/MatchHandler'
import AndHandler from '../../nodes/predicates/and/AndHandler'
import OrHandler from '../../nodes/predicates/or/OrHandler'
import XorHandler from '../../nodes/predicates/xor/XorHandler'
import NotHandler from '../../nodes/predicates/not/NotHandler'
import TestHandler from '../../nodes/predicates/test/TestHandler'
import FunctionHandler from '../../nodes/expressions/function/FunctionHandler'
import EffectHandler from '../../nodes/expressions/effect/EffectHandler'
import BlockHandler from '../../nodes/structures/block/BlockHandler'
import StepHandler from '../../nodes/structures/step/StepHandler'
import AccessHandler from '../../nodes/hooks/access/AccessHandler'
import ActionHandler from '../../nodes/hooks/action/ActionHandler'
import SubmitHandler from '../../nodes/hooks/submit/SubmitHandler'
import { CompilationDependencies } from '../CompilationDependencies'
import JourneyHandler from '../../nodes/structures/journey/JourneyHandler'
import {
  isAndPredicateNode,
  isOrPredicateNode,
  isXorPredicateNode,
  isNotPredicateNode,
  isTestPredicateNode,
} from '../../typeguards/predicate-nodes'
import { isRedirectOutcomeNode, isThrowErrorOutcomeNode } from '../../typeguards/outcome-nodes'
import ThunkTypeMismatchError from '../../errors/ThunkTypeMismatchError'
import PostHandler from '../../nodes/pseudo-nodes/post/PostHandler'
import QueryHandler from '../../nodes/pseudo-nodes/query/QueryHandler'
import ParamsHandler from '../../nodes/pseudo-nodes/params/ParamsHandler'
import DataHandler from '../../nodes/pseudo-nodes/data/DataHandler'
import RequestHandler from '../../nodes/pseudo-nodes/request/RequestHandler'
import SessionHandler from '../../nodes/pseudo-nodes/session/SessionHandler'
import AnswerLocalHandler from '../../nodes/pseudo-nodes/answer-local/AnswerLocalHandler'
import AnswerRemoteHandler from '../../nodes/pseudo-nodes/answer-remote/AnswerRemoteHandler'
import PipelineHandler from '../../nodes/expressions/pipeline/PipelineHandler'
import FormatHandler from '../../nodes/expressions/format/FormatHandler'
import ValidationHandler from '../../nodes/expressions/validation/ValidationHandler'
import RedirectOutcomeHandler from '../../nodes/outcomes/redirect/RedirectOutcomeHandler'
import ThrowErrorOutcomeHandler from '../../nodes/outcomes/throw-error/ThrowErrorOutcomeHandler'

/**
 * Compiler that orchestrates the creation of thunk handlers for all nodes.
 *
 * Handlers are created using specialized factories based on node type:
 * - Pseudo nodes: PseudoNodeHandlerFactory
 * - Expression nodes: ReferenceHandler, IterateHandler, ConditionalHandler, TestHandler, AndHandler, OrHandler, XorHandler, NotHandler, FormatHandler, PipelineHandler, LogicHandlerFactory, FunctionHandlerFactory
 * - Hook nodes: AccessHandler, ActionHandler, SubmitHandler
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
   */
  compile(compilationDependencies: CompilationDependencies, functionRegistry: FunctionRegistry) {
    const nodeEntries = compilationDependencies.nodeRegistry.getAllEntries()

    // PASS 1: Create all handlers
    nodeEntries.forEach((entry, nodeId) => {
      const handler = this.compileASTNode(nodeId, entry.node)

      compilationDependencies.thunkHandlerRegistry.register(nodeId, handler)
    })

    // PASS 2: Compute isAsync metadata for hybrid handlers
    // Use post-order traversal to compute in dependency order (leaves → roots)
    // This ensures children compute before parents, so parents see accurate isAsync values
    const metadataDeps: MetadataComputationDependencies = {
      thunkHandlerRegistry: compilationDependencies.thunkHandlerRegistry,
      functionRegistry,
      nodeRegistry: compilationDependencies.nodeRegistry,
      metadataRegistry: compilationDependencies.metadataRegistry,
      astNodeTree: compilationDependencies.astNodeTree,
    }

    const postOrderIds = compilationDependencies.astNodeTree.postOrder()

    // Pseudo nodes aren't in the tree — collect and process first
    const treeNodeSet = new Set(postOrderIds)
    const pseudoNodeIds = compilationDependencies.nodeRegistry.getIds()
      .filter(id => !treeNodeSet.has(id))

    const computeOrder = [...pseudoNodeIds, ...postOrderIds]

    computeOrder.forEach(nodeId => {
      const handler = compilationDependencies.thunkHandlerRegistry.get(nodeId)

      if (handler) {
        handler.computeIsAsync(metadataDeps)
      }
    })
  }

  /**
   * Compiles a node into a thunk handler
   *
   * Creates appropriate handler based on node type using typeguards.
   * Handler selection order:
   * 1. Pseudo nodes (AnswerLocal, AnswerRemote, Post, Query, Params, Data, Request, Session)
   * 2. Expression nodes (Reference, Iterate, Conditional, TestPredicate, AndPredicate, OrPredicate, XorPredicate, NotPredicate, Format, Pipeline, Function)
   * 3. Hook nodes (Access, Action, Submit)
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

        case PseudoNodeType.REQUEST:
          return new RequestHandler(nodeId, node)

        case PseudoNodeType.SESSION:
          return new SessionHandler(nodeId, node)

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
            PseudoNodeType.REQUEST,
            PseudoNodeType.SESSION,
            PseudoNodeType.ANSWER_LOCAL,
            PseudoNodeType.ANSWER_REMOTE,
          ])
      }
    }

    // Reference expressions - route by base or namespace
    if (isReferenceExprNode(node)) {
      // If base is present, use BaseReferenceHandler to evaluate base first
      if (node.properties.base) {
        return new BaseReferenceHandler(nodeId, node)
      }

      // Route by namespace
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

        case 'request':
          return new RequestReferenceHandler(nodeId, node)

        case 'session':
          return new SessionReferenceHandler(nodeId, node)

        default:
          throw ThunkTypeMismatchError.invalidNodeType(nodeId, `REFERENCE:${namespace}`, [
            '@scope',
            'answers',
            'data',
            'post',
            'query',
            'params',
            'request',
            'session',
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

    // Match expressions
    if (isMatchExprNode(node)) {
      return new MatchHandler(nodeId, node)
    }

    // TEST Predicate expressions
    if (isTestPredicateNode(node)) {
      return new TestHandler(nodeId, node)
    }

    // AND Predicate expressions
    if (isAndPredicateNode(node)) {
      return new AndHandler(nodeId, node)
    }

    // OR Predicate expressions
    if (isOrPredicateNode(node)) {
      return new OrHandler(nodeId, node)
    }

    // XOR Predicate expressions
    if (isXorPredicateNode(node)) {
      return new XorHandler(nodeId, node)
    }

    // NOT Predicate expressions
    if (isNotPredicateNode(node)) {
      return new NotHandler(nodeId, node)
    }

    // Effect function expressions (EFFECT)
    if (isEffectExprNode(node)) {
      return new EffectHandler(nodeId, node)
    }

    // Function expressions (CONDITION, TRANSFORMER, GENERATOR)
    if (isFunctionExprNode(node)) {
      return new FunctionHandler(nodeId, node)
    }

    if (isValidationExprNode(node)) {
      return new ValidationHandler(nodeId, node)
    }

    // Outcome nodes (REDIRECT, THROW_ERROR)
    if (isRedirectOutcomeNode(node)) {
      return new RedirectOutcomeHandler(nodeId, node)
    }

    if (isThrowErrorOutcomeNode(node)) {
      return new ThrowErrorOutcomeHandler(nodeId, node)
    }

    // Hook nodes (ACCESS, ACTION, SUBMIT)
    if (isAccessHookNode(node)) {
      return new AccessHandler(nodeId, node)
    }

    if (isActionHookNode(node)) {
      return new ActionHandler(nodeId, node)
    }

    if (isSubmitHookNode(node)) {
      return new SubmitHandler(nodeId, node)
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
      'MATCH',
      'TEST',
      'AND',
      'OR',
      'XOR',
      'NOT',
      'FUNCTION',
      'NEXT',
      'VALIDATION',
      'OUTCOME',
      'ACCESS',
      'ACTION',
      'SUBMIT',
      'JOURNEY',
      'STEP',
      'BLOCK',
    ])
  }
}
