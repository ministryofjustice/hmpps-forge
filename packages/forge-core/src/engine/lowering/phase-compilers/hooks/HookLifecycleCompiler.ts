import { FunctionType } from '../../../../authoring/types/enums'
import { ASTNode } from '../../../contracts/ast/ast.type'
import { ASTNodeType } from '../../../contracts/ast/enums'
import {
  AccessHookASTNode,
  FunctionASTNode,
  RedirectOutcomeASTNode,
  SubmitHookASTNode,
  ThrowErrorOutcomeASTNode,
} from '../../../contracts/ast/expressions.type'
import ExpressionDispatcher from '../../expressions/ExpressionDispatcher'
import CodeEmitter from '../../emitters/CodeEmitter'
import { compileGeneratedFunction } from '../../function-construction/GeneratedFunctionCompiler'
import type { CompilationDependencies } from '../../compilationDependencies.type'
import { isRedirectOutcomeNode, isThrowErrorOutcomeNode } from '../../../contracts/ast/outcome-nodes'
import type {
  CompiledAccessHookFunction,
  CompiledSubmitHookFunction,
} from '../../../contracts/compiled/compiledFunctions.type'
import type { CompiledAccessHook, CompiledSubmitHook } from '../../../contracts/plans/compilationArtefacts.type'

/**
 * Lowers a single access or submit hook AST node into a self-contained compiled
 * function. Each hook's generated body is forced async because effect calls are
 * always awaited; the runtime invokes the result with a {@link HookLifecycleContext}
 * and acts on the returned outcome ('continue' | 'redirect' | 'error').
 */
