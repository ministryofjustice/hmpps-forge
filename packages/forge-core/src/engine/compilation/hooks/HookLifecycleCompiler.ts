import { FunctionType, HookType, OutcomeType } from '../../../authoring/types/enums'
import FunctionRegistry from '../../registries/FunctionRegistry'
import { ASTNode } from '../../types/ast.type'
import { ASTNodeType } from '../../types/enums'
import {
  AccessHookASTNode,
  ActionHookASTNode,
  FunctionASTNode,
  RedirectOutcomeASTNode,
  SubmitHookASTNode,
  ThrowErrorOutcomeASTNode,
} from '../../types/expressions.type'
import { JourneyASTNode, StepASTNode } from '../../types/structures.type'
import { JourneyInstanceDependencies } from '../../types/engine.type'
import { HookType as RuntimeHookType } from '../../runtime/types/AnswerHistory.type'
import EffectFunctionContextCtor, {
  EffectEvaluationContext,
} from '../../nodes/expressions/effect/EffectFunctionContext'
import { StepValidationState } from '../../runtime/context/RuntimeEvaluationContext'
import { StepValidityResult } from '../../runtime/types/StepValidityResult.type'
import NodeCompilationDispatcher from '../codegen/NodeCompilationDispatcher'
import CodeEmitter from '../codegen/CodeEmitter'
import { buildGeneratedSource, compileGeneratedFunction } from '../codegen/GeneratedFunctionCompiler'

export interface HookLifecycleContext {
  answers: EffectEvaluationContext['global']['answers']
  data: Record<string, unknown>
  validation?: StepValidationState
  session: Record<string, unknown>
  params: Record<string, unknown>
  query: Record<string, unknown>
  post: Record<string, string | string[]>
  request: Record<string, unknown>
  conditions: FunctionRegistry
  logger: JourneyInstanceDependencies['logger']
  effectContext: EffectEvaluationContext
  validate?: (groups: string[]) => StepValidityResult | Promise<StepValidityResult>
}

export interface CompiledAccessHookResult {
  executed: boolean
  outcome: 'continue' | 'redirect' | 'error'
  redirect?: string
  status?: number
  message?: string
}

export interface CompiledActionHookResult {
  executed: boolean
}

export interface CompiledSubmitHookResult {
  executed: boolean
  validated: boolean
  isValid?: boolean
  outcome: 'continue' | 'redirect' | 'error'
  redirect?: string
  status?: number
  message?: string
}

export type CompiledAccessLifecycleFunction = (
  ctx: HookLifecycleContext,
) => CompiledAccessHookResult | Promise<CompiledAccessHookResult>

export type CompiledActionHooksFunction = (
  ctx: HookLifecycleContext,
) => CompiledActionHookResult | Promise<CompiledActionHookResult>

export type CompiledSubmitHooksFunction = (
  ctx: HookLifecycleContext,
) => CompiledSubmitHookResult | Promise<CompiledSubmitHookResult>

type GeneratedAccessLifecycleFunction = (
  ctx: HookLifecycleContext,
  EffectFunctionContext: typeof EffectFunctionContextCtor,
) => CompiledAccessHookResult | Promise<CompiledAccessHookResult>

type GeneratedActionHooksFunction = (
  ctx: HookLifecycleContext,
  EffectFunctionContext: typeof EffectFunctionContextCtor,
) => CompiledActionHookResult | Promise<CompiledActionHookResult>

type GeneratedSubmitHooksFunction = (
  ctx: HookLifecycleContext,
  EffectFunctionContext: typeof EffectFunctionContextCtor,
) => CompiledSubmitHookResult | Promise<CompiledSubmitHookResult>

/**
 * Compiles access, action, and submit hook lifecycles into generated functions.
 *
 * Hook ordering and branching are fixed by the AST, so the compiler emits that
 * control flow directly: when/guard predicates, effect calls, validation branch
 * selection, and redirect/error outcomes. The generated hook functions are
 * forced async because effects are side-effectful and may be asynchronous even
 * when their registry metadata is absent or sync.
 */
export default class HookLifecycleCompiler {
  private readonly expr = new NodeCompilationDispatcher()

