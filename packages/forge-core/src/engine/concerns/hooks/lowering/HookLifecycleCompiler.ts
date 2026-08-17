import { Code, code, literal, objectCode } from '../../../compilation/codegen/Code'
import CodeGenerator from '../../../compilation/codegen/CodeGenerator'
import Name from '../../../compilation/codegen/Name'
import type { CompilationDependencies } from '../../../compilation/lowering/compilationDependencies.type'
import ExpressionDispatcher from '../../../compilation/lowering/expressions/ExpressionDispatcher'
import {
  CompilationPhase,
  compileGeneratedFunction,
  renderGeneratedSource,
} from '../../../compilation/lowering/function-construction/GeneratedFunctionCompiler'
import { toRawOperand, type ExpressionValue } from '../../../contracts/models/authoredValue.type'
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

const CONTEXT = new Name('ctx')

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
      { forceAsync: true, phase: CompilationPhase.HOOKS, label: model.label },
    )
  }

  compileSubmitHooks(model: SubmitHooksModel): CompiledSubmitHooksFunction {
    return compileGeneratedFunction<CompiledSubmitHooksFunction>(
      this.expr,
      ['ctx'],
      () => this.buildSubmitSource(model),
      { forceAsync: true, phase: CompilationPhase.HOOKS, label: model.label },
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

    generator.comment('HookLifecycleCompiler.buildAccessSource')
    const accessHooks = generator.const('accessHooks', code`[]`)

    model.hooks.forEach(hook => {
      this.compileAccessHookTask(hook, accessHooks, generator)
    })

    generator.return(code`${CONTEXT}.workTasks.accessLifecycle(${accessHooks})`)

    return generator
  }

  private buildSubmitSource(model: SubmitHooksModel): CodeGenerator {
    const generator = this.createGenerator()

    generator.comment('HookLifecycleCompiler.buildSubmitSource')
    const submitHooks = generator.const('submitHooks', code`[]`)

    model.hooks.forEach(hook => {
      this.compileSubmitHookTask(hook, submitHooks, generator)
    })

    generator.return(code`${CONTEXT}.workTasks.submitLifecycle(${submitHooks})`)

    return generator
  }

  private createGenerator(): CodeGenerator {
    const generator = CodeGenerator.forFunction(['ctx'])

    generator.directive('use strict')

    return generator
  }

  private compileAccessHookTask(hook: AccessHookModel, accessHooks: Name, generator: CodeGenerator): void {
    generator.comment(`HookLifecycleCompiler.compileAccessHookTask — ${hook.label}`)
    generator.scope(() => {
      const effects = generator.const('accessHookEffects', code`[]`)

      hook.effects.forEach(effect => {
        this.compileEffectTask(effect, effects, generator)
      })

      const props = generator.const('accessHookProps', code`{}`)

      generator.assign(code`${props}.when`, this.compileAccessWhenTask(hook, `${hook.key}-when`, generator))
      generator.assign(code`${props}.effects`, effects)
      generator.assign(code`${props}.next`, this.compileAccessNextFunction(hook, generator))
      generator.statement(code`${accessHooks}.push(${CONTEXT}.workTasks.accessHook(${hook.key}, ${props}))`)
    })
  }

  private compileEffectTask(effect: EffectCall, effects: Name, generator: CodeGenerator): void {
    generator.scope(() => {
      const props = generator.const(
        'hookEffectProps',
        objectCode([
          { key: 'name', value: literal(effect.name) },
          { key: 'run', value: this.compileEffectRunFunction(effect, generator) },
        ]),
      )

      generator.statement(code`${effects}.push(${CONTEXT}.workTasks.hookEffect(${effect.key}, ${props}))`)
    })
  }

  private compileAccessWhenTask(hook: AccessHookModel, key: string, generator: CodeGenerator): Code {
    return code`${CONTEXT}.workTasks.accessHookWhen(${key}, ${objectCode([
      { key: 'evaluate', value: this.compileAccessWhenFunction(hook, generator) },
    ])})`
  }

  private compileAccessWhenFunction(hook: AccessHookModel, generator: CodeGenerator): Code {
    const when = hook.when

    return this.compileAsyncFunctionExpression('evaluateAccessHookWhen', generator, functionGenerator => {
      if (when === undefined) {
        functionGenerator.return(literal(true))

        return
      }

      functionGenerator.return(code`Boolean(${this.expr.compileOperandCode(when.node)})`)
    })
  }

  private compileAccessNextFunction(hook: AccessHookModel, generator: CodeGenerator): Code {
    return this.compileAsyncFunctionExpression('resolveAccessHookNext', generator, functionGenerator => {
      const outcome = functionGenerator.let('outcome')

      this.compileOutcomeAssignment(hook.outcomes, outcome, functionGenerator)
      functionGenerator.return(outcome)
    })
  }

  private compileEffectRunFunction(effect: EffectCall, generator: CodeGenerator): Code {
    return this.compileAsyncFunctionExpression('runHookEffect', generator, functionGenerator => {
      functionGenerator.statement(code`await ${this.compileEffectCall(effect)}`)
    })
  }

  private compileSubmitHookTask(hook: SubmitHookModel, submitHooks: Name, generator: CodeGenerator): void {
    generator.comment(`HookLifecycleCompiler.compileSubmitHookTask — ${hook.label}`)
    generator.scope(() => {
      const props = generator.const('submitHookProps', code`{}`)

      generator.assign(
        code`${props}.when`,
        this.compileSubmitPredicateTask(hook.when, true, `${hook.key}-when`, 'when', generator),
      )
      generator.assign(
        code`${props}.guards`,
        this.compileSubmitPredicateTask(hook.guards, true, `${hook.key}-guards`, 'guards', generator),
      )
      generator.assign(
        code`${props}.onAlways`,
        this.compileSubmitBranchTask(hook.branches.onAlways, `${hook.key}-onAlways`, 'onAlways', generator),
      )

      if (hook.validate) {
        generator.assign(
          code`${props}.validation`,
          this.compileCurrentStepValidationTask(`${hook.key}-validation`, hook.validationGroups),
        )
      }

      if (hook.branches.onValid !== undefined) {
        generator.assign(
          code`${props}.onValid`,
          this.compileSubmitBranchTask(hook.branches.onValid, `${hook.key}-onValid`, 'onValid', generator),
        )
      }

      if (hook.branches.onInvalid !== undefined) {
        generator.assign(
          code`${props}.onInvalid`,
          this.compileSubmitBranchTask(hook.branches.onInvalid, `${hook.key}-onInvalid`, 'onInvalid', generator),
        )
      }

      generator.statement(code`${submitHooks}.push(${CONTEXT}.workTasks.submitHook(${hook.key}, ${props}))`)
    })
  }

  private compileSubmitPredicateTask(
    predicate: ExpressionValue | undefined,
    defaultValue: boolean,
    key: string,
    name: string,
    generator: CodeGenerator,
  ): Code {
    return code`${CONTEXT}.workTasks.submitPredicate(${key}, ${objectCode([
      { key: 'name', value: literal(name) },
      { key: 'evaluate', value: this.compileSubmitPredicateFunction(predicate, defaultValue, name, generator) },
    ])})`
  }

  private compileSubmitPredicateFunction(
    predicate: ExpressionValue | undefined,
    defaultValue: boolean,
    name: string,
    generator: CodeGenerator,
  ): Code {
    return this.compileAsyncFunctionExpression(`evaluateSubmit${this.toFunctionNamePart(name)}`, generator, body => {
      if (predicate === undefined) {
        body.return(literal(defaultValue))

        return
      }

      body.return(code`Boolean(${this.expr.compileOperandCode(predicate.node)})`)
    })
  }

  private compileSubmitBranchTask(
    branch: SubmitBranchModel,
    key: string,
    name: 'onAlways' | 'onValid' | 'onInvalid',
    generator: CodeGenerator,
  ): Code {
    const effects = generator.const(`${name}Effects`, code`[]`)

    branch.effects.forEach(effect => {
      this.compileEffectTask(effect, effects, generator)
    })

    const props = generator.const(
      `${name}Props`,
      objectCode([
        { key: 'name', value: literal(name) },
        { key: 'effects', value: effects },
        { key: 'next', value: this.compileOutcomeFunction(branch.outcomes, name, generator) },
      ]),
    )

    return code`${CONTEXT}.workTasks.submitBranch(${key}, ${props})`
  }

  private compileCurrentStepValidationTask(key: string, groups: readonly string[]): Code {
    return code`${CONTEXT}.workTasks.currentStepValidation(${key}, ${objectCode([
      { key: 'groups', value: literal(groups) },
      { key: 'includeSubmissionOnly', value: literal(true) },
    ])})`
  }

  private compileOutcomeFunction(outcomes: readonly HookOutcomeModel[], name: string, generator: CodeGenerator): Code {
    return this.compileAsyncFunctionExpression(`resolveSubmit${this.toFunctionNamePart(name)}Next`, generator, body => {
      const outcome = body.let('outcome')

      this.compileOutcomeAssignment(outcomes, outcome, body)
      body.return(outcome)
    })
  }

  private compilePredicate(
    predicate: ExpressionValue | undefined,
    defaultValue: boolean,
    generator: CodeGenerator,
    prefix: string,
  ): Name {
    if (predicate === undefined) {
      return generator.const(prefix, literal(defaultValue))
    }

    return generator.const(prefix, code`Boolean(${this.expr.compileOperandCode(predicate.node)})`)
  }

  private compileEffectCall(effect: EffectCall): Code {
    const argExprs = effect.arguments.map(arg => this.expr.compileOperandCode(toRawOperand(arg)))

    return this.expr.compileFunctionCallCode(
      effect.name,
      [code`${CONTEXT}.effectFunctionContext`, ...argExprs],
      effect.node.node,
    )
  }

  private compileOutcomeAssignment(
    outcomes: readonly HookOutcomeModel[],
    outcome: Name,
    generator: CodeGenerator,
  ): void {
    outcomes.forEach(outcomeModel => {
      generator.if(code`${outcome} === undefined`, () => {
        if (outcomeModel.kind === HookOutcomeKind.REDIRECT) {
          this.compileRedirectOutcome(outcomeModel, outcome, generator)

          return
        }

        this.compileThrowErrorOutcome(outcomeModel, outcome, generator)
      })
    })
  }

  private compileRedirectOutcome(redirect: RedirectOutcomeModel, outcome: Name, generator: CodeGenerator): void {
    const when = this.compilePredicate(redirect.when, true, generator, 'outcomeWhen')

    generator.if(when, () => {
      const gotoValue = generator.const('gotoValue', this.compileOutcomeValue(redirect.goto))

      generator.if(code`${gotoValue} !== undefined`, () => {
        generator.assign(
          outcome,
          objectCode([
            { key: 'type', value: literal('redirect') },
            { key: 'value', value: code`String(${gotoValue})` },
          ]),
        )
      })
    })
  }

  private compileThrowErrorOutcome(
    errorOutcome: ThrowErrorOutcomeModel,
    outcome: Name,
    generator: CodeGenerator,
  ): void {
    const when = this.compilePredicate(errorOutcome.when, true, generator, 'outcomeWhen')

    generator.if(when, () => {
      const messageValue = generator.const('messageValue', this.compileOutcomeValue(errorOutcome.message))

      generator.assign(
        outcome,
        objectCode([
          { key: 'type', value: literal('error') },
          {
            key: 'value',
            value: objectCode([
              { key: 'status', value: literal(errorOutcome.status) },
              {
                key: 'message',
                value: code`${messageValue} !== undefined ? String(${messageValue}) : ""`,
              },
            ]),
          },
        ]),
      )
    })
  }

  private compileOutcomeValue(value: string | ExpressionValue): Code {
    return typeof value === 'string' ? literal(value) : this.expr.compileOperandCode(value.node)
  }

  private compileAsyncFunctionExpression(
    prefix: string,
    generator: CodeGenerator,
    buildBody: (generator: CodeGenerator) => void,
  ): Code {
    return generator.functionExpression(prefix, [], buildBody, { async: true })
  }

  private toFunctionNamePart(value: string): string {
    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
  }
}
