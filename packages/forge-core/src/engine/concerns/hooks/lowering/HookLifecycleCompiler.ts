import {
  CodeFragment,
  ObjectCodeProperty,
  arrayCode,
  code,
  literal,
  objectCode,
} from '../../../chassis/compilation/lowering/codegen/fragments/CodeFragment'
import CodeGenerator from '../../../chassis/compilation/lowering/codegen/CodeGenerator'
import IdentifierName from '../../../chassis/compilation/lowering/codegen/fragments/IdentifierName'
import type { CompilationDependencies } from '../../../chassis/compilation/lowering/compilationDependencies.type'
import ExpressionDispatcher from '../../../chassis/compilation/lowering/expressions/ExpressionDispatcher'
import {
  CompilationPhase,
  compileGeneratedFunction,
  renderGeneratedSource,
} from '../../../chassis/compilation/lowering/GeneratedFunctionCompiler'
import { toRawOperand, type ExpressionValue } from '../../../chassis/contracts/models/authoredValue.type'
import type { CompiledAccessLifecycleFunction, CompiledSubmitHooksFunction } from '../contracts/hookLifecycle.type'
import type {
  AccessHookModel,
  AccessLifecycleModel,
  EffectCall,
  HookOutcomeModel,
  RedirectOutcomeModel,
  SubmitBranchModel,
  SubmitHookModel,
  SubmitHooksModel,
  ThrowErrorOutcomeModel,
} from '../contracts/hookModel.type'
import { HookOutcomeKind } from '../contracts/hookModel.type'

const CONTEXT = new IdentifierName('ctx')