  compileAccessLifecycle(
    accessAncestors: (JourneyASTNode | StepASTNode)[],
    functionRegistry: FunctionRegistry,
  ): CompiledAccessLifecycleFunction | undefined {
    const generated = compileGeneratedFunction<GeneratedAccessLifecycleFunction>(
      this.expr,
      ['ctx', 'EffectFunctionContext'],
      functionRegistry,
      () => this.buildAccessSource(accessAncestors),
      { forceAsync: true },
    )

    if (generated === undefined) {
      return undefined
    }

    return ctx => generated(ctx, EffectFunctionContextCtor)
  }

  compileActionHooks(
    hooks: ActionHookASTNode[],
    functionRegistry: FunctionRegistry,
  ): CompiledActionHooksFunction | undefined {
    const generated = compileGeneratedFunction<GeneratedActionHooksFunction>(
      this.expr,
      ['ctx', 'EffectFunctionContext'],
      functionRegistry,
      () => this.buildActionSource(hooks),
      { forceAsync: true },
    )

    if (generated === undefined) {
      return undefined
    }

    return ctx => generated(ctx, EffectFunctionContextCtor)
  }

  compileSubmitHooks(
    hooks: SubmitHookASTNode[],
    functionRegistry: FunctionRegistry,
  ): CompiledSubmitHooksFunction | undefined {
    const generated = compileGeneratedFunction<GeneratedSubmitHooksFunction>(
      this.expr,
      ['ctx', 'EffectFunctionContext'],
      functionRegistry,
      () => this.buildSubmitSource(hooks),
      { forceAsync: true },
    )

    if (generated === undefined) {
      return undefined
    }

    return ctx => generated(ctx, EffectFunctionContextCtor)
  }

  generateAccessSource(accessAncestors: (JourneyASTNode | StepASTNode)[], functionRegistry?: FunctionRegistry): string {
    return buildGeneratedSource(this.expr, functionRegistry, () => this.buildAccessSource(accessAncestors))
  }

  generateActionSource(hooks: ActionHookASTNode[], functionRegistry?: FunctionRegistry): string {
    return buildGeneratedSource(this.expr, functionRegistry, () => this.buildActionSource(hooks))
  }

  generateSubmitSource(hooks: SubmitHookASTNode[], functionRegistry?: FunctionRegistry): string {
    return buildGeneratedSource(this.expr, functionRegistry, () => this.buildSubmitSource(hooks))
  }

  private buildAccessSource(accessAncestors: (JourneyASTNode | StepASTNode)[]): string {
    const emitter = this.createEmitter()

    accessAncestors.forEach(ancestor => {
      ;(ancestor.properties.onAccess ?? []).forEach(hook => {
        this.compileAccessHook(hook, emitter)
        emitter.emitBlank()
      })
    })

    emitter.emit('return { executed: true, outcome: "continue" };')

    return emitter.toString()
  }

  private buildActionSource(hooks: ActionHookASTNode[]): string {
    const emitter = this.createEmitter()

    hooks.forEach(hook => {
      this.compileActionHook(hook, emitter)
      emitter.emitBlank()
    })

    emitter.emit('return { executed: false };')

    return emitter.toString()
  }

  private buildSubmitSource(hooks: SubmitHookASTNode[]): string {
    const emitter = this.createEmitter()

    hooks.forEach(hook => {
      this.compileSubmitHook(hook, emitter)
      emitter.emitBlank()
    })

    emitter.emit('return { executed: false, validated: false, outcome: "continue" };')

    return emitter.toString()
  }

  private createEmitter(): CodeEmitter {
    const emitter = new CodeEmitter()

    emitter.emit('"use strict";')
    emitter.emitBlank()

    return emitter
  }

  private compileAccessHook(hook: AccessHookASTNode, emitter: CodeEmitter): void {
    const whenVar = this.compilePredicate(hook.properties.when, true, emitter)

    emitter.emitBlock(`if (${whenVar})`, () => {
      const failedVar = this.compileEffects(hook.properties.effects, HookType.ACCESS, emitter)

      emitter.emitBlock(`if (${failedVar})`, () => {
        emitter.emit(
          `if (ctx.logger && ctx.logger.warn) { ctx.logger.warn("Access hook error: " + String(${failedVar}.message || ${failedVar})); }`,
        )
      })
      emitter.emitBlock(`else`, () => {
        this.compileOutcomeReturns(hook.properties.next, emitter, 'executed: true, ')
      })
    })
  }

