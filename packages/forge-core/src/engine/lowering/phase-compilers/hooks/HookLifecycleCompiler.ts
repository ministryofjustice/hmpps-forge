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
import { JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import ExpressionDispatcher from '../../expressions/ExpressionDispatcher'
import CodeEmitter from '../../emitters/CodeEmitter'
import { buildGeneratedSource, compileGeneratedFunction } from '../../function-construction/GeneratedFunctionCompiler'
import type { CompilationDependencies } from '../../compilationDependencies.type'
import { isRedirectOutcomeNode, isThrowErrorOutcomeNode } from '../../../contracts/ast/outcome-nodes'
import type {
  CompiledAccessLifecycleFunction,
  CompiledSubmitHooksFunction,
} from '../../../contracts/runtime/hookLifecycle.type'

export default class HookLifecycleCompiler {
  private readonly expr: ExpressionDispatcher

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
  }

  compileAccessLifecycle(
    accessAncestors: (JourneyASTNode | StepASTNode)[],
  ): CompiledAccessLifecycleFunction | undefined {
    return compileGeneratedFunction<CompiledAccessLifecycleFunction>(
      this.expr,
      ['ctx'],
      () => this.buildAccessSource(accessAncestors),
      { forceAsync: true, phase: 'hooks' },
    )
  }

  compileSubmitHooks(hooks: SubmitHookASTNode[]): CompiledSubmitHooksFunction | undefined {
    return compileGeneratedFunction<CompiledSubmitHooksFunction>(
      this.expr,
      ['ctx'],
      () => this.buildSubmitSource(hooks),
      { forceAsync: true, phase: 'hooks' },
    )
  }

  generateAccessSource(accessAncestors: (JourneyASTNode | StepASTNode)[]): string {
    return buildGeneratedSource(this.expr, () => this.buildAccessSource(accessAncestors))
  }

  generateSubmitSource(hooks: SubmitHookASTNode[]): string {
    return buildGeneratedSource(this.expr, () => this.buildSubmitSource(hooks))
  }

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

  private buildSubmitSource(hooks: SubmitHookASTNode[]): string {
    const emitter = this.createEmitter()

    emitter.comment('HookLifecycleCompiler.buildSubmitSource')
    hooks.forEach(hook => {
      this.compileSubmitHook(hook, emitter)
    })

    emitter.return('{ executed: false, validated: false, outcome: "continue" }')

    return emitter.toString()
  }

  private createEmitter(): CodeEmitter {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')

    return emitter
  }

  private compileAccessHook(hook: AccessHookASTNode, emitter: CodeEmitter): void {
    emitter.comment('HookLifecycleCompiler.compileAccessHook')
    emitter.scope(() => {
      const whenVar = this.compilePredicate(hook.properties.when, true, emitter, 'whenPredicate')

      emitter.if(whenVar, () => {
        this.compileEffects(hook.properties.effects, emitter)
        this.compileOutcomeReturns(hook.properties.next, emitter, 'executed: true, ')
      })
    })
  }

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
        this.emitSubmitReturn(true, validVar, branchOutcomeVar, emitter)
      },
    )
  }

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

  private compileNonValidatingSubmitBranch(hook: SubmitHookASTNode, emitter: CodeEmitter): void {
    emitter.comment('HookLifecycleCompiler.compileNonValidatingSubmitBranch')
    const outcomeVar = this.compileBranch(hook.properties.onAlways, emitter)

    this.emitSubmitReturn(false, undefined, outcomeVar, emitter)
  }

  private compileBranch(branch: { effects?: ASTNode[]; next?: ASTNode[] } | undefined, emitter: CodeEmitter): string {
    const outcomeVar = emitter.let('outcome')

    this.compileBranchIntoExistingOutcome(branch, outcomeVar, emitter)

    return outcomeVar
  }

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

  private isEffectNode(node: ASTNode): node is FunctionASTNode {
    return node.type === ASTNodeType.EXPRESSION &&
      (node as { expressionType?: unknown }).expressionType === FunctionType.EFFECT
  }

  private isOutcomeNode(node: ASTNode): node is RedirectOutcomeASTNode | ThrowErrorOutcomeASTNode {
    return isRedirectOutcomeNode(node) || isThrowErrorOutcomeNode(node)
  }
}
