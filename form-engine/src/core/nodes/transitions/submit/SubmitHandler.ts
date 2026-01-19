import { NodeId } from '@form-engine/core/types/engine.type'
import { SubmitTransitionASTNode } from '@form-engine/core/types/expressions.type'
import {
  ThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
  ThunkError,
} from '@form-engine/core/compilation/thunks/types'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { ASTNodeType } from '@form-engine/core/types/enums'
import getAncestorChain from '@form-engine/core/utils/getAncestorChain'
import { evaluateNextOutcomes, OutcomeEvaluationResult } from '@form-engine/core/utils/thunkEvaluatorsAsync'
import { evaluateNextOutcomesSync } from '@form-engine/core/utils/thunkEvaluatorsSync'

/**
 * Result of a submit transition evaluation
 */
export interface SubmitTransitionResult {
  /**
   * Whether the transition was executed (when/guards passed)
   */
  executed: boolean

  /**
   * Whether validation was performed
   */
  validated: boolean

  /**
   * Whether validation passed (only meaningful if validated=true)
   */
  isValid?: boolean

  /**
   * The outcome of the transition:
   * - 'continue': Transition completed, proceed to render
   * - 'redirect': Halt and redirect to another page
   * - 'error': Halt and return HTTP error response
   */
  outcome: 'continue' | 'redirect' | 'error'

  /**
   * Navigation target (only present when outcome is 'redirect')
   */
  redirect?: string

  /**
   * HTTP status code for error response (only present when outcome is 'error')
   */
  status?: number

  /**
   * Error message for error response (only present when outcome is 'error')
   */
  message?: string
}

/**
 * Handler for Submit Transition nodes
 *
 * Evaluates onSubmission transitions by:
 * 1. Checking when/guards predicates
 * 2. Running validation if validate=true
 * 3. Pushing @transitionType: 'submit' onto scope for effect execution
 * 4. Executing effects from appropriate branch (effects run immediately)
 * 5. Evaluating next outcomes for navigation/errors (AFTER effects have run)
 *
 * ## Key Design: Effects Execute Before Next
 * Effects are executed BEFORE next expressions are evaluated. This ensures
 * that data set by effects (e.g., goalUuid) is available when evaluating
 * next expressions that reference that data (e.g., Format('goal/%1', Data('goalUuid'))).
 *
 * ## Outcome Evaluation
 * The `next` array in each branch contains redirect and throwError outcomes.
 * Outcomes are evaluated in order until one matches (when condition is true or absent).
 * First match wins and determines the transition result.
 *
 * ## Wiring Pattern
 * - when → transition (must evaluate before transition)
 * - guards → transition (must evaluate before transition)
 * - validations → transition (if validate=true)
 * - effects are executed sequentially within each branch
 * - next expressions are evaluated after effects complete
 *
 * ## Validation Logic
 * If validate=true:
 * - Evaluates all validation nodes attached to parent step
 * - If all validations pass: executes onValid branch
 * - If any validation fails: executes onInvalid branch
 * - Always executes onAlways branch effects first
 *
 * If validate=false:
 * - Skips validation
 * - Executes onAlways branch
 *
 * The @transitionType scope variable enables EffectHandler to create
 * EffectFunctionContext with the correct transition type for answer source tracking.
 */
