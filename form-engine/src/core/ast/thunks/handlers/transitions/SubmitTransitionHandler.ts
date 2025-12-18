import { NodeId } from '@form-engine/core/types/engine.type'
import { SubmitTransitionASTNode } from '@form-engine/core/types/expressions.type'
import {
  HybridThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  CapturedEffect,
  MetadataComputationDependencies,
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

  /**
   * Captured effects to be committed after interpretation validates the request
   * Effects are captured with their evaluated arguments, deferred for later execution
   */
  pendingEffects?: CapturedEffect[]
}

/**
 * Handler for Submit Transition nodes
 *
 * Evaluates onSubmission transitions by:
 * 1. Checking when/guards predicates
 * 2. Running validation if validate=true
 * 3. Executing appropriate branch (onAlways, onValid, or onInvalid)
 * 4. Evaluating next expressions for navigation
 *
 * ## Wiring Pattern
 * - when → transition (must evaluate before transition)
 * - guards → transition (must evaluate before transition)
 * - validations → transition (if validate=true)
 * - effects are chained sequentially within each branch
 * - next expressions are chained sequentially within each branch
 *
 * ## Validation Logic
 * If validate=true:
 * - Evaluates all validation nodes attached to parent step
 * - If all validations pass: executes onValid branch
 * - If any validation fails: executes onInvalid branch
 * - Always executes onAlways branch
 *
 * If validate=false:
 * - Skips validation
 * - Executes onAlways branch
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

    // Collect effects and next from appropriate branch (capture effects without executing)
    let next: string | undefined
    const pendingEffects: CapturedEffect[] = []

    if (validate === true) {
      // Validating transition
      const onAlwaysEffects = this.captureEffectsSync(this.node.properties.onAlways?.effects, context, invoker)
      pendingEffects.push(...onAlwaysEffects)

      if (isValid) {
        const { effects, next: branchNext } = this.collectBranchSync(this.node.properties.onValid, context, invoker)

        pendingEffects.push(...effects)
        next = branchNext
      } else {
        const { effects, next: branchNext } = this.collectBranchSync(this.node.properties.onInvalid, context, invoker)

        pendingEffects.push(...effects)
        next = branchNext
      }
    } else {
      // Skip validation transition
      const { effects, next: branchNext } = this.collectBranchSync(this.node.properties.onAlways, context, invoker)

      pendingEffects.push(...effects)
      next = branchNext
    }

    return {
      value: {
        executed: true,
        validated: validate === true,
        isValid,
        next,
        pendingEffects: pendingEffects.length > 0 ? pendingEffects : undefined,
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

    // Collect effects and next from appropriate branch (capture effects without executing)
    let next: string | undefined
    const pendingEffects: CapturedEffect[] = []

    if (validate === true) {
      // Validating transition
      const onAlwaysEffects = await this.captureEffects(this.node.properties.onAlways?.effects, context, invoker)
      pendingEffects.push(...onAlwaysEffects)

      if (isValid) {
        const { effects, next: branchNext } = await this.collectBranch(this.node.properties.onValid, context, invoker)

        pendingEffects.push(...effects)
        next = branchNext
      } else {
        const { effects, next: branchNext } = await this.collectBranch(this.node.properties.onInvalid, context, invoker)

        pendingEffects.push(...effects)
        next = branchNext
      }
    } else {
      // Skip validation transition
      const { effects, next: branchNext } = await this.collectBranch(this.node.properties.onAlways, context, invoker)

      pendingEffects.push(...effects)
      next = branchNext
    }

    return {
      value: {
        executed: true,
        validated: validate === true,
        isValid,
        next,
        pendingEffects: pendingEffects.length > 0 ? pendingEffects : undefined,
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
   * Capture effects by invoking their handlers (returns CapturedEffect, not executed)
   *
   * Invokes each effect node's EffectHandler which returns a CapturedEffect
   * containing the effect name and already-evaluated arguments. The effect
   * function itself is NOT executed - only captured for later commit.
   */
  private async captureEffects(
    effects: unknown[] | undefined,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<CapturedEffect[]> {
    if (!effects) {
      return []
    }

    const effectNodes = effects.filter(isASTNode)

    const results = await Promise.all(
      effectNodes.map(effectNode => invoker.invoke<CapturedEffect>(effectNode.id, context)),
    )

    return results.filter(result => !result.error && result.value).map(result => result.value!)
  }

  /**
   * Collect effects and evaluate next from a branch
   * Returns captured effects (deferred) and the navigation target
   */
  private async collectBranch(
    branch: { effects?: unknown[]; next?: unknown[] } | undefined,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): Promise<{ effects: CapturedEffect[]; next: string | undefined }> {
    if (!branch) {
      return { effects: [], next: undefined }
    }

    const effects = await this.captureEffects(branch.effects, context, invoker)
    const next = branch.next ? await this.evaluateNext(branch.next, context, invoker) : undefined

    return { effects, next }
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

  private captureEffectsSync(
    effects: unknown[] | undefined,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): CapturedEffect[] {
    if (!effects) {
      return []
    }

    return effects
      .filter(isASTNode)
      .map(effectNode => invoker.invokeSync<CapturedEffect>(effectNode.id, context))
      .filter(result => !result.error && result.value)
      .map(result => result.value!)
  }

  private collectBranchSync(
    branch: { effects?: unknown[]; next?: unknown[] } | undefined,
    context: ThunkEvaluationContext,
    invoker: ThunkInvocationAdapter,
  ): { effects: CapturedEffect[]; next: string | undefined } {
    if (!branch) {
      return { effects: [], next: undefined }
    }

    const effects = this.captureEffectsSync(branch.effects, context, invoker)
    const next = branch.next ? this.evaluateNextSync(branch.next, context, invoker) : undefined

    return { effects, next }
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