export default class HookLifecycleCompiler {
  private readonly expr: ExpressionDispatcher

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
  }

  /**
   * Compiles one access hook into an CompiledAccessHook carrying the hook node's id
   * and its compiled function. The hook's `when` predicate gates its effects and
   * outcome resolution; when no outcome resolves to a redirect or error the
   * function falls through to `{ executed: true, outcome: "continue" }`.
   */
  compileAccessHook(hook: AccessHookASTNode): CompiledAccessHook {
    return {
      nodeId: hook.id,
      evaluate: compileGeneratedFunction<CompiledAccessHookFunction>(
        this.expr,
        ['ctx'],
        () => this.buildAccessHookSource(hook),
        { forceAsync: true, phase: 'hooks' },
      )!,
    }
  }

  /**
   * Emits the access hook body: a `when` guard wrapping the awaited effect calls
   * and outcome returns, with a trailing 'continue' return for the unmatched path.
   */
  private buildAccessHookSource(hook: AccessHookASTNode): string {
    const emitter = this.createEmitter()

    const whenVar = this.compilePredicate(hook.properties.when, true, emitter, 'whenPredicate')

    emitter.if(whenVar, () => {
      this.compileEffects(hook.properties.effects, emitter)
      this.compileOutcomeReturns(hook.properties.next, emitter, 'executed: true, ')
    })

    emitter.return('{ executed: true, outcome: "continue" }')

    return emitter.toString()
  }

  /**
   * Compiles one submit hook into a CompiledSubmitHook carrying the hook node's id
   * and its compiled function. The hook runs only when both its `when` and
   * `guards` predicates pass; a validating hook awaits `ctx.validate` and
   * branches on the result, while a non-validating hook applies its `onAlways`
   * branch directly. When either predicate does not pass the function falls
   * through to `{ executed: false, validated: false, outcome: "continue" }`.
   */
  compileSubmitHook(hook: SubmitHookASTNode): CompiledSubmitHook {
    return {
      nodeId: hook.id,
      evaluate: compileGeneratedFunction<CompiledSubmitHookFunction>(
        this.expr,
        ['ctx'],
        () => this.buildSubmitHookSource(hook),
        { forceAsync: true, phase: 'hooks' },
      )!,
    }
  }

  /**
   * Emits the submit hook body: nested `when` and `guards` guards selecting either
   * the validated branch set or the single non-validating branch, with a trailing
   * unexecuted 'continue' return for the path where `when` or `guards` block the hook.
   */
  private buildSubmitHookSource(hook: SubmitHookASTNode): string {
    const emitter = this.createEmitter()

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

    emitter.return('{ executed: false, validated: false, outcome: "continue" }')

    return emitter.toString()
  }

  /** Creates a fresh CodeEmitter primed with a `"use strict"` directive. */
  private createEmitter(): CodeEmitter {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')

    return emitter
  }

  /**
   * Emits the validating submit path. The `onAlways` branch runs first; if it yields
   * a redirect or error the function returns immediately without validating. Otherwise
   * it awaits `ctx.validate` (defaulting to the `['default']` group when none are
   * configured), then applies the onValid/onInvalid branches via
   * {@link compileValidationOutcomeBranches}. Throws at runtime if `ctx.validate` is absent.
   */
  private compileValidatedSubmitBranches(hook: SubmitHookASTNode, emitter: CodeEmitter): void {
    emitter.comment('HookLifecycleCompiler.compileValidatedSubmitBranches')
    const alwaysOutcomeVar = this.compileBranch(hook.properties.onAlways, emitter)
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
        this.emitSubmitReturn(true, branchOutcomeVar, emitter)
      },
    )
  }

  /**
   * Emits the conditional that folds the chosen validation branch into
   * `branchOutcomeVar`, picking onValid/onInvalid by the runtime `validVar` flag.
   * Only the branches the hook actually declares are emitted; an absent branch
   * leaves the outcome variable untouched for that validity case.
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
        () => this.compileBranchIntoExistingOutcome(hook.properties.onValid, branchOutcomeVar, emitter),
        () => this.compileBranchIntoExistingOutcome(hook.properties.onInvalid, branchOutcomeVar, emitter),
      )

      return
    }

    if (hook.properties.onValid !== undefined) {
      emitter.if(validVar, () =>
        this.compileBranchIntoExistingOutcome(hook.properties.onValid, branchOutcomeVar, emitter),
      )

      return
    }

    if (hook.properties.onInvalid !== undefined) {
      emitter.if(`!${validVar}`, () =>
        this.compileBranchIntoExistingOutcome(hook.properties.onInvalid, branchOutcomeVar, emitter),
      )
    }
  }

  /**
   * Emits the non-validating submit path: runs the `onAlways` branch and returns
   * its outcome with `validated: false`.
   */
  private compileNonValidatingSubmitBranch(hook: SubmitHookASTNode, emitter: CodeEmitter): void {
    emitter.comment('HookLifecycleCompiler.compileNonValidatingSubmitBranch')
    const outcomeVar = this.compileBranch(hook.properties.onAlways, emitter)

    this.emitSubmitReturn(false, outcomeVar, emitter)
  }

  /**
   * Declares a fresh `outcome` let, folds the branch's effects and outcome into it,
   * and returns the variable name so callers can inspect the resolved outcome.
   */
  private compileBranch(branch: { effects?: ASTNode[]; next?: ASTNode[] } | undefined, emitter: CodeEmitter): string {
    const outcomeVar = emitter.let('outcome')

    this.compileBranchIntoExistingOutcome(branch, outcomeVar, emitter)

    return outcomeVar
  }

  /**
   * Emits a branch's awaited effects followed by its outcome assignment into an
   * existing outcome variable. A missing branch emits nothing.
   */
  private compileBranchIntoExistingOutcome(
    branch: { effects?: ASTNode[]; next?: ASTNode[] } | undefined,
    outcomeVar: string,
    emitter: CodeEmitter,
  ): void {
    if (branch === undefined) {
      return
    }

    this.compileEffects(branch.effects, emitter)
    this.compileOutcomeAssignment(branch.next, outcomeVar, emitter)
  }

  /**
   * Declares a const holding a boolean predicate result and returns its name. An
   * absent predicate emits the literal `defaultValue`; otherwise the compiled
   * expression is coerced with `Boolean(...)`.
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
   * Emits one awaited effect call per effect node, in declaration order, against
   * `ctx.effectFunctionContext`. Non-effect nodes are filtered out; an empty or
   * absent list emits nothing.
   */
  private compileEffects(effects: ASTNode[] | undefined, emitter: CodeEmitter): void {
    if (effects === undefined || effects.length === 0) {
      return
    }

    emitter.comment('HookLifecycleCompiler.compileEffects')
    effects
      .filter(this.isEffectNode)
      .forEach(effect => {
        const callExpr = this.compileAwaitedEffectCall(effect, 'ctx.effectFunctionContext')

        emitter.code(`${callExpr};`)
      })
  }

  /**
   * Returns the effect call prefixed with `await`. When the underlying compiler
   * already returns a parenthesised `(await ...)` form, the redundant wrapper is
   * unwrapped so the emitted expression is a single un-nested await.
   */
  private compileAwaitedEffectCall(effect: FunctionASTNode, effectCtxVar: string): string {
    const callExpr = this.compileEffectCall(effect, effectCtxVar)

    if (callExpr.startsWith('(await ') && callExpr.endsWith(')')) {
      return `await ${callExpr.slice('(await '.length, -1)}`
    }

    return `await ${callExpr}`
  }

  /**
   * Compiles an effect invocation, passing `effectCtxVar` as the first argument
   * ahead of the effect's own compiled operands.
   */
  private compileEffectCall(effect: FunctionASTNode, effectCtxVar: string): string {
    const funcName = effect.properties.name
    const argExprs = effect.properties.arguments.map(arg => this.expr.compileOperand(arg))

    return this.expr.compileFunctionCall(funcName, [effectCtxVar, ...argExprs], effect)
  }

  /**
   * Resolves the `next` outcomes into a fresh outcome variable and emits early
   * returns for the redirect and error cases. `prefix` is spliced verbatim into
   * each returned object literal (e.g. `'executed: true, '`); a 'continue' outcome
   * produces no return here, leaving the caller's fall-through to take effect.
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
   * Emits redirect/error outcome assignments into `outcomeVar` in declaration
   * order, each guarded by `outcomeVar === undefined` so the first matching outcome
   * wins and later ones are skipped. Non-outcome nodes and empty lists emit nothing.
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
   * Emits a redirect outcome assignment guarded by the outcome's `when` predicate.
   * The `goto` target is assigned (coerced via `String`) only when it resolves to a
   * defined value, so a redirect to an undefined target is skipped.
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
   * Emits an error outcome assignment guarded by the outcome's `when` predicate,
   * carrying the static `status` and the resolved message (coerced via `String`,
   * falling back to an empty string when the message resolves to undefined).
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
   * Compiles an outcome value that may be either a literal string (emitted as a
   * JSON literal) or an expression node (compiled via the dispatcher).
   */
  private compileOutcomeValue(value: ASTNode | string): string {
    if (typeof value === 'string') {
      return JSON.stringify(value)
    }

    return this.expr.compileExpression(value)
  }

  /**
   * Emits the terminal submit return, mapping the resolved outcome variable to a
   * redirect, error, or 'continue' CompiledSubmitHookResult. `validated` records
   * whether validation ran and is baked into every returned object.
   */
  private emitSubmitReturn(validated: boolean, outcomeVar: string, emitter: CodeEmitter): void {
    emitter.ifChain(
      [
        {
          condition: `${outcomeVar} && ${outcomeVar}.type === "redirect"`,
          body: () =>
            emitter.return(
              `{ executed: true, validated: ${JSON.stringify(validated)}, outcome: "redirect", redirect: ${outcomeVar}.value }`,
            ),
        },
        {
          condition: `${outcomeVar} && ${outcomeVar}.type === "error"`,
          body: () =>
            emitter.return(
              `{ executed: true, validated: ${JSON.stringify(validated)}, outcome: "error", status: ${outcomeVar}.value.status, message: ${outcomeVar}.value.message }`,
            ),
        },
      ],
      () => {
        emitter.return(`{ executed: true, validated: ${JSON.stringify(validated)}, outcome: "continue" }`)
      },
    )
  }

  /** Type guard narrowing a node to a FunctionASTNode whose expressionType is EFFECT. */
  private isEffectNode(node: ASTNode): node is FunctionASTNode {
    return node.type === ASTNodeType.EXPRESSION &&
      (node as { expressionType?: unknown }).expressionType === FunctionType.EFFECT
  }

  /** Type guard narrowing a node to a redirect or throw-error outcome node. */
  private isOutcomeNode(node: ASTNode): node is RedirectOutcomeASTNode | ThrowErrorOutcomeASTNode {
    return isRedirectOutcomeNode(node) || isThrowErrorOutcomeNode(node)
  }
}
