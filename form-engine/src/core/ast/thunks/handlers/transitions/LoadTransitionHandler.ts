import { NodeId } from '@form-engine/core/types/engine.type'
import { LoadTransitionASTNode, FunctionASTNode } from '@form-engine/core/types/expressions.type'
import { ThunkHandler, ThunkInvocationAdapter, HandlerResult, CapturedEffect } from '@form-engine/core/ast/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'

/**
 * Result of a load transition evaluation
 */
export interface LoadTransitionResult {
  /**
   * Captured effects to be committed by LifecycleCoordinator
   * Effects are captured with their evaluated arguments, deferred for commit
   */
  effects: CapturedEffect[]
}

/**
 * Handler for Load Transition nodes
 *
 * Evaluates onLoad transitions by capturing effects and returning them
 * for LifecycleCoordinator to commit. Effects are functions that typically
 * load external data into context.data.
 *
 * ## Execution Pattern
 * 1. Capture all effects (invoke EffectHandler to get CapturedEffect[])
 * 2. Return captured effects for LifecycleCoordinator to commit
 *
 * LifecycleCoordinator commits LOAD effects immediately after evaluation
 * to ensure data is available for downstream nodes.
 *
 * ## Wiring Pattern
 * Effects are wired sequentially in the dependency graph:
 * - effect[0] → effect[1] → effect[2] → transition
 * - Each effect must complete before the next begins
 * - Last effect wires to transition with DATA_FLOW edge
 *
 * ## Return Value
 * Returns LoadTransitionResult containing captured effects.
 */
export default class LoadTransitionHandler implements ThunkHandler {
  constructor(
    public readonly nodeId: NodeId,
    private readonly node: LoadTransitionASTNode,
  ) {}

  async evaluate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<HandlerResult<LoadTransitionResult>> {
    const effects = this.node.properties.effects as FunctionASTNode[]

    if (!Array.isArray(effects) || effects.length === 0) {
      return { value: { effects: [] } }
    }

    // Capture effects (invoke EffectHandler for each)
    const results = await Promise.all(effects.map(effect => invoker.invoke<CapturedEffect>(effect.id, context)))

    const capturedEffects = results.filter(result => !result.error && result.value).map(result => result.value!)

    return { value: { effects: capturedEffects } }
  }
}
