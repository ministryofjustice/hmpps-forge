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
import ExpressionDispatcher from '../../../compilation/lowering/expressions/ExpressionDispatcher'
import CodeEmitter from '../../../compilation/lowering/emitters/CodeEmitter'
import {
  buildGeneratedSource,
  compileGeneratedFunction,
} from '../../../compilation/lowering/function-construction/GeneratedFunctionCompiler'
import type { CompilationDependencies } from '../../../compilation/lowering/compilationDependencies.type'
import { isRedirectOutcomeNode, isThrowErrorOutcomeNode } from '../../../contracts/ast/outcome-nodes'
import type { CompiledAccessLifecycleFunction, CompiledSubmitHooksFunction } from '../contracts/hookLifecycle.type'

export default class HookLifecycleCompiler {
  private readonly expr: ExpressionDispatcher

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
  }

  compileAccessLifecycle(hooks: AccessHookASTNode[]): CompiledAccessLifecycleFunction {
    return compileGeneratedFunction<CompiledAccessLifecycleFunction>(
      this.expr,
      ['ctx'],
      () => this.buildAccessSource(hooks),
      { forceAsync: true, phase: 'hooks' },
    )
  }

  compileSubmitHooks(hooks: SubmitHookASTNode[]): CompiledSubmitHooksFunction {
    return compileGeneratedFunction<CompiledSubmitHooksFunction>(
      this.expr,
      ['ctx'],
      () => this.buildSubmitSource(hooks),
      { forceAsync: true, phase: 'hooks' },
    )
  }

  generateAccessSource(hooks: AccessHookASTNode[]): string {
    return buildGeneratedSource(this.expr, () => this.buildAccessSource(hooks))
  }

  generateSubmitSource(hooks: SubmitHookASTNode[]): string {
    return buildGeneratedSource(this.expr, () => this.buildSubmitSource(hooks))
  }

  private buildAccessSource(hooks: AccessHookASTNode[]): string {
    const emitter = this.createEmitter()

    emitter.comment('HookLifecycleCompiler.buildAccessSource')
    const hooksVar = emitter.const('accessHooks', '[]')

    hooks.forEach((hook, hookIndex) => {
      this.compileAccessHookTask(hook, hookIndex, hooksVar, emitter)
    })

    emitter.return(`ctx.workTasks.accessLifecycle(${hooksVar})`)

    return emitter.toString()
  }

  private buildSubmitSource(hooks: SubmitHookASTNode[]): string {
    const emitter = this.createEmitter()

    emitter.comment('HookLifecycleCompiler.buildSubmitSource')
    const hooksVar = emitter.const('submitHooks', '[]')

    hooks.forEach((hook, hookIndex) => {
      this.compileSubmitHookTask(hook, hookIndex, hooksVar, emitter)
    })

    emitter.return(`ctx.workTasks.submitLifecycle(${hooksVar})`)

    return emitter.toString()
  }

  private createEmitter(): CodeEmitter {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')

    return emitter
  }

  private compileAccessHookTask(
    hook: AccessHookASTNode,
    hookIndex: number,
    hooksVar: string,
    emitter: CodeEmitter,
  ): void {
    const hookKey = `access-hook-${hookIndex}`

    emitter.comment('HookLifecycleCompiler.compileAccessHookTask')
    emitter.scope(() => {
      const effectsVar = emitter.const('accessHookEffects', '[]')

      hook.properties.effects?.filter(this.isEffectNode).forEach((effect, effectIndex) => {
        this.compileEffectTask(effect, `${hookKey}-effect-${effectIndex}`, effectsVar, emitter)
      })

      const propsVar = emitter.const('accessHookProps', '{}')

      emitter.assign(`${propsVar}["when"]`, this.compileAccessWhenTask(hook, `${hookKey}-when`))
      emitter.assign(`${propsVar}["effects"]`, effectsVar)
      emitter.assign(`${propsVar}["next"]`, this.compileAccessNextFunction(hook))
      emitter.code(`${hooksVar}.push(ctx.workTasks.accessHook(${JSON.stringify(hookKey)}, ${propsVar}));`)
    })
  }

  private compileEffectTask(
    effect: FunctionASTNode,
    effectKey: string,
    effectsVar: string,
    emitter: CodeEmitter,
  ): void {
    emitter.scope(() => {
      const propsVar = emitter.const(
        'hookEffectProps',
        `{
          name: ${JSON.stringify(effect.properties.name)},
          run: ${this.compileEffectRunFunction(effect)}
        }`,
      )

      emitter.code(`${effectsVar}.push(ctx.workTasks.hookEffect(${JSON.stringify(effectKey)}, ${propsVar}));`)
    })
  }

  private compileAccessWhenTask(hook: AccessHookASTNode, key: string): string {
    return `ctx.workTasks.accessHookWhen(${JSON.stringify(key)}, { evaluate: ${this.compileAccessWhenFunction(hook)} })`
  }

  private compileAccessWhenFunction(hook: AccessHookASTNode): string {
    const when = hook.properties.when

    if (when === undefined) {
      return 'async () => true'
    }

    return this.compileAsyncFunctionExpression(emitter => {
      const predicateExpr = this.expr.compileExpression(when)

      emitter.return(`Boolean(${predicateExpr})`)
    })
  }

  private compileAccessNextFunction(hook: AccessHookASTNode): string {
    return this.compileAsyncFunctionExpression(emitter => {
      const outcomeVar = emitter.let('outcome')

      this.compileOutcomeAssignment(hook.properties.next, outcomeVar, emitter)
      emitter.return(outcomeVar)
    })
  }

  private compileEffectRunFunction(effect: FunctionASTNode): string {
    return this.compileAsyncFunctionExpression(emitter => {
      emitter.code(`${this.compileAwaitedEffectCall(effect, 'ctx.effectFunctionContext')};`)
    })
  }

  private compileSubmitHookTask(
    hook: SubmitHookASTNode,
    hookIndex: number,
    hooksVar: string,
    emitter: CodeEmitter,
  ): void {
    const hookKey = `submit-hook-${hookIndex}`

    emitter.comment('HookLifecycleCompiler.compileSubmitHookTask')
    emitter.scope(() => {
      const propsVar = emitter.const('submitHookProps', '{}')

      // The hook's validation groups select which rules its validation stage
      // executes; the stage's stored current-page result is what the
      // onValid/onInvalid branches gate on. Resolved once at compile time.
      const validationGroups =
        hook.properties.validationGroups.length > 0 ? hook.properties.validationGroups : ['default']

      emitter.assign(
        `${propsVar}["when"]`,
        this.compileSubmitPredicateTask(hook.properties.when, true, `${hookKey}-when`, 'when'),
      )
      emitter.assign(
        `${propsVar}["guards"]`,
        this.compileSubmitPredicateTask(hook.properties.guards, true, `${hookKey}-guards`, 'guards'),
      )
      emitter.assign(
        `${propsVar}["onAlways"]`,
        this.compileSubmitBranchTask(hook.properties.onAlways, `${hookKey}-onAlways`, 'onAlways', emitter),
      )

      if (hook.properties.validate) {
        emitter.assign(
          `${propsVar}["validation"]`,
          this.compileCurrentStepValidationTask(`${hookKey}-validation`, validationGroups),
        )
      }

      if (hook.properties.onValid !== undefined) {
        emitter.assign(
          `${propsVar}["onValid"]`,
          this.compileSubmitBranchTask(hook.properties.onValid, `${hookKey}-onValid`, 'onValid', emitter),
        )
      }

      if (hook.properties.onInvalid !== undefined) {
        emitter.assign(
          `${propsVar}["onInvalid"]`,
          this.compileSubmitBranchTask(hook.properties.onInvalid, `${hookKey}-onInvalid`, 'onInvalid', emitter),
        )
      }

      emitter.code(`${hooksVar}.push(ctx.workTasks.submitHook(${JSON.stringify(hookKey)}, ${propsVar}));`)
    })
  }

  private compileSubmitPredicateTask(
    predicate: ASTNode | undefined,
    defaultValue: boolean,
    key: string,
    name: string,
  ): string {
    return `ctx.workTasks.submitPredicate(${JSON.stringify(key)}, {
        name: ${JSON.stringify(name)},
        evaluate: ${this.compileSubmitPredicateFunction(predicate, defaultValue)}
      })`
  }

  private compileSubmitPredicateFunction(predicate: ASTNode | undefined, defaultValue: boolean): string {
    if (predicate === undefined) {
      return `async () => ${JSON.stringify(defaultValue)}`
    }

    return this.compileAsyncFunctionExpression(emitter => {
      const predicateExpr = this.expr.compileExpression(predicate)

      emitter.return(`Boolean(${predicateExpr})`)
    })
  }

  private compileSubmitBranchTask(
    branch: { effects?: ASTNode[]; next?: ASTNode[] } | undefined,
    key: string,
    name: 'onAlways' | 'onValid' | 'onInvalid',
    emitter: CodeEmitter,
  ): string {
    const effectsVar = emitter.const(`${name}Effects`, '[]')

    branch?.effects?.filter(this.isEffectNode).forEach((effect, effectIndex) => {
      this.compileEffectTask(effect, `${key}-effect-${effectIndex}`, effectsVar, emitter)
    })

    const propsVar = emitter.const(
      `${name}Props`,
      `{
        name: ${JSON.stringify(name)},
        effects: ${effectsVar},
        next: ${this.compileOutcomeFunction(branch?.next)}
      }`,
    )

    return `ctx.workTasks.submitBranch(${JSON.stringify(key)}, ${propsVar})`
  }

  private compileCurrentStepValidationTask(key: string, groups: readonly string[]): string {
    return `ctx.workTasks.currentStepValidation(${JSON.stringify(key)}, { groups: ${JSON.stringify(groups)}, includeSubmissionOnly: true })`
  }

  private compileOutcomeFunction(next: ASTNode[] | undefined): string {
    return this.compileAsyncFunctionExpression(emitter => {
      const outcomeVar = emitter.let('outcome')

      this.compileOutcomeAssignment(next, outcomeVar, emitter)
      emitter.return(outcomeVar)
    })
  }

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

  private compileAwaitedEffectCall(effect: FunctionASTNode, effectCtxVar: string): string {
    const callExpr = this.compileEffectCall(effect, effectCtxVar)

    if (callExpr.startsWith('(await ') && callExpr.endsWith(')')) {
      return `await ${callExpr.slice('(await '.length, -1)}`
    }

    return `await ${callExpr}`
  }

  private compileEffectCall(effect: FunctionASTNode, effectCtxVar: string): string {
    const funcName = effect.properties.name
    const argExprs = effect.properties.arguments.map(arg => this.expr.compileOperand(arg))

    return this.expr.compileFunctionCall(funcName, [effectCtxVar, ...argExprs], effect)
  }

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

  private compileOutcomeValue(value: ASTNode | string): string {
    if (typeof value === 'string') {
      return JSON.stringify(value)
    }

    return this.expr.compileExpression(value)
  }

  private compileAsyncFunctionExpression(buildBody: (emitter: CodeEmitter) => void): string {
    const emitter = new CodeEmitter()

    buildBody(emitter)

    const body = emitter
      .toString()
      .split('\n')
      .map(line => (line.length === 0 ? line : `  ${line}`))
      .join('\n')

    return `async () => {\n${body}\n}`
  }

  private isEffectNode(node: ASTNode): node is FunctionASTNode {
    return node.type === ASTNodeType.EXPRESSION &&
      (node as { expressionType?: unknown }).expressionType === FunctionType.EFFECT
  }

  private isOutcomeNode(node: ASTNode): node is RedirectOutcomeASTNode | ThrowErrorOutcomeASTNode {
    return isRedirectOutcomeNode(node) || isThrowErrorOutcomeNode(node)
  }
}