  private compileActionHook(hook: ActionHookASTNode, emitter: CodeEmitter): void {
    const whenVar = this.compilePredicate(hook.properties.when, false, emitter)

    emitter.emitBlock(`if (${whenVar})`, () => {
      const failedVar = this.compileEffects(hook.properties.effects, HookType.ACTION, emitter)

      emitter.emitBlock(`if (!${failedVar})`, () => {
        emitter.emit('return { executed: true };')
      })
    })
  }

  private compileSubmitHook(hook: SubmitHookASTNode, emitter: CodeEmitter): void {
    const whenVar = this.compilePredicate(hook.properties.when, true, emitter)

    emitter.emitBlock(`if (${whenVar})`, () => {
      const guardsVar = this.compilePredicate(hook.properties.guards, true, emitter)

      emitter.emitBlock(`if (${guardsVar})`, () => {
        const validate = hook.properties.validate
        const validVar = emitter.nextVar('_valid')

        if (validate) {
          this.compileValidatedSubmitBranches(hook, validVar, emitter)
        } else {
          this.compileNonValidatingSubmitBranch(hook, emitter)
        }
      })
    })
  }

  private compileValidatedSubmitBranches(hook: SubmitHookASTNode, validVar: string, emitter: CodeEmitter): void {
    const alwaysOutcomeVar = this.compileBranch(hook.properties.onAlways, HookType.SUBMIT, emitter)
    const branchOutcomeVar = emitter.nextVar('_branchOutcome')
    const validationResultVar = emitter.nextVar('_validationResult')
    const validationGroups =
      hook.properties.validationGroups !== undefined && hook.properties.validationGroups.length > 0
        ? hook.properties.validationGroups
        : ['default']

    emitter.emitBlock(`if (${alwaysOutcomeVar} && ${alwaysOutcomeVar}.type === "skip")`, () => {
      emitter.emit('/* Skip this hook after an onAlways effect failure so later hooks still get a chance to run. */')
    })
    emitter.emitBlock(`else if (${alwaysOutcomeVar} && ${alwaysOutcomeVar}.type === "redirect")`, () => {
      emitter.emit(
        `return { executed: true, validated: false, outcome: "redirect", redirect: ${alwaysOutcomeVar}.value };`,
      )
    })
    emitter.emitBlock(`else if (${alwaysOutcomeVar} && ${alwaysOutcomeVar}.type === "error")`, () => {
      emitter.emit(
        `return { executed: true, validated: false, outcome: "error", status: ${alwaysOutcomeVar}.value.status, message: ${alwaysOutcomeVar}.value.message };`,
      )
    })
    emitter.emitBlock('else', () => {
      emitter.emit('if (!ctx.validate) { throw new Error("[Forge] Submit validation callback is missing"); }')
      emitter.emit(`var ${validationResultVar} = await ctx.validate(${JSON.stringify(validationGroups)});`)
      emitter.emit(`var ${validVar} = ${validationResultVar}.isValid;`)
      emitter.emit(`var ${branchOutcomeVar};`)
      emitter.emitBlock(`if (${validVar})`, () => {
        emitter.emit(`${branchOutcomeVar} = undefined;`)
        this.compileBranchIntoExistingOutcome(hook.properties.onValid, HookType.SUBMIT, branchOutcomeVar, emitter)
      })
      emitter.emitBlock(`if (!${validVar})`, () => {
        emitter.emit(`${branchOutcomeVar} = undefined;`)
        this.compileBranchIntoExistingOutcome(hook.properties.onInvalid, HookType.SUBMIT, branchOutcomeVar, emitter)
      })
      this.emitSubmitReturn(true, validVar, branchOutcomeVar, emitter)
    })
  }

  private compileNonValidatingSubmitBranch(hook: SubmitHookASTNode, emitter: CodeEmitter): void {
    const outcomeVar = this.compileBranch(hook.properties.onAlways, HookType.SUBMIT, emitter)

    this.emitSubmitReturn(false, undefined, outcomeVar, emitter)
  }

  private compileBranch(
    branch: { effects?: ASTNode[]; next?: ASTNode[] } | undefined,
    hookType: HookType,
    emitter: CodeEmitter,
  ): string {
    const outcomeVar = emitter.nextVar('_outcome')

    emitter.emit(`var ${outcomeVar};`)
    this.compileBranchIntoExistingOutcome(branch, hookType, outcomeVar, emitter)

    return outcomeVar
  }

