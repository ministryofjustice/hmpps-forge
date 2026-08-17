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
import { isRedirectOutcomeNode, isThrowErrorOutcomeNode } from '../../../contracts/ast/outcome-nodes'
import { Code, code, literal, objectCode } from '../../../compilation/codegen/Code'
import CodeGenerator from '../../../compilation/codegen/CodeGenerator'
import Name from '../../../compilation/codegen/Name'
import type { CompilationDependencies } from '../../../compilation/lowering/compilationDependencies.type'
import ExpressionDispatcher from '../../../compilation/lowering/expressions/ExpressionDispatcher'
import {
  compileGeneratedFunction,
  deriveScriptLabel,
  renderGeneratedSource,
  ScriptLabelSource,
} from '../../../compilation/lowering/function-construction/GeneratedFunctionCompiler'
import type { CompiledAccessLifecycleFunction, CompiledSubmitHooksFunction } from '../contracts/hookLifecycle.type'

const CONTEXT = new Name('ctx')

export default class HookLifecycleCompiler {
  private readonly expr: ExpressionDispatcher

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
  }

  compileAccessLifecycle(
    stepNode: ScriptLabelSource | undefined,
    hooks: AccessHookASTNode[],
  ): CompiledAccessLifecycleFunction {
    return compileGeneratedFunction<CompiledAccessLifecycleFunction>(
      this.expr,
      ['ctx'],
      () => this.buildAccessSource(hooks),
      { forceAsync: true, phase: 'hooks', label: deriveScriptLabel([stepNode, ...hooks]) },
    )
  }

  compileSubmitHooks(stepNode: ScriptLabelSource | undefined, hooks: SubmitHookASTNode[]): CompiledSubmitHooksFunction {
    return compileGeneratedFunction<CompiledSubmitHooksFunction>(
      this.expr,
      ['ctx'],
      () => this.buildSubmitSource(hooks),
      { forceAsync: true, phase: 'hooks', label: deriveScriptLabel([stepNode, ...hooks]) },
    )
  }

  generateAccessSource(hooks: AccessHookASTNode[]): string {
    return renderGeneratedSource(this.expr, () => this.buildAccessSource(hooks))
  }

  generateSubmitSource(hooks: SubmitHookASTNode[]): string {
    return renderGeneratedSource(this.expr, () => this.buildSubmitSource(hooks))
  }

  private buildAccessSource(hooks: AccessHookASTNode[]): CodeGenerator {
    const generator = this.createGenerator()

    generator.comment('HookLifecycleCompiler.buildAccessSource')
    const accessHooks = generator.const('accessHooks', code`[]`)

    hooks.forEach((hook, hookIndex) => {
      this.compileAccessHookTask(hook, hookIndex, accessHooks, generator)
    })

    generator.return(code`${CONTEXT}.workTasks.accessLifecycle(${accessHooks})`)

    return generator
  }

  private buildSubmitSource(hooks: SubmitHookASTNode[]): CodeGenerator {
    const generator = this.createGenerator()

    generator.comment('HookLifecycleCompiler.buildSubmitSource')
    const submitHooks = generator.const('submitHooks', code`[]`)

    hooks.forEach((hook, hookIndex) => {
      this.compileSubmitHookTask(hook, hookIndex, submitHooks, generator)
    })

    generator.return(code`${CONTEXT}.workTasks.submitLifecycle(${submitHooks})`)

    return generator
  }

  private createGenerator(): CodeGenerator {
    const generator = CodeGenerator.forFunction(['ctx'])

    generator.directive('use strict')

    return generator
  }

  private compileAccessHookTask(
    hook: AccessHookASTNode,
    hookIndex: number,
    accessHooks: Name,
    generator: CodeGenerator,
  ): void {
    const hookKey = `access-hook-${hookIndex}`

    generator.comment(`HookLifecycleCompiler.compileAccessHookTask — ${this.describeHookNode(hook, hookKey)}`)
    generator.scope(() => {
      const effects = generator.const('accessHookEffects', code`[]`)

      hook.properties.effects?.filter(this.isEffectNode).forEach((effect, effectIndex) => {
        this.compileEffectTask(effect, `${hookKey}-effect-${effectIndex}`, effects, generator)
      })

      const props = generator.const('accessHookProps', code`{}`)

      generator.assign(code`${props}.when`, this.compileAccessWhenTask(hook, `${hookKey}-when`, generator))
      generator.assign(code`${props}.effects`, effects)
      generator.assign(code`${props}.next`, this.compileAccessNextFunction(hook, generator))
      generator.statement(code`${accessHooks}.push(${CONTEXT}.workTasks.accessHook(${hookKey}, ${props}))`)
    })
  }

  private compileEffectTask(effect: FunctionASTNode, effectKey: string, effects: Name, generator: CodeGenerator): void {
    generator.scope(() => {
      const props = generator.const(
        'hookEffectProps',
        objectCode([
          { key: 'name', value: literal(effect.properties.name) },
          { key: 'run', value: this.compileEffectRunFunction(effect, generator) },
        ]),
      )

      generator.statement(code`${effects}.push(${CONTEXT}.workTasks.hookEffect(${effectKey}, ${props}))`)
    })
  }

  private describeHookNode(hook: AccessHookASTNode | SubmitHookASTNode, hookKey: string): string {
    return hook.diagnostics?.source.formattedPath ?? hookKey
  }

  private compileAccessWhenTask(hook: AccessHookASTNode, key: string, generator: CodeGenerator): Code {
    return code`${CONTEXT}.workTasks.accessHookWhen(${key}, ${objectCode([
      { key: 'evaluate', value: this.compileAccessWhenFunction(hook, generator) },
    ])})`
  }

  private compileAccessWhenFunction(hook: AccessHookASTNode, generator: CodeGenerator): Code {
    const when = hook.properties.when

    return this.compileAsyncFunctionExpression('evaluateAccessHookWhen', generator, functionGenerator => {
      if (when === undefined) {
        functionGenerator.return(literal(true))

        return
      }

      functionGenerator.return(code`Boolean(${this.expr.compileExpressionCode(when)})`)
    })
  }

  private compileAccessNextFunction(hook: AccessHookASTNode, generator: CodeGenerator): Code {
    return this.compileAsyncFunctionExpression('resolveAccessHookNext', generator, functionGenerator => {
      const outcome = functionGenerator.let('outcome')

      this.compileOutcomeAssignment(hook.properties.next, outcome, functionGenerator)
      functionGenerator.return(outcome)
    })
  }

  private compileEffectRunFunction(effect: FunctionASTNode, generator: CodeGenerator): Code {
    return this.compileAsyncFunctionExpression('runHookEffect', generator, functionGenerator => {
      functionGenerator.statement(code`await ${this.compileEffectCall(effect)}`)
    })
  }

  private compileSubmitHookTask(
    hook: SubmitHookASTNode,
    hookIndex: number,
    submitHooks: Name,
    generator: CodeGenerator,
  ): void {
    const hookKey = `submit-hook-${hookIndex}`

    generator.comment(`HookLifecycleCompiler.compileSubmitHookTask — ${this.describeHookNode(hook, hookKey)}`)
    generator.scope(() => {
      const props = generator.const('submitHookProps', code`{}`)
      const validationGroups =
        hook.properties.validationGroups.length > 0 ? hook.properties.validationGroups : ['default']

      generator.assign(
        code`${props}.when`,
        this.compileSubmitPredicateTask(hook.properties.when, true, `${hookKey}-when`, 'when', generator),
      )
      generator.assign(
        code`${props}.guards`,
        this.compileSubmitPredicateTask(hook.properties.guards, true, `${hookKey}-guards`, 'guards', generator),
      )
      generator.assign(
        code`${props}.onAlways`,
        this.compileSubmitBranchTask(hook.properties.onAlways, `${hookKey}-onAlways`, 'onAlways', generator),
      )

      if (hook.properties.validate) {
        generator.assign(
          code`${props}.validation`,
          this.compileCurrentStepValidationTask(`${hookKey}-validation`, validationGroups),
        )
      }

      if (hook.properties.onValid !== undefined) {
        generator.assign(
          code`${props}.onValid`,
          this.compileSubmitBranchTask(hook.properties.onValid, `${hookKey}-onValid`, 'onValid', generator),
        )
      }

      if (hook.properties.onInvalid !== undefined) {
        generator.assign(
          code`${props}.onInvalid`,
          this.compileSubmitBranchTask(hook.properties.onInvalid, `${hookKey}-onInvalid`, 'onInvalid', generator),
        )
      }

      generator.statement(code`${submitHooks}.push(${CONTEXT}.workTasks.submitHook(${hookKey}, ${props}))`)
    })
  }

  private compileSubmitPredicateTask(
    predicate: ASTNode | undefined,
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
    predicate: ASTNode | undefined,
    defaultValue: boolean,
    name: string,
    generator: CodeGenerator,
  ): Code {
    return this.compileAsyncFunctionExpression(`evaluateSubmit${this.toFunctionNamePart(name)}`, generator, body => {
      if (predicate === undefined) {
        body.return(literal(defaultValue))

        return
      }

      body.return(code`Boolean(${this.expr.compileExpressionCode(predicate)})`)
    })
  }

  private compileSubmitBranchTask(
    branch: { effects?: ASTNode[]; next?: ASTNode[] } | undefined,
    key: string,
    name: 'onAlways' | 'onValid' | 'onInvalid',
    generator: CodeGenerator,
  ): Code {
    const effects = generator.const(`${name}Effects`, code`[]`)

    branch?.effects?.filter(this.isEffectNode).forEach((effect, effectIndex) => {
      this.compileEffectTask(effect, `${key}-effect-${effectIndex}`, effects, generator)
    })

    const props = generator.const(
      `${name}Props`,
      objectCode([
        { key: 'name', value: literal(name) },
        { key: 'effects', value: effects },
        { key: 'next', value: this.compileOutcomeFunction(branch?.next, name, generator) },
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

  private compileOutcomeFunction(next: ASTNode[] | undefined, name: string, generator: CodeGenerator): Code {
    return this.compileAsyncFunctionExpression(`resolveSubmit${this.toFunctionNamePart(name)}Next`, generator, body => {
      const outcome = body.let('outcome')

      this.compileOutcomeAssignment(next, outcome, body)
      body.return(outcome)
    })
  }

  private compilePredicate(
    predicate: ASTNode | undefined,
    defaultValue: boolean,
    generator: CodeGenerator,
    prefix: string,
  ): Name {
    if (predicate === undefined) {
      return generator.const(prefix, literal(defaultValue))
    }

    return generator.const(prefix, code`Boolean(${this.expr.compileExpressionCode(predicate)})`)
  }

  private compileEffectCall(effect: FunctionASTNode): Code {
    const funcName = effect.properties.name
    const argExprs = effect.properties.arguments.map(arg => this.expr.compileOperandCode(arg))

    return this.expr.compileFunctionCallCode(funcName, [code`${CONTEXT}.effectFunctionContext`, ...argExprs], effect)
  }

  private compileOutcomeAssignment(next: ASTNode[] | undefined, outcome: Name, generator: CodeGenerator): void {
    if (next === undefined || next.length === 0) {
      return
    }

    next.filter(this.isOutcomeNode).forEach(outcomeNode => {
      generator.if(code`${outcome} === undefined`, () => {
        if (isRedirectOutcomeNode(outcomeNode)) {
          this.compileRedirectOutcome(outcomeNode, outcome, generator)

          return
        }

        if (isThrowErrorOutcomeNode(outcomeNode)) {
          this.compileThrowErrorOutcome(outcomeNode, outcome, generator)
        }
      })
    })
  }

  private compileRedirectOutcome(redirect: RedirectOutcomeASTNode, outcome: Name, generator: CodeGenerator): void {
    const when = this.compilePredicate(redirect.properties.when, true, generator, 'outcomeWhen')

    generator.if(when, () => {
      const gotoValue = generator.const('gotoValue', this.compileOutcomeValue(redirect.properties.goto))

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
    errorOutcome: ThrowErrorOutcomeASTNode,
    outcome: Name,
    generator: CodeGenerator,
  ): void {
    const when = this.compilePredicate(errorOutcome.properties.when, true, generator, 'outcomeWhen')

    generator.if(when, () => {
      const messageValue = generator.const('messageValue', this.compileOutcomeValue(errorOutcome.properties.message))

      generator.assign(
        outcome,
        objectCode([
          { key: 'type', value: literal('error') },
          {
            key: 'value',
            value: objectCode([
              { key: 'status', value: literal(errorOutcome.properties.status) },
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

  private compileOutcomeValue(value: ASTNode | string): Code {
    return typeof value === 'string' ? literal(value) : this.expr.compileExpressionCode(value)
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

  private isEffectNode(node: ASTNode): node is FunctionASTNode {
    return node.type === ASTNodeType.EXPRESSION &&
      (node as { expressionType?: unknown }).expressionType === FunctionType.EFFECT
  }

  private isOutcomeNode(node: ASTNode): node is RedirectOutcomeASTNode | ThrowErrorOutcomeASTNode {
    return isRedirectOutcomeNode(node) || isThrowErrorOutcomeNode(node)
  }
}
