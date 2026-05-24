import { FunctionType, HookType } from '../../../../../authoring/types/enums'
import { ASTNode } from '../../../../types/ast.type'
import { ASTNodeType } from '../../../../types/enums'
import {
  AccessHookASTNode,
  FunctionASTNode,
  RedirectOutcomeASTNode,
  SubmitHookASTNode,
  ThrowErrorOutcomeASTNode,
} from '../../../../types/expressions.type'
import { JourneyASTNode, StepASTNode } from '../../../../types/structures.type'
import { HookType as RuntimeHookType } from '../../../../runtime/types/AnswerHistory.type'
import EffectFunctionContextCtor from '../../../../nodes/expressions/effect/EffectFunctionContext'
import NodeCompilationDispatcher from '../../expressions/NodeCompilationDispatcher'
import CodeEmitter from '../../emitters/CodeEmitter'
import { buildGeneratedSource, compileGeneratedFunction } from '../../generated-functions/GeneratedFunctionCompiler'
import type { CompilationDependencies } from '../../compilationDependencies.type'
import { isRedirectOutcomeNode, isThrowErrorOutcomeNode } from '../../../../typeguards/outcome-nodes'
import type {
  CompiledAccessHookResult,
  CompiledAccessLifecycleFunction,
  CompiledSubmitHookResult,
  CompiledSubmitHooksFunction,
  HookLifecycleContext,
} from '../../../../types/hookLifecycle.type'

type GeneratedAccessLifecycleFunction = (
  ctx: HookLifecycleContext,
  EffectFunctionContext: typeof EffectFunctionContextCtor,
) => CompiledAccessHookResult | Promise<CompiledAccessHookResult>

type GeneratedSubmitHooksFunction = (
  ctx: HookLifecycleContext,
  EffectFunctionContext: typeof EffectFunctionContextCtor,
) => CompiledSubmitHookResult | Promise<CompiledSubmitHookResult>

/**
 * Compiles access and submit hook lifecycles into generated functions.
 *
 * Hook ordering and branching are fixed by the AST, so the compiler emits that
 * control flow directly: when/guard predicates, effect calls, validation branch
 * selection, and redirect/error outcomes. The generated hook functions are
 * forced async because effects are side-effectful and may be asynchronous even
 * when their registry metadata is absent or sync.
 */
export default class HookLifecycleCompiler {
  private readonly expr: NodeCompilationDispatcher

  constructor(dependencies: CompilationDependencies) {
    this.expr = new NodeCompilationDispatcher(dependencies)
  }

  /**
   * Builds the generated access lifecycle for the journey/step ancestor chain.
   */
  compileAccessLifecycle(
    accessAncestors: (JourneyASTNode | StepASTNode)[],
  ): CompiledAccessLifecycleFunction | undefined {
    const generated = compileGeneratedFunction<GeneratedAccessLifecycleFunction>(
      this.expr,
      ['ctx', 'EffectFunctionContext'],
      () => this.buildAccessSource(accessAncestors),
      { forceAsync: true, phase: 'hooks' },
    )

    return ctx => generated(ctx, EffectFunctionContextCtor)
  }

  /**
   * Builds the generated submit lifecycle for one step's submit hooks.
   */
  compileSubmitHooks(hooks: SubmitHookASTNode[]): CompiledSubmitHooksFunction | undefined {
    const generated = compileGeneratedFunction<GeneratedSubmitHooksFunction>(
      this.expr,
      ['ctx', 'EffectFunctionContext'],
      () => this.buildSubmitSource(hooks),
      { forceAsync: true, phase: 'hooks' },
    )

    return ctx => generated(ctx, EffectFunctionContextCtor)
  }

  /**
   * Produces inspectable generated access source for tests and local debugging.
   */
  generateAccessSource(accessAncestors: (JourneyASTNode | StepASTNode)[]): string {
    return buildGeneratedSource(this.expr, () => this.buildAccessSource(accessAncestors))
  }

  /**
   * Produces inspectable generated submit source for tests and local debugging.
   */
  generateSubmitSource(hooks: SubmitHookASTNode[]): string {
    return buildGeneratedSource(this.expr, () => this.buildSubmitSource(hooks))
  }

  /**
   * Emits access hooks in ancestor order, stopping at the first generated return.
   */
  private buildAccessSource(accessAncestors: (JourneyASTNode | StepASTNode)[]): string {
    const emitter = this.createEmitter()

    emitter.comment('HookLifecycleCompiler.buildAccessSource')
    accessAncestors.forEach(ancestor => {
      ;(ancestor.properties.onAccess ?? []).forEach(hook => {
        this.compileAccessHook(hook, emitter)
      })
    })

    emitter.return('{ executed: true, outcome: "continue" }')

    return emitter.toString()
  }

