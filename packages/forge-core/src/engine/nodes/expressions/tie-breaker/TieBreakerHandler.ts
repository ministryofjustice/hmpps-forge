import { NodeId } from '../../../types/ast.type'
import { TieBreakerASTNode } from '../../../types/expressions.type'
import {
  HandlerResult,
  MetadataComputationDependencies,
  ThunkHandler,
  ThunkInvocationAdapter,
} from '../../../compilation/thunks/types'
import ThunkEvaluationContext from '../../../compilation/thunks/ThunkEvaluationContext'

/**
 * Tie-breaker expression nodes carry configuration only - the priority value
 * and a reference to an optional `when` predicate - and are consumed directly
 * by the reachability analyser, not invoked through the thunk system. This
 * handler exists to satisfy the compile pass that demands a handler for every
 * registered AST node; the `when` predicate gets its own handler via the
 * standard PredicateExpr compilation path.
 */
export default class TieBreakerHandler implements ThunkHandler {
  isAsync = false

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: TieBreakerASTNode,
  ) {}

  computeIsAsync(_deps: MetadataComputationDependencies): void {
    this.isAsync = false
  }

  evaluateSync(_context: ThunkEvaluationContext, _invoker: ThunkInvocationAdapter): HandlerResult<number> {
    return { value: this.node.properties.priority }
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult<number>> {
    return this.evaluateSync(context, invoker)
  }
}