export default class SubmitHandler implements ThunkHandler {
  isAsync = true

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: SubmitTransitionASTNode,
  ) {}

  computeIsAsync(deps: MetadataComputationDependencies): void {
    const { when, guards, onAlways, onValid, onInvalid } = this.node.properties

    // Check when predicate
    if (isASTNode(when)) {
      const handler = deps.thunkHandlerRegistry.get(when.id)
      if (handler?.isAsync ?? true) {
        this.isAsync = true
        return
      }
    }

    // Check guards predicate
    if (isASTNode(guards)) {
      const handler = deps.thunkHandlerRegistry.get(guards.id)
      if (handler?.isAsync ?? true) {
        this.isAsync = true
        return
      }
    }

    // Check branches
    const branches = [onAlways, onValid, onInvalid].filter(Boolean)

    for (const branch of branches) {
      // Check effects in branch
      if (branch?.effects && Array.isArray(branch.effects)) {
        const hasAsyncEffect = branch.effects.filter(isASTNode).some(effect => {
          const handler = deps.thunkHandlerRegistry.get(effect.id)
          return handler?.isAsync ?? true
        })
        if (hasAsyncEffect) {
          this.isAsync = true
          return
        }
      }

      // Check next outcomes in branch
      if (branch?.next && Array.isArray(branch.next)) {
        const hasAsyncNext = branch.next.filter(isASTNode).some(node => {
          const handler = deps.thunkHandlerRegistry.get(node.id)
          return handler?.isAsync ?? true
        })
        if (hasAsyncNext) {
          this.isAsync = true
          return
        }
      }
    }

    // TODO: Wire SubmitTransition to its parent step's blocks in the dependency graph
    // Currently, there's no explicit edge from SubmitTransition to the blocks it validates,
    // so the topological sort can't guarantee blocks are processed before this transition.
    // This causes us to check isAsync on block handlers that may not have been computed yet.
    // For now, we conservatively mark as async if validate=true.
    //
    // Proper fix: During dependency wiring, add edges from SubmitTransition (with validate=true)
    // to all field blocks in its parent step. This ensures blocks compute isAsync first.
    if (this.node.properties.validate === true) {
      this.isAsync = true
      return
    }

    this.isAsync = false
  }

  evaluateSync(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): HandlerResult<SubmitTransitionResult> {
    // Check when predicate
    const whenPassed = this.evaluateWhenPredicateSync(context, invoker)

    if (!whenPassed) {
      return {
        value: {
          executed: false,
          validated: false,
          outcome: 'continue',
        },
      }
    }

    // Check guards predicate
    const guardsPassed = this.evaluateGuardsPredicateSync(context, invoker)

    if (!guardsPassed) {
      return {
        value: {
          executed: false,
          validated: false,
          outcome: 'continue',
        },
      }
    }

    // Determine validation state
    const validate = this.node.properties.validate
    let isValid: boolean | undefined

    if (validate === true) {
      isValid = this.evaluateValidationsSync(context, invoker)
    }

    // Push transition type onto scope for effect execution
    context.scope.push({ '@transitionType': 'submit' })

    // Execute effects and evaluate next from appropriate branch
    let outcomeResult: OutcomeEvaluationResult = { type: 'none' }

    if (validate === true) {
      // Execute onAlways effects first
      const alwaysError = this.executeEffectsSync(this.node.properties.onAlways?.effects, context, invoker)

      if (alwaysError) {
        context.scope.pop()

        return { error: alwaysError }
      }

      if (isValid) {
        const result = this.executeBranchSync(this.node.properties.onValid, context, invoker)

        if (result.error) {
          context.scope.pop()

          return { error: result.error }
        }

        outcomeResult = result.outcome
      } else {
        const result = this.executeBranchSync(this.node.properties.onInvalid, context, invoker)

        if (result.error) {
          context.scope.pop()

          return { error: result.error }
        }

        outcomeResult = result.outcome
      }
    } else {
      // Skip validation transition
      const result = this.executeBranchSync(this.node.properties.onAlways, context, invoker)

      if (result.error) {
        context.scope.pop()

        return { error: result.error }
      }

      outcomeResult = result.outcome
    }

    // Pop scope after effects are done
    context.scope.pop()

    return {
      value: this.buildResult(validate === true, isValid, outcomeResult),
    }
  }

  async evaluate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<HandlerResult<SubmitTransitionResult>> {
    // Check when predicate
    const whenPassed = await this.evaluateWhenPredicate(context, invoker)

    if (!whenPassed) {
      return {
        value: {
          executed: false,
          validated: false,
          outcome: 'continue',
        },
      }
    }

    // Check guards predicate
    const guardsPassed = await this.evaluateGuardsPredicate(context, invoker)

    if (!guardsPassed) {
      return {
        value: {
          executed: false,
          validated: false,
          outcome: 'continue',
        },
      }
    }

    // Determine validation state
    const validate = this.node.properties.validate
    let isValid: boolean | undefined

    if (validate === true) {
      isValid = await this.evaluateValidations(context, invoker)
    }

    // Push transition type onto scope for effect execution
    context.scope.push({ '@transitionType': 'submit' })

    // Execute effects and evaluate next from appropriate branch
    let outcomeResult: OutcomeEvaluationResult = { type: 'none' }

    if (validate === true) {
      // Execute onAlways effects first
      const alwaysError = await this.executeEffects(this.node.properties.onAlways?.effects, context, invoker)

      if (alwaysError) {
        context.scope.pop()

        return { error: alwaysError }
      }

      if (isValid) {
        const result = await this.executeBranch(this.node.properties.onValid, context, invoker)

        if (result.error) {
          context.scope.pop()

          return { error: result.error }
        }

        outcomeResult = result.outcome
      } else {
        const result = await this.executeBranch(this.node.properties.onInvalid, context, invoker)

        if (result.error) {
          context.scope.pop()

          return { error: result.error }
        }

        outcomeResult = result.outcome
      }
    } else {
      // Skip validation transition
      const result = await this.executeBranch(this.node.properties.onAlways, context, invoker)

      if (result.error) {
        context.scope.pop()

        return { error: result.error }
      }

      outcomeResult = result.outcome
    }

    // Pop scope after effects are done
    context.scope.pop()

    return {
      value: this.buildResult(validate === true, isValid, outcomeResult),
    }
  }

  /**
   * Build the final result from outcome evaluation
   */
  private buildResult(
    validated: boolean,
    isValid: boolean | undefined,
    outcomeResult: OutcomeEvaluationResult,
  ): SubmitTransitionResult {
    const baseResult = {
      executed: true,
      validated,
      isValid,
    }

    if (outcomeResult.type === 'redirect') {
      return {
        ...baseResult,
        outcome: 'redirect' as const,
        redirect: outcomeResult.value,
      }
    }

    if (outcomeResult.type === 'error') {
      return {
        ...baseResult,
        outcome: 'error' as const,
        status: outcomeResult.value.status,
        message: outcomeResult.value.message,
      }
    }

    return {
      ...baseResult,
      outcome: 'continue' as const,
    }
  }

  /**
   * Evaluate the when predicate
   * Returns true if predicate passes or doesn't exist
   */
  private async evaluateWhenPredicate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<boolean> {
    const when = this.node.properties.when

    if (!isASTNode(when)) {
      return true
    }

    const result = await invoker.invoke(when.id, context)

    if (result.error) {
      return false
    }

    return Boolean(result.value)
  }

  /**
   * Evaluate the guards predicate
   * Returns true if predicate passes or doesn't exist
   */
  private async evaluateGuardsPredicate(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<boolean> {
    const guards = this.node.properties.guards

    if (!isASTNode(guards)) {
      return true
    }

    const result = await invoker.invoke(guards.id, context)

    if (result.error) {
      return false
    }

    return Boolean(result.value)
  }

  /**
   * Evaluate all validations for the current step by evaluating blocks
   * Returns true if all validations pass, false if any fail
   *
   * This method:
   * 1. Finds the parent step of this transition
   * 2. Finds all block nodes that belong to this step (by traversing their parent chain)
   * 3. Evaluates each block (which handles the dependent logic)
   * 4. Collects all validation results and checks if they all passed
   */
  private async evaluateValidations(
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<boolean> {
    try {
      // Step 1: Find the parent step of this transition
      const parentStepId = this.findParentStepIdForNode(this.nodeId, context)

      if (!parentStepId) {
        return true
      }

      // Step 2: Find all blocks that belong to this step
      const blockIds = this.findBlocksForStep(parentStepId, context)

      if (blockIds.length === 0) {
        return true
      }

      // Step 3: Evaluate all blocks
      const blockResults = await Promise.all(
        blockIds.map(async blockId => {
          const result = await invoker.invoke(blockId, context)

          if (result.error) {
            return { properties: { validate: [] } }
          }

          return result.value as { properties?: { validate?: Array<{ passed: boolean }> } }
        }),
      )

      // Step 4: Collect all validation results from evaluated blocks
      const allValidations = blockResults.flatMap(block => {
        if (!block.properties || !Array.isArray(block.properties.validate)) {
          return []
        }

        return block.properties.validate as Array<{ passed: boolean }>
      })

      if (allValidations.length === 0) {
        return true
      }

      // Check if all validations passed
      return allValidations.every(validation => validation.passed === true)
    } catch {
      return false
    }
  }

  /**
   * Find all block nodes that belong to a specific step
   *
   * Algorithm:
   * 1. Get all nodes from the registry
   * 2. Filter for BLOCK type nodes
   * 3. For each block, traverse up its parent chain until reaching a STEP
   * 4. If the step ID matches the target step, include this block
   */
  private findBlocksForStep(stepId: NodeId, context: ThunkEvaluationContext): NodeId[] {
    const blockIds: NodeId[] = []
    const allNodes = context.nodeRegistry.getAll()

    allNodes.forEach((node, nodeId) => {
      // Only consider BLOCK nodes
      if (node.type !== ASTNodeType.BLOCK) {
        return
      }

      // Traverse up to find the parent step
      const blockStepId = this.findParentStepIdForNode(nodeId, context)

      // If this block belongs to our target step, include it
      if (blockStepId === stepId) {
        blockIds.push(nodeId)
      }
    })

    return blockIds
  }

  /**
   * Find the parent Step ID for any given node by traversing up the parent chain
   */
  private findParentStepIdForNode(nodeId: NodeId, context: ThunkEvaluationContext): NodeId | undefined {
    const ancestors = getAncestorChain(nodeId, context.metadataRegistry)

    return ancestors.find(ancestorId => {
      const node = context.nodeRegistry.get(ancestorId)

      return node?.type === ASTNodeType.STEP
    })
  }

  /**
   * Execute effects immediately
   * Returns error if any effect fails
   */
  private async executeEffects(
    effects: unknown[] | undefined,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<ThunkError | undefined> {
    if (!effects) {
      return undefined
    }

    const effectNodes = effects.filter(isASTNode)

    // Execute effects sequentially (order matters)
    for (const effectNode of effectNodes) {
      // eslint-disable-next-line no-await-in-loop
      const result = await invoker.invoke(effectNode.id, context)

      if (result.error) {
        return result.error
      }
    }

    return undefined
  }

  /**
   * Execute effects and evaluate next outcomes from a branch
   *
   * IMPORTANT: Effects are executed FIRST, then outcomes are evaluated.
   * This ensures data set by effects is available when evaluating next expressions.
   */
  private async executeBranch(
    branch: { effects?: unknown[]; next?: unknown[] } | undefined,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<{ error?: ThunkError; outcome: OutcomeEvaluationResult }> {
    if (!branch) {
      return { outcome: { type: 'none' } }
    }

    // Execute effects FIRST
    const error = await this.executeEffects(branch.effects, context, invoker)

    if (error) {
      return { error, outcome: { type: 'none' } }
    }

    // THEN evaluate next outcomes (effects have already run, so Data('goalUuid') works)
    const outcome = branch.next ? await evaluateNextOutcomes(branch.next, context, invoker) : { type: 'none' as const }

    return { outcome }
  }

  private evaluateWhenPredicateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): boolean {
    const when = this.node.properties.when

    if (!isASTNode(when)) {
      return true
    }

    const result = invoker.invokeSync(when.id, context)

    if (result.error) {
      return false
    }

    return Boolean(result.value)
  }

  private evaluateGuardsPredicateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): boolean {
    const guards = this.node.properties.guards

    if (!isASTNode(guards)) {
      return true
    }

    const result = invoker.invokeSync(guards.id, context)

    if (result.error) {
      return false
    }

    return Boolean(result.value)
  }

  private evaluateValidationsSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): boolean {
    try {
      const parentStepId = this.findParentStepIdForNode(this.nodeId, context)

      if (!parentStepId) {
        return true
      }

      const blockIds = this.findBlocksForStep(parentStepId, context)

      if (blockIds.length === 0) {
        return true
      }

      const blockResults = blockIds.map(blockId => {
        const result = invoker.invokeSync(blockId, context)

        if (result.error) {
          return { properties: { validate: [] } }
        }

        return result.value as { properties?: { validate?: Array<{ passed: boolean }> } }
      })

      const allValidations = blockResults.flatMap(block => {
        if (!block.properties || !Array.isArray(block.properties.validate)) {
          return []
        }

        return block.properties.validate as Array<{ passed: boolean }>
      })

      if (allValidations.length === 0) {
        return true
      }

      return allValidations.every(validation => validation.passed === true)
    } catch {
      return false
    }
  }

  private executeEffectsSync(
    effects: unknown[] | undefined,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): ThunkError | undefined {
    if (!effects) {
      return undefined
    }

    const effectNodes = effects.filter(isASTNode)

    // Execute effects sequentially (order matters)
    for (const effectNode of effectNodes) {
      const result = invoker.invokeSync(effectNode.id, context)

      if (result.error) {
        return result.error
      }
    }

    return undefined
  }

  private executeBranchSync(
    branch: { effects?: unknown[]; next?: unknown[] } | undefined,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): { error?: ThunkError; outcome: OutcomeEvaluationResult } {
    if (!branch) {
      return { outcome: { type: 'none' } }
    }

    // Execute effects FIRST
    const error = this.executeEffectsSync(branch.effects, context, invoker)

    if (error) {
      return { error, outcome: { type: 'none' } }
    }

    // THEN evaluate next outcomes
    const outcome = branch.next ? evaluateNextOutcomesSync(branch.next, context, invoker) : { type: 'none' as const }

    return { outcome }
  }

}