  /**
   * Emits submit hooks in declaration order, falling through when no hook executes.
   */
  private buildSubmitSource(hooks: SubmitHookASTNode[]): string {
    const emitter = this.createEmitter()

    emitter.comment('HookLifecycleCompiler.buildSubmitSource')
    hooks.forEach(hook => {
      this.compileSubmitHook(hook, emitter)
    })

    emitter.return('{ executed: false, validated: false, outcome: "continue" }')

    return emitter.toString()
  }

  /**
   * Creates the shared hook emitter with the generated function prologue.
   */
  private createEmitter(): CodeEmitter {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')

    return emitter
  }

  /**
   * Emits one access hook, returning early only when the hook produces an outcome.
   */
  private compileAccessHook(hook: AccessHookASTNode, emitter: CodeEmitter): void {
    emitter.comment('HookLifecycleCompiler.compileAccessHook')
    emitter.scope(() => {
      const whenVar = this.compilePredicate(hook.properties.when, true, emitter, 'whenPredicate')

      emitter.if(whenVar, () => {
        this.compileEffects(hook.properties.effects, HookType.ACCESS, emitter)
        this.compileOutcomeReturns(hook.properties.next, emitter, 'executed: true, ')
      })
    })
  }

  /**
   * Emits one submit hook, including when and guard predicates before branch handling.
   */
  private compileSubmitHook(hook: SubmitHookASTNode, emitter: CodeEmitter): void {
    emitter.comment('HookLifecycleCompiler.compileSubmitHook')
    emitter.scope(() => {
      const whenVar = this.compilePredicate(hook.properties.when, true, emitter, 'whenPredicate')

      emitter.if(whenVar, () => {
        const guardsVar = this.compilePredicate(hook.properties.guards, true, emitter, 'guardPredicate')

        emitter.if(guardsVar, () => {
          if (hook.properties.validate) {
            this.compileValidatedSubmitBranches(hook, emitter)

            return
          }

          this.compileNonValidatingSubmitBranch(hook, emitter)
        })
      })
    })
  }

  /**
   * Emits validating submit handling: onAlways, validation, then valid/invalid branch.
   */
  private compileValidatedSubmitBranches(hook: SubmitHookASTNode, emitter: CodeEmitter): void {
    emitter.comment('HookLifecycleCompiler.compileValidatedSubmitBranches')
    const alwaysOutcomeVar = this.compileBranch(hook.properties.onAlways, HookType.SUBMIT, emitter)
    const validationGroups =
      hook.properties.validationGroups !== undefined && hook.properties.validationGroups.length > 0
        ? hook.properties.validationGroups
        : ['default']

    emitter.ifChain(
      [
        {
          condition: `${alwaysOutcomeVar} && ${alwaysOutcomeVar}.type === "redirect"`,
          body: () =>
            emitter.return(
              `{ executed: true, validated: false, outcome: "redirect", redirect: ${alwaysOutcomeVar}.value }`,
            ),
        },
        {
          condition: `${alwaysOutcomeVar} && ${alwaysOutcomeVar}.type === "error"`,
          body: () =>
            emitter.return(
              `{ executed: true, validated: false, outcome: "error", status: ${alwaysOutcomeVar}.value.status, message: ${alwaysOutcomeVar}.value.message }`,
            ),
        },
      ],
      () => {
        emitter.if('!ctx.validate', () => {
          emitter.code('throw new Error("[Forge] Submit validation callback is missing");')
        })

        const validationResultVar = emitter.const(
          'validationResult',
          `await ctx.validate(${JSON.stringify(validationGroups)})`,
        )
        const validVar = emitter.const('isValid', `${validationResultVar}.isValid`)
        const branchOutcomeVar = emitter.let('branchOutcome')

        this.compileValidationOutcomeBranches(hook, validVar, branchOutcomeVar, emitter)
        this.emitSubmitReturn(true, validVar, branchOutcomeVar, emitter)
      },
    )
  }

  /**
   * Emits only the branch matching the validation result when such a branch exists.
   */
  private compileValidationOutcomeBranches(
    hook: SubmitHookASTNode,
    validVar: string,
    branchOutcomeVar: string,
    emitter: CodeEmitter,
  ): void {
    if (hook.properties.onValid !== undefined && hook.properties.onInvalid !== undefined) {
      emitter.if(
        validVar,
        () =>
          this.compileBranchIntoExistingOutcome(hook.properties.onValid, HookType.SUBMIT, branchOutcomeVar, emitter),
        () =>
          this.compileBranchIntoExistingOutcome(hook.properties.onInvalid, HookType.SUBMIT, branchOutcomeVar, emitter),
      )

      return
    }

    if (hook.properties.onValid !== undefined) {
      emitter.if(validVar, () =>
        this.compileBranchIntoExistingOutcome(hook.properties.onValid, HookType.SUBMIT, branchOutcomeVar, emitter),
      )

      return
    }

    if (hook.properties.onInvalid !== undefined) {
      emitter.if(`!${validVar}`, () =>
        this.compileBranchIntoExistingOutcome(hook.properties.onInvalid, HookType.SUBMIT, branchOutcomeVar, emitter),
      )
    }
  }