  private compileBranchIntoExistingOutcome(
    branch: { effects?: ASTNode[]; next?: ASTNode[] } | undefined,
    hookType: HookType,
    outcomeVar: string,
    emitter: CodeEmitter,
  ): void {
    if (branch === undefined) {
      return
    }

    const failedVar = this.compileEffects(branch.effects, hookType, emitter)

    emitter.emitBlock(`if (${failedVar})`, () => {
      emitter.emit(`${outcomeVar} = { type: "skip" };`)
    })
    emitter.emitBlock('else', () => {
      this.compileOutcomeAssignment(branch.next, outcomeVar, emitter)
    })
  }

  private compilePredicate(predicate: ASTNode | undefined, defaultValue: boolean, emitter: CodeEmitter): string {
    if (predicate === undefined) {
      const literalVar = emitter.nextVar('_pred')

      emitter.emit(`var ${literalVar} = ${JSON.stringify(defaultValue)};`)

      return literalVar
    }

    const predicateVar = emitter.nextVar('_pred')
    const predicateExpr = this.expr.compileExpression(predicate)

    emitter.emit(`var ${predicateVar};`)
    emitter.emitBlock('try', () => {
      emitter.emit(`${predicateVar} = !!(${predicateExpr});`)
    })
    emitter.emitBlock('catch(e)', () => {
      emitter.emit(`${predicateVar} = false;`)
    })

    return predicateVar
  }

  private compileEffects(effects: ASTNode[] | undefined, hookType: HookType, emitter: CodeEmitter): string {
    const failedVar = emitter.nextVar('_effectFailed')

    emitter.emit(`var ${failedVar} = undefined;`)

    if (effects === undefined || effects.length === 0) {
      return failedVar
    }

    const effectCtxVar = emitter.nextVar('_effectCtx')

    emitter.emit(
      `var ${effectCtxVar} = new EffectFunctionContext(ctx.effectContext, ${JSON.stringify(this.toRuntimeHookType(hookType))});`,
    )
    effects
      .filter(this.isEffectNode)
      .forEach(effect => {
        const callExpr = this.compileEffectCall(effect, effectCtxVar)

        emitter.emitBlock(`if (!${failedVar})`, () => {
          emitter.emitBlock('try', () => {
            emitter.emit(`await ${callExpr};`)
          })
          emitter.emitBlock('catch(e)', () => {
            emitter.emit(`${failedVar} = e;`)
          })
        })
      })

    return failedVar
  }

  private compileEffectCall(effect: FunctionASTNode, effectCtxVar: string): string {
    const funcName = effect.properties.name
    const argExprs = effect.properties.arguments.map(arg => this.expr.compileOperand(arg))

    return `ctx.conditions.get(${JSON.stringify(funcName)}).evaluate(${[effectCtxVar, ...argExprs].join(', ')})`
  }

  private compileOutcomeReturns(next: ASTNode[] | undefined, emitter: CodeEmitter, prefix: string): void {
    const outcomeVar = emitter.nextVar('_outcome')

    emitter.emit(`var ${outcomeVar};`)
    this.compileOutcomeAssignment(next, outcomeVar, emitter)
    emitter.emitBlock(`if (${outcomeVar} && ${outcomeVar}.type === "redirect")`, () => {
      emitter.emit(`return { ${prefix}outcome: "redirect", redirect: ${outcomeVar}.value };`)
    })
    emitter.emitBlock(`if (${outcomeVar} && ${outcomeVar}.type === "error")`, () => {
      emitter.emit(
        `return { ${prefix}outcome: "error", status: ${outcomeVar}.value.status, message: ${outcomeVar}.value.message };`,
      )
    })
  }

  private compileOutcomeAssignment(next: ASTNode[] | undefined, outcomeVar: string, emitter: CodeEmitter): void {
    if (next === undefined || next.length === 0) {
      return
    }

    next.filter(this.isOutcomeNode).forEach(outcome => {
      emitter.emitBlock(`if (${outcomeVar} === undefined)`, () => {
        if (outcome.outcomeType === OutcomeType.REDIRECT) {
          this.compileRedirectOutcome(outcome as RedirectOutcomeASTNode, outcomeVar, emitter)
        }

        if (outcome.outcomeType === OutcomeType.THROW_ERROR) {
          this.compileThrowErrorOutcome(outcome as ThrowErrorOutcomeASTNode, outcomeVar, emitter)
        }
      })
    })
  }