/** Compiles the access-lifecycle and submit-hook functions from the hook models. */
export default class HookLifecycleCompiler {
  private readonly expr: ExpressionDispatcher

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
  }

  compileAccessLifecycle(model: AccessLifecycleModel): CompiledAccessLifecycleFunction {
    return compileGeneratedFunction<CompiledAccessLifecycleFunction>(
      this.expr,
      ['ctx'],
      () => this.buildAccessSource(model),
      { phase: CompilationPhase.HOOKS, label: model.label },
    )
  }

  compileSubmitHooks(model: SubmitHooksModel): CompiledSubmitHooksFunction {
    return compileGeneratedFunction<CompiledSubmitHooksFunction>(
      this.expr,
      ['ctx'],
      () => this.buildSubmitSource(model),
      { phase: CompilationPhase.HOOKS, label: model.label },
    )
  }

  generateAccessSource(model: AccessLifecycleModel): string {
    return renderGeneratedSource(this.expr, () => this.buildAccessSource(model))
  }

  generateSubmitSource(model: SubmitHooksModel): string {
    return renderGeneratedSource(this.expr, () => this.buildSubmitSource(model))
  }

  private buildAccessSource(model: AccessLifecycleModel): CodeGenerator {
    const generator = this.createGenerator()
    const hookNames = model.hooks.map(hook => this.compileAccessHookTask(hook, generator))

    generator.return(code`${CONTEXT}.workTasks.accessLifecycle(${arrayCode(hookNames)})`)

    return generator
  }

  private buildSubmitSource(model: SubmitHooksModel): CodeGenerator {
    const generator = this.createGenerator()
    const hookNames = model.hooks.map(hook => this.compileSubmitHookTask(hook, generator))

    generator.return(code`${CONTEXT}.workTasks.submitLifecycle(${arrayCode(hookNames)})`)

    return generator
  }

  private createGenerator(): CodeGenerator {
    const generator = CodeGenerator.forFunction(['ctx'])

    generator.directive('use strict')

    return generator
  }

  /**
   * Emits one access hook as a named unit: effect consts first, then the hook
   * const holding the work task. Only authored parts appear in the props —
   * an absent `when`, empty effects, or no outcomes are simply not emitted.
   */
  private compileAccessHookTask(hook: AccessHookModel, generator: CodeGenerator): IdentifierName {
    generator.comment(`Access hook — ${hook.label}`)
    const effectNames = hook.effects.map(effect => this.compileEffectTask(effect, generator))
    const entries: ObjectCodeProperty[] = []

    if (hook.when !== undefined) {
      entries.push({ key: 'when', value: this.compileAccessWhenTask(hook.when, `${hook.key}-when`, generator) })
    }

    if (effectNames.length > 0) {
      entries.push({ key: 'effects', value: arrayCode(effectNames) })
    }

    if (hook.outcomes.length > 0) {
      entries.push({ key: 'next', value: this.compileNextFunction('resolveAccessHookNext', hook.outcomes, generator) })
    }

    const hookName = generator.const(
      this.camelise(hook.key),
      code`${CONTEXT}.workTasks.accessHook(${hook.key}, ${objectCode(entries)})`,
    )

    generator.blank()

    return hookName
  }

  /**
   * Emits one submit hook as a named unit. Branch effects hoist into named
   * consts above the hook const; unauthored predicates and empty branches are
   * not emitted, matching the optional work-task props.
   */
  private compileSubmitHookTask(hook: SubmitHookModel, generator: CodeGenerator): IdentifierName {
    generator.comment(`Submit hook — ${hook.label}`)
    const entries: ObjectCodeProperty[] = []

    if (hook.when !== undefined) {
      entries.push({
        key: 'when',
        value: this.compileSubmitPredicateTask(hook.when, `${hook.key}-when`, 'when', generator),
      })
    }

    if (hook.guards !== undefined) {
      entries.push({
        key: 'guards',
        value: this.compileSubmitPredicateTask(hook.guards, `${hook.key}-guards`, 'guards', generator),
      })
    }

    this.appendSubmitBranchEntry(entries, hook.branches.onAlways, `${hook.key}-onAlways`, 'onAlways', generator)

    if (hook.validate) {
      entries.push({
        key: 'validation',
        value: this.compileCurrentStepValidationTask(`${hook.key}-validation`, hook.validationGroups),
      })
    }

    this.appendSubmitBranchEntry(entries, hook.branches.onValid, `${hook.key}-onValid`, 'onValid', generator)
    this.appendSubmitBranchEntry(entries, hook.branches.onInvalid, `${hook.key}-onInvalid`, 'onInvalid', generator)

    const hookName = generator.const(
      this.camelise(hook.key),
      code`${CONTEXT}.workTasks.submitHook(${hook.key}, ${objectCode(entries)})`,
    )

    generator.blank()

    return hookName
  }

  private appendSubmitBranchEntry(
    entries: ObjectCodeProperty[],
    branch: SubmitBranchModel | undefined,
    key: string,
    name: 'onAlways' | 'onValid' | 'onInvalid',
    generator: CodeGenerator,
  ): void {
    if (branch === undefined || (branch.effects.length === 0 && branch.outcomes.length === 0)) {
      return
    }

    const effectNames = branch.effects.map(effect => this.compileEffectTask(effect, generator))
    const branchEntries: ObjectCodeProperty[] = [{ key: 'name', value: literal(name) }]

    if (effectNames.length > 0) {
      branchEntries.push({ key: 'effects', value: arrayCode(effectNames) })
    }

    if (branch.outcomes.length > 0) {
      branchEntries.push({
        key: 'next',
        value: this.compileNextFunction(
          `resolveSubmit${this.toFunctionNamePart(name)}Next`,
          branch.outcomes,
          generator,
        ),
      })
    }

    entries.push({ key: name, value: code`${CONTEXT}.workTasks.submitBranch(${key}, ${objectCode(branchEntries)})` })
  }

  private compileEffectTask(effect: EffectCall, generator: CodeGenerator): IdentifierName {
    const run = this.compileFunctionExpression(`run${this.toFunctionNamePart(effect.name)}`, generator, body => {
      body.return(this.compileEffectCall(effect))
    })

    return generator.const(
      this.camelise(effect.name),
      code`${CONTEXT}.workTasks.hookEffect(${effect.key}, ${objectCode([
        { key: 'name', value: literal(effect.name) },
        { key: 'run', value: run },
      ])})`,
    )
  }

  private compileAccessWhenTask(when: ExpressionValue, key: string, generator: CodeGenerator): CodeFragment {
    const evaluate = this.compileFunctionExpression('evaluateAccessHookWhen', generator, body => {
      body.return(code`Boolean(${this.expr.compileOperandCode(when.node)})`)
    })

    return code`${CONTEXT}.workTasks.accessHookWhen(${key}, ${objectCode([{ key: 'evaluate', value: evaluate }])})`
  }

  private compileSubmitPredicateTask(
    predicate: ExpressionValue,
    key: string,
    name: string,
    generator: CodeGenerator,
  ): CodeFragment {
    const evaluate = this.compileFunctionExpression(
      `evaluateSubmit${this.toFunctionNamePart(name)}`,
      generator,
      body => {
        body.return(code`Boolean(${this.expr.compileOperandCode(predicate.node)})`)
      },
    )

    return code`${CONTEXT}.workTasks.submitPredicate(${key}, ${objectCode([
      { key: 'name', value: literal(name) },
      { key: 'evaluate', value: evaluate },
    ])})`
  }

  private compileCurrentStepValidationTask(key: string, groups: readonly string[]): CodeFragment {
    return code`${CONTEXT}.workTasks.currentStepValidation(${key}, ${objectCode([
      { key: 'groups', value: literal(groups) },
      { key: 'includeSubmissionOnly', value: literal(true) },
    ])})`
  }

  /**
   * Compiles a `next` function that walks the authored outcomes in order and
   * returns the first that applies. Outcomes after an unconditional one are
   * unreachable and never emitted.
   */
  private compileNextFunction(
    prefix: string,
    outcomes: readonly HookOutcomeModel[],
    generator: CodeGenerator,
  ): CodeFragment {
    return this.compileFunctionExpression(prefix, generator, body => {
      this.reachableOutcomes(outcomes).forEach(outcome => this.compileOutcome(outcome, body))
    })
  }

  private reachableOutcomes(outcomes: readonly HookOutcomeModel[]): readonly HookOutcomeModel[] {
    const terminalIndex = outcomes.findIndex(outcome => this.isUnconditionalTerminalOutcome(outcome))

    return terminalIndex === -1 ? outcomes : outcomes.slice(0, terminalIndex + 1)
  }

  /**
   * True when the outcome always returns: no `when` guard, and a value that
   * cannot resolve to undefined (a dynamic redirect target can, so a dynamic
   * redirect may still fall through to later outcomes).
   */
  private isUnconditionalTerminalOutcome(outcome: HookOutcomeModel): boolean {
    if (outcome.when !== undefined) {
      return false
    }

    return outcome.kind === HookOutcomeKind.THROW_ERROR || typeof outcome.goto === 'string'
  }

  private compileOutcome(outcome: HookOutcomeModel, generator: CodeGenerator): void {
    const emitReturn =
      outcome.kind === HookOutcomeKind.REDIRECT
        ? () => this.compileRedirectReturn(outcome, generator)
        : () => this.compileThrowErrorReturn(outcome, generator)

    if (outcome.when === undefined) {
      emitReturn()

      return
    }

    const outcomeWhen = generator.const(
      'outcomeWhen',
      code`Boolean(${this.expr.compileOperandCode(outcome.when.node)})`,
    )

    generator.if(outcomeWhen, emitReturn)
  }

  private compileRedirectReturn(redirect: RedirectOutcomeModel, generator: CodeGenerator): void {
    if (typeof redirect.goto === 'string') {
      generator.return(this.redirectResult(literal(redirect.goto)))

      return
    }

    const gotoValue = generator.const('gotoValue', this.expr.compileOperandCode(redirect.goto.node))

    generator.if(code`${gotoValue} !== undefined`, () => {
      generator.return(this.redirectResult(code`String(${gotoValue})`))
    })
  }

  private redirectResult(value: CodeFragment): CodeFragment {
    return objectCode([
      { key: 'type', value: literal('redirect') },
      { key: 'value', value },
    ])
  }

  private compileThrowErrorReturn(errorOutcome: ThrowErrorOutcomeModel, generator: CodeGenerator): void {
    generator.return(
      objectCode([
        { key: 'type', value: literal('error') },
        {
          key: 'value',
          value: objectCode([
            { key: 'status', value: literal(errorOutcome.status) },
            { key: 'message', value: this.compileErrorMessage(errorOutcome.message, generator) },
          ]),
        },
      ]),
    )
  }

  private compileErrorMessage(message: string | ExpressionValue, generator: CodeGenerator): CodeFragment {
    if (typeof message === 'string') {
      return literal(message)
    }

    const messageValue = generator.const('messageValue', this.expr.compileOperandCode(message.node))

    return code`${messageValue} !== undefined ? String(${messageValue}) : ""`
  }

  private compileEffectCall(effect: EffectCall): CodeFragment {
    const argExprs = effect.arguments.map(arg => this.expr.compileOperandCode(toRawOperand(arg)))

    return this.expr.compileFunctionCallCode(
      effect.name,
      [code`${CONTEXT}.effectFunctionContext`, ...argExprs],
      effect.node.node,
    )
  }

  /**
   * Emits a named function expression that is async only when its body awaits
   * — the dispatcher emits `await` solely for async registered functions, so
   * hooks built from sync expressions compile to plain sync functions.
   */
  private compileFunctionExpression(
    prefix: string,
    generator: CodeGenerator,
    buildBody: (generator: CodeGenerator) => void,
  ): CodeFragment {
    let bodyUsesAwait = false

    return generator.functionExpression(
      prefix,
      [],
      body => {
        bodyUsesAwait = this.expr.trackNestedFunctionAwait(() => buildBody(body))
      },
      { async: () => bodyUsesAwait },
    )
  }

  private camelise(value: string): string {
    const words = value.match(/[A-Z]?[a-z0-9]+|[A-Z]+/g) ?? []
    const firstWord = (words[0] ?? 'hook').toLowerCase()

    return `${firstWord}${words
      .slice(1)
      .map(word => this.toFunctionNamePart(word.toLowerCase()))
      .join('')}`
  }

  private toFunctionNamePart(value: string): string {
    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
  }
}
