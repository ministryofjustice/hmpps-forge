import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import { PseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { isPseudoNode } from '@form-engine/core/typeguards/nodes'
import {
  isReferenceExprNode,
  isFormatExprNode,
  isPipelineExprNode,
  isFunctionExprNode,
  isEffectExprNode,
  isIterateExprNode,
  isValidationExprNode,
  isConditionalExprNode,
} from '@form-engine/core/typeguards/expression-nodes'
import {
  isAccessTransitionNode,
  isActionTransitionNode,
  isSubmitTransitionNode,
} from '@form-engine/core/typeguards/transition-nodes'
import { ThunkHandler, MetadataComputationDependencies } from '@form-engine/core/compilation/thunks/types'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'
import { isBlockStructNode, isJourneyStructNode, isStepStructNode } from '@form-engine/core/typeguards/structure-nodes'
import ScopeReferenceHandler from '@form-engine/core/nodes/expressions/reference/scope/ScopeReferenceHandler'
import AnswersReferenceHandler from '@form-engine/core/nodes/expressions/reference/answers/AnswersReferenceHandler'
import DataReferenceHandler from '@form-engine/core/nodes/expressions/reference/data/DataReferenceHandler'
import PostReferenceHandler from '@form-engine/core/nodes/expressions/reference/post/PostReferenceHandler'
import QueryReferenceHandler from '@form-engine/core/nodes/expressions/reference/query/QueryReferenceHandler'
import ParamsReferenceHandler from '@form-engine/core/nodes/expressions/reference/params/ParamsReferenceHandler'
import BaseReferenceHandler from '@form-engine/core/nodes/expressions/reference/base/BaseReferenceHandler'
import IterateHandler from '@form-engine/core/nodes/expressions/iterate/IterateHandler'
import ConditionalHandler from '@form-engine/core/nodes/expressions/conditional/ConditionalHandler'
import AndHandler from '@form-engine/core/nodes/predicates/and/AndHandler'
import OrHandler from '@form-engine/core/nodes/predicates/or/OrHandler'
import XorHandler from '@form-engine/core/nodes/predicates/xor/XorHandler'
import NotHandler from '@form-engine/core/nodes/predicates/not/NotHandler'
import TestHandler from '@form-engine/core/nodes/predicates/test/TestHandler'
import FunctionHandler from '@form-engine/core/nodes/expressions/function/FunctionHandler'
import EffectHandler from '@form-engine/core/nodes/expressions/effect/EffectHandler'
import BlockHandler from '@form-engine/core/nodes/structures/block/BlockHandler'
import StepHandler from '@form-engine/core/nodes/structures/step/StepHandler'
import AccessHandler from '@form-engine/core/nodes/transitions/access/AccessHandler'
import ActionHandler from '@form-engine/core/nodes/transitions/action/ActionHandler'
import SubmitHandler from '@form-engine/core/nodes/transitions/submit/SubmitHandler'
import { CompilationDependencies } from '@form-engine/core/compilation/CompilationDependencies'
import JourneyHandler from '@form-engine/core/nodes/structures/journey/JourneyHandler'
import {
  isAndPredicateNode,
  isOrPredicateNode,
  isXorPredicateNode,
  isNotPredicateNode,
  isTestPredicateNode,
} from '@form-engine/core/typeguards/predicate-nodes'
import { isRedirectOutcomeNode, isThrowErrorOutcomeNode } from '@form-engine/core/typeguards/outcome-nodes'
import ThunkTypeMismatchError from '@form-engine/errors/ThunkTypeMismatchError'
import PostHandler from '@form-engine/core/nodes/pseudo-nodes/post/PostHandler'
import QueryHandler from '@form-engine/core/nodes/pseudo-nodes/query/QueryHandler'
import ParamsHandler from '@form-engine/core/nodes/pseudo-nodes/params/ParamsHandler'
import DataHandler from '@form-engine/core/nodes/pseudo-nodes/data/DataHandler'
import AnswerLocalHandler from '@form-engine/core/nodes/pseudo-nodes/answer-local/AnswerLocalHandler'
import AnswerRemoteHandler from '@form-engine/core/nodes/pseudo-nodes/answer-remote/AnswerRemoteHandler'
import PipelineHandler from '@form-engine/core/nodes/expressions/pipeline/PipelineHandler'
import FormatHandler from '@form-engine/core/nodes/expressions/format/FormatHandler'
import ValidationHandler from '@form-engine/core/nodes/expressions/validation/ValidationHandler'
import RedirectOutcomeHandler from '@form-engine/core/nodes/outcomes/redirect/RedirectOutcomeHandler'
import ThrowErrorOutcomeHandler from '@form-engine/core/nodes/outcomes/throw-error/ThrowErrorOutcomeHandler'

export interface ThunkCompilationInstrumentation {
  stageSync?: <T>(name: string, fn: () => T) => T
}

/**
 * Compiler that orchestrates the creation of thunk handlers for all nodes.
 *
 * Handlers are created using specialized factories based on node type:
 * - Pseudo nodes: PseudoNodeHandlerFactory
 * - Expression nodes: ReferenceHandler, IterateHandler, ConditionalHandler, TestHandler, AndHandler, OrHandler, XorHandler, NotHandler, FormatHandler, PipelineHandler, LogicHandlerFactory, FunctionHandlerFactory
 * - Transition nodes: AccessHandler, ActionHandler, SubmitHandler
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
  compile(
    compilationDependencies: CompilationDependencies,
    functionRegistry: FunctionRegistry,
    instrumentation?: ThunkCompilationInstrumentation,
  ) {
    const withStage = <T>(name: string, fn: () => T): T => {
      if (instrumentation?.stageSync) {
        return instrumentation.stageSync(name, fn)
      }

      return fn()
    }

    const nodeEntries = compilationDependencies.nodeRegistry.getAllEntries()

    // PASS 1: Create all handlers
    withStage('pass1.createAndRegisterHandlers', () => {
      nodeEntries.forEach((entry, nodeId) => {
        const handler = this.compileASTNode(nodeId, entry.node)

        compilationDependencies.thunkHandlerRegistry.register(nodeId, handler)
      })
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

    const sortResult = withStage('pass2.topologicalSort', () =>
      compilationDependencies.dependencyGraph.topologicalSort(),
    )

    withStage('pass2.computeIsAsync', () => {
      sortResult.sort.forEach(nodeId => {
        const handler = compilationDependencies.thunkHandlerRegistry.get(nodeId)

        if (handler) {
          handler.computeIsAsync(metadataDeps)
        }
      })
    })
  }

  /**
   * Compiles a node into a thunk handler
   *
   * Creates appropriate handler based on node type using typeguards.
   * Handler selection order:
   * 1. Pseudo nodes (AnswerLocal, AnswerRemote, Post, Query, Params, Data)
   * 2. Expression nodes (Reference, Iterate, Conditional, TestPredicate, AndPredicate, OrPredicate, XorPredicate, NotPredicate, Format, Pipeline, Function)
   * 3. Transition nodes (Access, Action, Submit)
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

    // Transition nodes (ACCESS, ACTION, SUBMIT)
    if (isAccessTransitionNode(node)) {
      return new AccessHandler(nodeId, node)
    }

    if (isActionTransitionNode(node)) {
      return new ActionHandler(nodeId, node)
    }

    if (isSubmitTransitionNode(node)) {
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