  /**
   * Emits submit handling for hooks that do not invoke validation.
   */
  private compileNonValidatingSubmitBranch(hook: SubmitHookASTNode, emitter: CodeEmitter): void {
    emitter.comment('HookLifecycleCompiler.compileNonValidatingSubmitBranch')
    const outcomeVar = this.compileBranch(hook.properties.onAlways, HookType.SUBMIT, emitter)

    this.emitSubmitReturn(false, undefined, outcomeVar, emitter)
  }

  /**
   * Emits one branch into a mutable outcome slot so later branches can short-circuit.
   */
  private compileBranch(
    branch: { effects?: ASTNode[]; next?: ASTNode[] } | undefined,
    hookType: HookType,
    emitter: CodeEmitter,
  ): string {
    const outcomeVar = emitter.let('outcome')

    this.compileBranchIntoExistingOutcome(branch, hookType, outcomeVar, emitter)

    return outcomeVar
  }

  /**
   * Emits a branch's effects before resolving its first matching outcome.
   */
  private compileBranchIntoExistingOutcome(
    branch: { effects?: ASTNode[]; next?: ASTNode[] } | undefined,
    hookType: HookType,
    outcomeVar: string,
    emitter: CodeEmitter,
  ): void {
    if (branch === undefined) {
      return
    }

    this.compileEffects(branch.effects, hookType, emitter)
    this.compileOutcomeAssignment(branch.next, outcomeVar, emitter)
  }

  /**
   * Emits an optional hook predicate as a named boolean guard.
   */
  private compilePredicate(
    predicate: ASTNode | undefined,
    defaultValue: boolean,
    emitter: CodeEmitter,
    prefix: string,
  ): string {
    if (predicate === undefined) {
      return emitter.const(prefix, JSON.stringify(defaultValue))
    }

    const predicateExpr = this.expr.compileExpression(predicate)

    return emitter.const(prefix, `Boolean(${predicateExpr})`)
  }

  /**
   * Emits effect invocation with the runtime hook context expected by effect functions.
   */
  private compileEffects(effects: ASTNode[] | undefined, hookType: HookType, emitter: CodeEmitter): void {
    if (effects === undefined || effects.length === 0) {
      return
    }

    emitter.comment('HookLifecycleCompiler.compileEffects')
    const effectCtxVar = emitter.const(
      'effectContext',
      `new EffectFunctionContext(ctx.effectContext, ${JSON.stringify(this.toRuntimeHookType(hookType))})`,
    )

    effects
      .filter(this.isEffectNode)
      .forEach(effect => {
        const callExpr = this.compileAwaitedEffectCall(effect, effectCtxVar)

        emitter.code(`${callExpr};`)
      })
  }

  /**
   * Normalises sync and async effect calls into a single awaited statement.
   */
  private compileAwaitedEffectCall(effect: FunctionASTNode, effectCtxVar: string): string {
    const callExpr = this.compileEffectCall(effect, effectCtxVar)

    if (callExpr.startsWith('(await ') && callExpr.endsWith(')')) {
      return `await ${callExpr.slice('(await '.length, -1)}`
    }

    return `await ${callExpr}`
  }

  /**
   * Builds the authored effect function call with the hook effect context prepended.
   */
  private compileEffectCall(effect: FunctionASTNode, effectCtxVar: string): string {
    const funcName = effect.properties.name
    const argExprs = effect.properties.arguments.map(arg => this.expr.compileOperand(arg))

    return this.expr.compileFunctionCall(funcName, [effectCtxVar, ...argExprs], effect)
  }

  /**
   * Emits access-style outcome returns after branch outcome resolution.
   */
  private compileOutcomeReturns(next: ASTNode[] | undefined, emitter: CodeEmitter, prefix: string): void {
    const outcomeVar = emitter.let('outcome')

    this.compileOutcomeAssignment(next, outcomeVar, emitter)
    emitter.if(`${outcomeVar} && ${outcomeVar}.type === "redirect"`, () => {
      emitter.return(`{ ${prefix}outcome: "redirect", redirect: ${outcomeVar}.value }`)
    })
    emitter.if(`${outcomeVar} && ${outcomeVar}.type === "error"`, () => {
      emitter.return(
        `{ ${prefix}outcome: "error", status: ${outcomeVar}.value.status, message: ${outcomeVar}.value.message }`,
      )
    })
  }

