import { ASTNode } from '../../../contracts/ast/ast.type'
import type { CompiledReachabilityFactsFunction } from '../../../contracts/compiled/compiledFunctions.type'
import type {
  ForwardOutcomeGroup,
  ReachabilityEntryModel,
  ReachabilityModel,
} from '../contracts/reachabilityModel.type'
import {
  arrayCode,
  CodeFragment,
  code,
  literal,
  objectCode,
} from '../../../compilation/lowering/codegen/fragments/CodeFragment'
import CodeGenerator from '../../../compilation/lowering/codegen/CodeGenerator'
import IdentifierName from '../../../compilation/lowering/codegen/fragments/IdentifierName'
import type { CompilationDependencies } from '../../../compilation/lowering/compilationDependencies.type'
import ExpressionDispatcher from '../../../compilation/lowering/expressions/ExpressionDispatcher'
import {
  CompilationPhase,
  compileGeneratedFunction,
  renderGeneratedSource,
} from '../../../compilation/lowering/GeneratedFunctionCompiler'

interface ReachabilityResultNames {
  readonly entryResults: IdentifierName
  readonly outcomeValues: IdentifierName
  readonly declaredOutcomeValues: IdentifierName
  readonly tieBreakerPriorities: IdentifierName
  readonly resumeActive: IdentifierName
}

/** Builds the generated function that evaluates reachability facts (entry predicates, forward outcomes, and tie-breakers) from the reachability model. */
export default class ReachabilityCompiler {
  private readonly expr: ExpressionDispatcher

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
  }

  compileFacts(model: ReachabilityModel): CompiledReachabilityFactsFunction {
    return compileGeneratedFunction<CompiledReachabilityFactsFunction>(
      this.expr,
      ['ctx'],
      () => this.buildFactsSource(model),
      { phase: CompilationPhase.REACHABILITY, label: model.label },
    )
  }

  generateFactsSource(model: ReachabilityModel): string {
    return renderGeneratedSource(this.expr, () => this.buildFactsSource(model))
  }

  private buildFactsSource(model: ReachabilityModel): CodeGenerator {
    const generator = CodeGenerator.forFunction(['ctx'])

    generator.directive('use strict')
    generator.comment('ReachabilityCompiler.buildFactsSource')
    const resultNames = this.compileReachabilityResult(model, generator)

    generator.return(this.buildReachabilityResultExpression(resultNames))

    return generator
  }

  private compileReachabilityResult(model: ReachabilityModel, generator: CodeGenerator): ReachabilityResultNames {
    const stepCount = model.entries.length
    const entryResults = generator.const('entryResults', code`new Array(${stepCount})`)
    const outcomeValues = generator.const('outcomeValues', arrayCode(model.entries.map(() => code`[]`)))
    const declaredOutcomeValues = generator.const('declaredOutcomeValues', arrayCode(model.entries.map(() => code`[]`)))
    const tieBreakerPriorities = generator.const('tieBreakerPriorities', code`new Array(${stepCount})`)

    this.compileEntryPredicates(model.entries, entryResults, generator)
    this.compileForwardOutcomes(model.entries, outcomeValues, declaredOutcomeValues, generator)
    this.compileTieBreakers(model.entries, tieBreakerPriorities, generator)
    const resumeActive = this.compileResumeCondition(model, generator)

    return { entryResults, outcomeValues, declaredOutcomeValues, tieBreakerPriorities, resumeActive }
  }

  private buildReachabilityResultExpression(names: ReachabilityResultNames): CodeFragment {
    return objectCode([
      { key: 'entryResults', value: names.entryResults },
      { key: 'outcomeValues', value: names.outcomeValues },
      { key: 'declaredOutcomeValues', value: names.declaredOutcomeValues },
      { key: 'tieBreakerPriorities', value: names.tieBreakerPriorities },
      { key: 'resumeActive', value: names.resumeActive },
    ])
  }

  private compileEntryPredicates(
    entries: readonly ReachabilityEntryModel[],
    entryResults: IdentifierName,
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
    entries: readonly ReachabilityEntryModel[],
    outcomeValues: IdentifierName,
    declaredOutcomeValues: IdentifierName,
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
    outcomeValues: IdentifierName,
    declaredOutcomeValues: IdentifierName,
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
    outcomeMatched: IdentifierName,
    overApproximateWhen: boolean,
    outcomeValues: IdentifierName,
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
    declaredOutcomeValues: IdentifierName,
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
    outcomeMatched: IdentifierName,
    marksOutcomeMatched: boolean,
    outcomeValues: IdentifierName,
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

  private compileGotoExpression(goto: ASTNode | string): CodeFragment | undefined {
    if (typeof goto === 'string') {
      return literal(goto)
    }

    return this.expr.isCompilableNode(goto) ? this.expr.compileExpressionCode(goto) : undefined
  }

  private compileTieBreakers(
    entries: readonly ReachabilityEntryModel[],
    tieBreakerPriorities: IdentifierName,
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

  private compileResumeCondition(model: ReachabilityModel, generator: CodeGenerator): IdentifierName {
    generator.comment('ReachabilityCompiler.compileResumeCondition')

    if (model.resumeAlways) {
      return generator.const('resumeActive', literal(true))
    }

    if (model.resumeWhen === undefined) {
      return generator.const('resumeActive', literal(false))
    }

    return generator.const('resumeActive', code`Boolean(${this.expr.compileExpressionCode(model.resumeWhen)})`)
  }
}
