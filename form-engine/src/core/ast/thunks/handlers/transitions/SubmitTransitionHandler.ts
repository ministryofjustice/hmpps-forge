import { NodeId } from '@form-engine/core/types/engine.type'
import { SubmitTransitionASTNode } from '@form-engine/core/types/expressions.type'
import {
  HybridThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
  ThunkError,
} from '@form-engine/core/ast/thunks/types'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import ThunkEvaluationContext from '@form-engine/core/ast/thunks/ThunkEvaluationContext'
import { ASTNodeType } from '@form-engine/core/types/enums'
import {
  evaluateUntilFirstMatch,
  evaluateUntilFirstMatchSync,
} from '@form-engine/core/ast/thunks/handlers/utils/evaluation'
import getAncestorChain from '@form-engine/core/ast/utils/getAncestorChain'

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
   * Navigation target (from next expressions)
   */
  next?: string
}

/**
 * Handler for Submit Transition nodes
 *
 * Evaluates onSubmission transitions by:
 * 1. Checking when/guards predicates
 * 2. Running validation if validate=true
 * 3. Pushing @transitionType: 'submit' onto scope for effect execution
 * 4. Executing effects from appropriate branch (effects run immediately)
 * 5. Evaluating next expressions for navigation (AFTER effects have run)
 *
 * ## Key Design: Effects Execute Before Next
 * Effects are executed BEFORE next expressions are evaluated. This ensures
 * that data set by effects (e.g., goalUuid) is available when evaluating
 * next expressions that reference that data (e.g., Format('goal/%1', Data('goalUuid'))).
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
export default class SubmitTransitionHandler implements HybridThunkHandler {
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

      // Check next expressions in branch
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
    let next: string | undefined

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

        next = result.next
      } else {
        const result = this.executeBranchSync(this.node.properties.onInvalid, context, invoker)

        if (result.error) {
          context.scope.pop()

          return { error: result.error }
        }

        next = result.next
      }
    } else {
      // Skip validation transition
      const result = this.executeBranchSync(this.node.properties.onAlways, context, invoker)

      if (result.error) {
        context.scope.pop()

        return { error: result.error }
      }

      next = result.next
    }

    // Pop scope after effects are done
    context.scope.pop()

    return {
      value: {
        executed: true,
        validated: validate === true,
        isValid,
        next,
      },
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
    let next: string | undefined

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

        next = result.next
      } else {
        const result = await this.executeBranch(this.node.properties.onInvalid, context, invoker)

        if (result.error) {
          context.scope.pop()

          return { error: result.error }
        }

        next = result.next
      }
    } else {
      // Skip validation transition
      const result = await this.executeBranch(this.node.properties.onAlways, context, invoker)

      if (result.error) {
        context.scope.pop()

        return { error: result.error }
      }

      next = result.next
    }

    // Pop scope after effects are done
    context.scope.pop()

    return {
      value: {
        executed: true,
        validated: validate === true,
        isValid,
        next,
      },
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
   * Execute effects and evaluate next from a branch
   *
   * IMPORTANT: Effects are executed FIRST, then next is evaluated.
   * This ensures data set by effects is available when evaluating next expressions.
   */
  private async executeBranch(
    branch: { effects?: unknown[]; next?: unknown[] } | undefined,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<{ error?: ThunkError; next: string | undefined }> {
    if (!branch) {
      return { next: undefined }
    }

    // Execute effects FIRST
    const error = await this.executeEffects(branch.effects, context, invoker)

    if (error) {
      return { error, next: undefined }
    }

    // THEN evaluate next (effects have already run, so Data('goalUuid') works)
    const next = branch.next ? await this.evaluateNext(branch.next, context, invoker) : undefined

    return { next }
  }

  /**
   * Evaluate next expressions to determine navigation target
   * Returns the first non-undefined result
   */
  private async evaluateNext(
    nextExpressions: unknown[],
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<string | undefined> {
    const nextIds = nextExpressions.filter(isASTNode).map(node => node.id)
    const result = await evaluateUntilFirstMatch(nextIds, context, invoker)

    return result !== undefined ? String(result) : undefined
  }

  // Sync versions of private methods

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
  ): { error?: ThunkError; next: string | undefined } {
    if (!branch) {
      return { next: undefined }
    }

    // Execute effects FIRST
    const error = this.executeEffectsSync(branch.effects, context, invoker)

    if (error) {
      return { error, next: undefined }
    }

    // THEN evaluate next
    const next = branch.next ? this.evaluateNextSync(branch.next, context, invoker) : undefined

    return { next }
  }

  private evaluateNextSync(
    nextExpressions: unknown[],
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): string | undefined {
    const nextIds = nextExpressions.filter(isASTNode).map(node => node.id)
    const result = evaluateUntilFirstMatchSync(nextIds, context, invoker)

    return result !== undefined ? String(result) : undefined
  }
}