  /**
   * Emits first-match outcome resolution for redirect and throwError outcomes.
   */
  private compileOutcomeAssignment(next: ASTNode[] | undefined, outcomeVar: string, emitter: CodeEmitter): void {
    if (next === undefined || next.length === 0) {
      return
    }

    next.filter(this.isOutcomeNode).forEach(outcome => {
      emitter.if(`${outcomeVar} === undefined`, () => {
        if (isRedirectOutcomeNode(outcome)) {
          this.compileRedirectOutcome(outcome, outcomeVar, emitter)

          return
        }

        if (isThrowErrorOutcomeNode(outcome)) {
          this.compileThrowErrorOutcome(outcome, outcomeVar, emitter)
        }
      })
    })
  }

  /**
   * Emits redirect outcome value resolution into the current outcome slot.
   */
  private compileRedirectOutcome(outcome: RedirectOutcomeASTNode, outcomeVar: string, emitter: CodeEmitter): void {
    const whenVar = this.compilePredicate(outcome.properties.when, true, emitter, 'outcomeWhen')

    emitter.if(whenVar, () => {
      const gotoExpr = this.compileOutcomeValue(outcome.properties.goto)
      const gotoVar = emitter.const('gotoValue', gotoExpr)

      emitter.if(`${gotoVar} !== undefined`, () => {
        emitter.assign(outcomeVar, `{ type: "redirect", value: String(${gotoVar}) }`)
      })
    })
  }

  /**
   * Emits error outcome value resolution into the current outcome slot.
   */
  private compileThrowErrorOutcome(outcome: ThrowErrorOutcomeASTNode, outcomeVar: string, emitter: CodeEmitter): void {
    const whenVar = this.compilePredicate(outcome.properties.when, true, emitter, 'outcomeWhen')

    emitter.if(whenVar, () => {
      const messageExpr = this.compileOutcomeValue(outcome.properties.message)
      const messageVar = emitter.const('messageValue', messageExpr)

      emitter.assign(
        outcomeVar,
        `{ type: "error", value: { status: ${JSON.stringify(outcome.properties.status)}, message: ${messageVar} !== undefined ? String(${messageVar}) : "" } }`,
      )
    })
  }

  /**
   * Resolves static outcome literals or compiled outcome expressions.
   */
  private compileOutcomeValue(value: ASTNode | string): string {
    if (typeof value === 'string') {
      return JSON.stringify(value)
    }

    return this.expr.compileExpression(value)
  }

  /**
   * Emits the final submit hook result from a resolved outcome slot.
   */
  private emitSubmitReturn(
    validated: boolean,
    validVar: string | undefined,
    outcomeVar: string,
    emitter: CodeEmitter,
  ): void {
    const validPart = validVar === undefined ? '' : `, isValid: ${validVar}`

    emitter.ifChain(
      [
        {
          condition: `${outcomeVar} && ${outcomeVar}.type === "redirect"`,
          body: () =>
            emitter.return(
              `{ executed: true, validated: ${JSON.stringify(validated)}${validPart}, outcome: "redirect", redirect: ${outcomeVar}.value }`,
            ),
        },
        {
          condition: `${outcomeVar} && ${outcomeVar}.type === "error"`,
          body: () =>
            emitter.return(
              `{ executed: true, validated: ${JSON.stringify(validated)}${validPart}, outcome: "error", status: ${outcomeVar}.value.status, message: ${outcomeVar}.value.message }`,
            ),
        },
      ],
      () => {
        emitter.return(`{ executed: true, validated: ${JSON.stringify(validated)}${validPart}, outcome: "continue" }`)
      },
    )
  }

  /**
   * Narrows authored expressions to effect function nodes before emitting calls.
   */
  private isEffectNode(node: ASTNode): node is FunctionASTNode {
    return node.type === ASTNodeType.EXPRESSION &&
      (node as { expressionType?: unknown }).expressionType === FunctionType.EFFECT
  }

  /**
   * Narrows authored outcomes to the outcome types supported by generated hooks.
   */
  private isOutcomeNode(node: ASTNode): node is RedirectOutcomeASTNode | ThrowErrorOutcomeASTNode {
    return isRedirectOutcomeNode(node) || isThrowErrorOutcomeNode(node)
  }

  /**
   * Maps authoring hook phases to the answer-history mutation source used by effects.
   */
  private toRuntimeHookType(hookType: HookType): RuntimeHookType {
    switch (hookType) {
      case HookType.SUBMIT:
        return 'submit'
      case HookType.ACCESS:
      default:
        return 'access'
    }
  }
}