  private compileRedirectOutcome(outcome: RedirectOutcomeASTNode, outcomeVar: string, emitter: CodeEmitter): void {
    const whenVar = this.compilePredicate(outcome.properties.when, true, emitter)

    emitter.emitBlock(`if (${whenVar})`, () => {
      const gotoExpr = this.compileOutcomeValue(outcome.properties.goto)
      const gotoVar = emitter.nextVar('_goto')

      emitter.emit(`var ${gotoVar};`)
      emitter.emitBlock('try', () => {
        emitter.emit(`${gotoVar} = ${gotoExpr};`)
      })
      emitter.emitBlock('catch(e)', () => {
        emitter.emit(`${gotoVar} = undefined;`)
      })
      emitter.emitBlock(`if (${gotoVar} !== undefined)`, () => {
        emitter.emit(`${outcomeVar} = { type: "redirect", value: String(${gotoVar}) };`)
      })
    })
  }

  private compileThrowErrorOutcome(outcome: ThrowErrorOutcomeASTNode, outcomeVar: string, emitter: CodeEmitter): void {
    const whenVar = this.compilePredicate(outcome.properties.when, true, emitter)

    emitter.emitBlock(`if (${whenVar})`, () => {
      const messageExpr = this.compileOutcomeValue(outcome.properties.message)
      const messageVar = emitter.nextVar('_message')

      emitter.emit(`var ${messageVar};`)
      emitter.emitBlock('try', () => {
        emitter.emit(`${messageVar} = ${messageExpr};`)
      })
      emitter.emitBlock('catch(e)', () => {
        emitter.emit(`${messageVar} = undefined;`)
      })
      emitter.emit(
        `${outcomeVar} = { type: "error", value: { status: ${JSON.stringify(outcome.properties.status)}, message: ${messageVar} !== undefined ? String(${messageVar}) : "" } };`,
      )
    })
  }

  private compileOutcomeValue(value: ASTNode | string): string {
    if (typeof value === 'string') {
      return JSON.stringify(value)
    }

    return this.expr.compileExpression(value)
  }

  private emitSubmitReturn(
    validated: boolean,
    validVar: string | undefined,
    outcomeVar: string,
    emitter: CodeEmitter,
  ): void {
    const validPart = validVar === undefined ? '' : `, isValid: ${validVar}`

    emitter.emitBlock(`if (${outcomeVar} && ${outcomeVar}.type === "skip")`, () => {
      emitter.emit('/* Skip this hook after an effect failure so later hooks still get a chance to run. */')
    })
    emitter.emitBlock(`else if (${outcomeVar} && ${outcomeVar}.type === "redirect")`, () => {
      emitter.emit(
        `return { executed: true, validated: ${JSON.stringify(validated)}${validPart}, outcome: "redirect", redirect: ${outcomeVar}.value };`,
      )
    })
    emitter.emitBlock(`else if (${outcomeVar} && ${outcomeVar}.type === "error")`, () => {
      emitter.emit(
        `return { executed: true, validated: ${JSON.stringify(validated)}${validPart}, outcome: "error", status: ${outcomeVar}.value.status, message: ${outcomeVar}.value.message };`,
      )
    })
    emitter.emitBlock('else', () => {
      emitter.emit(
        `return { executed: true, validated: ${JSON.stringify(validated)}${validPart}, outcome: "continue" };`,
      )
    })
  }

  private isEffectNode(node: ASTNode): node is FunctionASTNode {
    return node.type === ASTNodeType.EXPRESSION &&
      (node as { expressionType?: unknown }).expressionType === FunctionType.EFFECT
  }

  private isOutcomeNode(node: ASTNode): node is RedirectOutcomeASTNode | ThrowErrorOutcomeASTNode {
    return node.type === ASTNodeType.OUTCOME &&
      ((node as { outcomeType?: unknown }).outcomeType === OutcomeType.REDIRECT ||
        (node as { outcomeType?: unknown }).outcomeType === OutcomeType.THROW_ERROR)
  }

  private toRuntimeHookType(hookType: HookType): RuntimeHookType {
    switch (hookType) {
      case HookType.ACTION:
        return 'action'
      case HookType.SUBMIT:
        return 'submit'
      case HookType.ACCESS:
      default:
        return 'access'
    }
  }
}
