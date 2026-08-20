import { ASTNode } from '../../../chassis/contracts/ast/ast.type'
import type { CompiledReachabilityFactsFunction } from '../../../chassis/contracts/compiled/compiledFunctions.type'
import type {
  ForwardOutcomeGroup,
  ForwardRedirectOutcome,
  ReachabilityEntryModel,
  ReachabilityModel,
  ReachabilityTieBreakerEntry,
} from '../contracts/reachabilityModel.type'
import {
  arrayCode,
  CodeFragment,
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
    const resultNames = this.compileReachabilityResult(model, generator)

    generator.return(this.buildReachabilityResultExpression(resultNames))

    return generator
  }

  private compileReachabilityResult(model: ReachabilityModel, generator: CodeGenerator): ReachabilityResultNames {
    const stepCount = model.entries.length

    generator.note(this.buildStepOrderNote(model.entries))
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

  /** The result arrays are indexed by step position; this map is the reader's only key. */
  private buildStepOrderNote(entries: readonly ReachabilityEntryModel[]): string {
    return `Step order: ${entries.map((entry, index) => `${index} "${this.stepLabel(entry)}"`).join(', ')}`
  }

  private stepLabel(entry: ReachabilityEntryModel): string {
    return entry.code ?? entry.stepId
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
    entries.forEach((entry, index) => {
      const node = entry.entryWhen

      if (node === undefined) {
        return
      }

      generator.comment(`Entry predicate — step "${this.stepLabel(entry)}"`)
      generator.assign(code`${entryResults}[${index}]`, code`Boolean(${this.expr.compileExpressionCode(node)})`)
    })
  }

  private compileForwardOutcomes(
    entries: readonly ReachabilityEntryModel[],
    outcomeValues: IdentifierName,
    declaredOutcomeValues: IdentifierName,
    generator: CodeGenerator,
  ): void {
    entries.forEach((entry, stepIndex) => {
      if (entry.forwardOutcomeGroups.length === 0) {
        return
      }

      generator.comment(`Forward outcomes — step "${this.stepLabel(entry)}"`)
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
      if (this.hasOnlyStaticGotos(group)) {
        this.compileStaticOutcomeChain(group.redirectOutcomes, stepIndex, outcomeValues, generator)

        return
      }

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
    }

    const hookWhenNode = group.hookWhen

    if (hookWhenNode !== undefined) {
      const hookWhen = generator.const('hookWhen', code`Boolean(${this.expr.compileExpressionCode(hookWhenNode)})`)

      generator.if(hookWhen, emitCascade)

      return
    }

    emitCascade()
  }

  private hasOnlyStaticGotos(group: ForwardOutcomeGroup): boolean {
    return group.redirectOutcomes.every(outcome => typeof outcome.node.properties.goto === 'string')
  }

  /**
   * Emits a cascade of statically-addressed outcomes as an if/else chain: each
   * guarded outcome falls through to the rest only when its condition fails, an
   * over-approximated outcome contributes without stopping the cascade, and an
   * unconditional outcome ends it (anything after it could never run).
   */
  private compileStaticOutcomeChain(
    outcomes: readonly ForwardRedirectOutcome[],
    stepIndex: number,
    outcomeValues: IdentifierName,
    generator: CodeGenerator,
  ): void {
    const [outcome, ...remainingOutcomes] = outcomes

    if (outcome === undefined) {
      return
    }

    const { when, goto } = outcome.node.properties
    const pushGoto = () => generator.statement(code`${outcomeValues}[${stepIndex}].push(${literal(goto)})`)

    if (outcome.overApproximatesWhen) {
      pushGoto()
      this.compileStaticOutcomeChain(remainingOutcomes, stepIndex, outcomeValues, generator)

      return
    }

    if (when !== undefined && this.expr.isCompilableNode(when)) {
      const outcomeWhen = generator.const('outcomeWhen', code`Boolean(${this.expr.compileExpressionCode(when)})`)
      const emitRemaining =
        remainingOutcomes.length > 0
          ? () => this.compileStaticOutcomeChain(remainingOutcomes, stepIndex, outcomeValues, generator)
          : undefined

      generator.if(outcomeWhen, pushGoto, emitRemaining)

      return
    }

    pushGoto()
  }

  private compileForwardOutcomeCascade(
    properties: { readonly when?: ASTNode; readonly goto: ASTNode | string },
    stepIndex: number,
    outcomeMatched: IdentifierName,
    overApproximateWhen: boolean,
    outcomeValues: IdentifierName,
    generator: CodeGenerator,
  ): void {
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
    entries.forEach((entry, index) => {
      if (entry.reachabilityTieBreakers.length === 0) {
        return
      }

      generator.comment(`Tie-breaker priority — step "${this.stepLabel(entry)}"`)
      this.compileTieBreakerChain(entry.reachabilityTieBreakers, index, tieBreakerPriorities, generator)
    })
  }

  /**
   * Emits tie-breaker rules as an if/else chain taking the first matching rule's
   * priority. An unconditional rule ends the chain (later rules could never run);
   * when no rule matches, the step's slot stays unset.
   */
  private compileTieBreakerChain(
    tieBreakers: readonly ReachabilityTieBreakerEntry[],
    stepIndex: number,
    tieBreakerPriorities: IdentifierName,
    generator: CodeGenerator,
  ): void {
    const [tieBreaker, ...remainingTieBreakers] = tieBreakers

    if (tieBreaker === undefined) {
      return
    }

    const assignPriority = () =>
      generator.assign(code`${tieBreakerPriorities}[${stepIndex}]`, literal(tieBreaker.priority))

    if (tieBreaker.when === undefined) {
      assignPriority()

      return
    }

    const tieBreakerWhen = generator.const(
      'tieBreakerWhen',
      code`Boolean(${this.expr.compileExpressionCode(tieBreaker.when)})`,
    )
    const emitRemaining =
      remainingTieBreakers.length > 0
        ? () => this.compileTieBreakerChain(remainingTieBreakers, stepIndex, tieBreakerPriorities, generator)
        : undefined

    generator.if(tieBreakerWhen, assignPriority, emitRemaining)
  }

  private compileResumeCondition(model: ReachabilityModel, generator: CodeGenerator): IdentifierName {
    if (model.resumeAlways) {
      return generator.const('resumeActive', literal(true))
    }

    if (model.resumeWhen === undefined) {
      return generator.const('resumeActive', literal(false))
    }

    return generator.const('resumeActive', code`Boolean(${this.expr.compileExpressionCode(model.resumeWhen)})`)
  }
}
