import { ASTNode } from '../../../contracts/ast/ast.type'
import type { CompiledReachabilityFactsFunction } from '../../../contracts/compiled/compiledFunctions.type'
import type {
  ForwardOutcomeGroup,
  ReachabilityCompilationEntry,
  ReachabilityCompilationPlan,
} from '../../../contracts/plans/runtimePlans.type'
import { arrayCode, Code, code, literal, objectCode } from '../../../compilation/codegen/Code'
import CodeGenerator from '../../../compilation/codegen/CodeGenerator'
import Name from '../../../compilation/codegen/Name'
import type { CompilationDependencies } from '../../../compilation/lowering/compilationDependencies.type'
import ExpressionDispatcher from '../../../compilation/lowering/expressions/ExpressionDispatcher'
import {
  compileGeneratedFunction,
  deriveScriptLabel,
  renderGeneratedSource,
} from '../../../compilation/lowering/function-construction/GeneratedFunctionCompiler'

interface ReachabilityResultNames {
  readonly entryResults: Name
  readonly outcomeValues: Name
  readonly declaredOutcomeValues: Name
  readonly tieBreakerPriorities: Name
  readonly resumeActive: Name
}

/** Builds the generated reachability facts function from a compilation plan. */
export default class ReachabilityCompiler {
  private readonly expr: ExpressionDispatcher

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
  }

  compileFacts(plan: ReachabilityCompilationPlan): CompiledReachabilityFactsFunction {
    return compileGeneratedFunction<CompiledReachabilityFactsFunction>(
      this.expr,
      ['ctx'],
      () => this.buildFactsSource(plan),
      { phase: 'reachability', label: this.deriveJourneyLabel(plan) },
    )
  }

  generateFactsSource(plan: ReachabilityCompilationPlan): string {
    return renderGeneratedSource(this.expr, () => this.buildFactsSource(plan))
  }

  private deriveJourneyLabel(plan: ReachabilityCompilationPlan): string | undefined {
    const dynamicNodes = [
      plan.resumeWhen,
      ...plan.entries.flatMap(entry => [
        entry.entryWhen,
        ...entry.forwardOutcomeGroups.flatMap(group => group.redirectOutcomes.map(outcome => outcome.node)),
      ]),
    ]

    return deriveScriptLabel(dynamicNodes, { maxDepth: 1 })
  }

  private buildFactsSource(plan: ReachabilityCompilationPlan): CodeGenerator {
    const generator = CodeGenerator.forFunction(['ctx'])

    generator.directive('use strict')
    generator.comment('ReachabilityCompiler.buildFactsSource')
    const resultNames = this.compileReachabilityResult(plan, generator)

    generator.return(this.buildReachabilityResultExpression(resultNames))

    return generator
  }

  private compileReachabilityResult(
    plan: ReachabilityCompilationPlan,
    generator: CodeGenerator,
  ): ReachabilityResultNames {
    const stepCount = plan.entries.length
    const entryResults = generator.const('entryResults', code`new Array(${stepCount})`)
    const outcomeValues = generator.const('outcomeValues', arrayCode(plan.entries.map(() => code`[]`)))
    const declaredOutcomeValues = generator.const('declaredOutcomeValues', arrayCode(plan.entries.map(() => code`[]`)))
    const tieBreakerPriorities = generator.const('tieBreakerPriorities', code`new Array(${stepCount})`)

    this.compileEntryPredicates(plan.entries, entryResults, generator)
    this.compileForwardOutcomes(plan.entries, outcomeValues, declaredOutcomeValues, generator)
    this.compileTieBreakers(plan.entries, tieBreakerPriorities, generator)
    const resumeActive = this.compileResumeCondition(plan, generator)

    return { entryResults, outcomeValues, declaredOutcomeValues, tieBreakerPriorities, resumeActive }
  }

  private buildReachabilityResultExpression(names: ReachabilityResultNames): Code {
    return objectCode([
      { key: 'entryResults', value: names.entryResults },
      { key: 'outcomeValues', value: names.outcomeValues },
      { key: 'declaredOutcomeValues', value: names.declaredOutcomeValues },
      { key: 'tieBreakerPriorities', value: names.tieBreakerPriorities },
      { key: 'resumeActive', value: names.resumeActive },
    ])
  }

  private compileEntryPredicates(
    entries: ReachabilityCompilationEntry[],
    entryResults: Name,
    generator: CodeGenerator,
  ): void {
    generator.comment('ReachabilityCompiler.compileEntryPredicates')

    entries.forEach((entry, index) => {
      const node = entry.entryWhen

      if (node === undefined) {
        return
      }

      generator.scope(() => {
        const predicate = generator.const('entryPredicate', code`Boolean(${this.expr.compileExpressionCode(node)})`)

        generator.assign(code`${entryResults}[${index}]`, predicate)
      })
    })
  }

  private compileForwardOutcomes(
    entries: ReachabilityCompilationEntry[],
    outcomeValues: Name,
    declaredOutcomeValues: Name,
    generator: CodeGenerator,
  ): void {
    generator.comment('ReachabilityCompiler.compileForwardOutcomes')

    entries.forEach((entry, stepIndex) => {
      entry.forwardOutcomeGroups.forEach(group => {
        this.compileForwardOutcomeGroup(group, stepIndex, outcomeValues, declaredOutcomeValues, generator)
      })
    })
  }

  private compileForwardOutcomeGroup(
    group: ForwardOutcomeGroup,
    stepIndex: number,
    outcomeValues: Name,
    declaredOutcomeValues: Name,
    generator: CodeGenerator,
  ): void {
    group.redirectOutcomes.forEach(outcome => {
      this.compileDeclaredGotoResolution(outcome.node.properties.goto, stepIndex, declaredOutcomeValues, generator)
    })

    const emitCascade = () => {
      generator.scope(() => {
        const outcomeMatched = generator.let('outcomeMatched', literal(false))

        group.redirectOutcomes.forEach(outcome => {
          this.compileForwardOutcomeCascade(
            outcome.node.properties,
            stepIndex,
            outcomeMatched,
            outcome.overApproximatesWhen,
            outcomeValues,
            generator,
          )
        })
      })
    }

    const hookWhenNode = group.hookWhen

    if (hookWhenNode !== undefined) {
      generator.scope(() => {
        const hookWhen = generator.const('hookWhen', code`Boolean(${this.expr.compileExpressionCode(hookWhenNode)})`)

        generator.if(hookWhen, emitCascade)
      })

      return
    }

    emitCascade()
  }

  private compileForwardOutcomeCascade(
    properties: { readonly when?: ASTNode; readonly goto: ASTNode | string },
    stepIndex: number,
    outcomeMatched: Name,
    overApproximateWhen: boolean,
    outcomeValues: Name,
    generator: CodeGenerator,
  ): void {
    generator.scope(() => {
      generator.if(code`${outcomeMatched} === false`, () => {
        const { when, goto } = properties

        if (!overApproximateWhen && when !== undefined && this.expr.isCompilableNode(when)) {
          const outcomeWhen = generator.const('outcomeWhen', code`Boolean(${this.expr.compileExpressionCode(when)})`)

          generator.if(outcomeWhen, () => {
            this.compileGotoResolution(goto, stepIndex, outcomeMatched, true, outcomeValues, generator)
          })

          return
        }

        this.compileGotoResolution(goto, stepIndex, outcomeMatched, !overApproximateWhen, outcomeValues, generator)
      })
    })
  }

  private compileDeclaredGotoResolution(
    goto: ASTNode | string,
    stepIndex: number,
    declaredOutcomeValues: Name,
    generator: CodeGenerator,
  ): void {
    if (typeof goto !== 'string') {
      return
    }

    generator.statement(code`${declaredOutcomeValues}[${stepIndex}].push(${goto})`)
  }

  private compileGotoResolution(
    goto: ASTNode | string,
    stepIndex: number,
    outcomeMatched: Name,
    marksOutcomeMatched: boolean,
    outcomeValues: Name,
    generator: CodeGenerator,
  ): void {
    const gotoExpression = this.compileGotoExpression(goto)

    if (gotoExpression === undefined) {
      return
    }

    const gotoValue = generator.const('gotoValue', gotoExpression)

    generator.if(code`${gotoValue} !== undefined`, () => {
      generator.statement(code`${outcomeValues}[${stepIndex}].push(String(${gotoValue}))`)

      if (marksOutcomeMatched) {
        generator.assign(outcomeMatched, literal(true))
      }
    })
  }

  private compileGotoExpression(goto: ASTNode | string): Code | undefined {
    if (typeof goto === 'string') {
      return literal(goto)
    }

    return this.expr.isCompilableNode(goto) ? this.expr.compileExpressionCode(goto) : undefined
  }

  private compileTieBreakers(
    entries: ReachabilityCompilationEntry[],
    tieBreakerPriorities: Name,
    generator: CodeGenerator,
  ): void {
    generator.comment('ReachabilityCompiler.compileTieBreakers')

    entries.forEach((entry, index) => {
      if (entry.reachabilityTieBreakers.length === 0) {
        return
      }

      generator.scope(() => {
        const priority = generator.let('tieBreakerPriority')

        entry.reachabilityTieBreakers.forEach(tieBreaker => {
          generator.if(code`${priority} === undefined`, () => {
            if (tieBreaker.when === undefined) {
              generator.assign(priority, literal(tieBreaker.priority))

              return
            }

            const when = generator.const(
              'tieBreakerWhen',
              code`Boolean(${this.expr.compileExpressionCode(tieBreaker.when)})`,
            )

            generator.if(when, () => {
              generator.assign(priority, literal(tieBreaker.priority))
            })
          })
        })
        generator.assign(code`${tieBreakerPriorities}[${index}]`, priority)
      })
    })
  }

  private compileResumeCondition(plan: ReachabilityCompilationPlan, generator: CodeGenerator): Name {
    generator.comment('ReachabilityCompiler.compileResumeCondition')

    if (plan.resumeAlways) {
      return generator.const('resumeActive', literal(true))
    }

    if (plan.resumeWhen === undefined) {
      return generator.const('resumeActive', literal(false))
    }

    return generator.const('resumeActive', code`Boolean(${this.expr.compileExpressionCode(plan.resumeWhen)})`)
  }
}
