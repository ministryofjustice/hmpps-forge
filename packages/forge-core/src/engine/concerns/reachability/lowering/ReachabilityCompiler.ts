/**
 * Emits the compiled reachability facts function for a reachability compilation
 * plan.
 *
 * Dynamic result arrays are indexed by step position in `plan.entries`.
 */
import { ASTNode } from '../../../contracts/ast/ast.type'
import type {
  ForwardOutcomeGroup,
  ReachabilityCompilationEntry,
  ReachabilityCompilationPlan,
} from '../../../contracts/plans/runtimePlans.type'
import ExpressionDispatcher from '../../../compilation/lowering/expressions/ExpressionDispatcher'
import CodeEmitter from '../../../compilation/codegen/CodeEmitter'
import type { CompiledReachabilityFactsFunction } from '../../../contracts/compiled/compiledFunctions.type'
import {
  buildGeneratedSource,
  compileGeneratedFunction,
  deriveScriptLabel,
} from '../../../compilation/lowering/function-construction/GeneratedFunctionCompiler'
import type { CompilationDependencies } from '../../../compilation/lowering/compilationDependencies.type'

/**
 * Builds the generated reachability facts function from a reachability compilation plan.
 */
export default class ReachabilityCompiler {
  private readonly expr: ExpressionDispatcher

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
  }

  /**
   * Compiles the plan into a reachability facts evaluator.
   *
   * The generated function evaluates dynamic reachability expressions and returns
   * the facts as a plain result object; the static graph walk over those facts
   * runs in the compiled reachability state function.
   */
  compileFacts(plan: ReachabilityCompilationPlan): CompiledReachabilityFactsFunction {
    return compileGeneratedFunction<CompiledReachabilityFactsFunction>(
      this.expr,
      ['ctx'],
      () => this.buildFactsSource(plan),
      { phase: 'reachability', label: this.deriveJourneyLabel(plan) },
    )
  }

  /**
   * Builds inspectable generated facts source.
   *
   * Function metadata determines whether emitted calls need `await`.
   */
  generateFactsSource(plan: ReachabilityCompilationPlan): string {
    return buildGeneratedSource(this.expr, () => this.buildFactsSource(plan)).toString()
  }

  /**
   * Reachability facts cover the whole journey, so the label is the journey
   * segment alone; the first dynamic node's path supplies it.
   */
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

  /**
   * Emits the generated facts function body with the reachability arrays.
   */
  private buildFactsSource(plan: ReachabilityCompilationPlan): CodeEmitter {
    const emitter = new CodeEmitter()
    const stepCount = plan.entries.length

    emitter.code('"use strict";')

    emitter.comment('ReachabilityCompiler.buildFactsSource')
    this.compileReachabilityResult(plan, emitter, stepCount)

    emitter.return(this.buildReachabilityResultExpression())

    return emitter
  }

  /**
   * Emits reachability arrays aligned to `plan.entries`.
   */
  private compileReachabilityResult(plan: ReachabilityCompilationPlan, emitter: CodeEmitter, stepCount: number): void {
    emitter.declareConst('entryResults', `new Array(${stepCount})`)
    emitter.declareConst('outcomeValues', `[${plan.entries.map(() => '[]').join(', ')}]`)
    emitter.declareConst('declaredOutcomeValues', `[${plan.entries.map(() => '[]').join(', ')}]`)
    emitter.declareConst('tieBreakerPriorities', `new Array(${stepCount})`)

    this.compileEntryPredicates(plan.entries, emitter)
    this.compileForwardOutcomes(plan.entries, emitter)
    this.compileTieBreakers(plan.entries, emitter)
    this.compileResumeCondition(plan, emitter)
  }

  /**
   * Builds the reachability result object literal.
   */
  private buildReachabilityResultExpression(): string {
    return '{ entryResults: entryResults, outcomeValues: outcomeValues, declaredOutcomeValues: declaredOutcomeValues, tieBreakerPriorities: tieBreakerPriorities, resumeActive: resumeActive }'
  }

  /**
   * Emits the optional per-step entryWhen predicates used to seed extra entry points.
   */
  private compileEntryPredicates(entries: ReachabilityCompilationEntry[], emitter: CodeEmitter): void {
    emitter.comment('ReachabilityCompiler.compileEntryPredicates')

    entries.forEach((entry, index) => {
      const node = entry.entryWhen

      if (node === undefined) {
        return
      }

      emitter.scope(() => {
        const predicateExpr = this.expr.compileExpression(node)
        const predicateVar = emitter.const('entryPredicate', `Boolean(${predicateExpr})`)

        emitter.assign(`entryResults[${index}]`, predicateVar)
      })
    })
  }

  /**
   * Compiles forward outcome evaluation for each step.
   *
   * Forward outcomes are RedirectOutcomeASTNodes grouped by their owning submit
   * hook. Each group cascades independently — a fresh `outcomeMatched` flag per
   * group, optionally guarded by `if (hookWhen)` when the hook's `when:` is
   * reachability-compilable. Hooks with non-compilable `when:` (e.g. `Post(...)`
   * references) contribute unguarded as an intentional over-approximation.
   *
   * `declaredOutcomeValues` is hoisted out of the cascade so every authored
   * static goto is recorded for the devtools graph regardless of guard state.
   *
   * Only REDIRECT outcomes contribute path candidates.
   */
  private compileForwardOutcomes(entries: ReachabilityCompilationEntry[], emitter: CodeEmitter): void {
    emitter.comment('ReachabilityCompiler.compileForwardOutcomes')

    entries.forEach((entry, stepIndex) => {
      entry.forwardOutcomeGroups.forEach(group => {
        this.compileForwardOutcomeGroup(group, stepIndex, emitter)
      })
    })
  }

  private compileForwardOutcomeGroup(group: ForwardOutcomeGroup, stepIndex: number, emitter: CodeEmitter): void {
    const { redirectOutcomes } = group

    redirectOutcomes.forEach(outcome => {
      this.compileDeclaredGotoResolution(outcome.node.properties.goto, stepIndex, emitter)
    })

    const emitCascade = () => {
      emitter.scope(() => {
        const outcomeMatchedVar = emitter.let('outcomeMatched', 'false')

        redirectOutcomes.forEach(outcome => {
          this.compileForwardOutcomeCascade(
            outcome.node.properties,
            stepIndex,
            outcomeMatchedVar,
            outcome.overApproximatesWhen,
            emitter,
          )
        })
      })
    }

    const hookWhenNode = group.hookWhen

    if (hookWhenNode !== undefined) {
      emitter.scope(() => {
        const whenExpr = this.expr.compileExpression(hookWhenNode)
        const whenVar = emitter.const('hookWhen', `Boolean(${whenExpr})`)

        emitter.if(whenVar, emitCascade)
      })

      return
    }

    emitCascade()
  }

  /**
   * Emits the cascade step for one redirect outcome within a hook group.
   *
   * The declared-paths push is hoisted to the group level, so this only runs
   * the cascade guard (`outcomeMatched === false`) and the optional outcome-level
   * `when:` evaluation.
   */
  private compileForwardOutcomeCascade(
    properties: { readonly when?: ASTNode; readonly goto: ASTNode | string },
    stepIndex: number,
    outcomeMatchedVar: string,
    overApproximateWhen: boolean,
    emitter: CodeEmitter,
  ): void {
    emitter.scope(() => {
      const { when, goto } = properties

      emitter.if(`${outcomeMatchedVar} === false`, () => {
        if (!overApproximateWhen && when !== undefined && this.expr.isCompilableNode(when)) {
          const whenExpr = this.expr.compileExpression(when)
          const whenVar = emitter.const('outcomeWhen', `Boolean(${whenExpr})`)

          emitter.if(whenVar, () => {
            this.compileGotoResolution(goto, stepIndex, outcomeMatchedVar, true, emitter)
          })

          return
        }

        this.compileGotoResolution(goto, stepIndex, outcomeMatchedVar, !overApproximateWhen, emitter)
      })
    })
  }

  private compileDeclaredGotoResolution(goto: ASTNode | string, stepIndex: number, emitter: CodeEmitter): void {
    if (typeof goto !== 'string') {
      return
    }

    emitter.code(`declaredOutcomeValues[${stepIndex}].push(${JSON.stringify(goto)});`)
  }

  /**
   * Emits the goto target evaluation and pushes the result to outcomeValues.
   * String literals are emitted as JSON constants. AST expressions are compiled
   * through the shared dispatcher. Expression failures surface as Forge runtime
   * errors with diagnostic context.
   */
  private compileGotoResolution(
    goto: ASTNode | string,
    stepIndex: number,
    outcomeMatchedVar: string,
    marksOutcomeMatched: boolean,
    emitter: CodeEmitter,
  ): void {
    let gotoExpr: string

    if (typeof goto === 'string') {
      gotoExpr = JSON.stringify(goto)
    } else if (this.expr.isCompilableNode(goto)) {
      gotoExpr = this.expr.compileExpression(goto)
    } else {
      return
    }

    const gotoVar = emitter.const('gotoValue', gotoExpr)

    emitter.if(`${gotoVar} !== undefined`, () => {
      emitter.code(`outcomeValues[${stepIndex}].push(String(${gotoVar}));`)

      if (marksOutcomeMatched) {
        emitter.assign(outcomeMatchedVar, 'true')
      }
    })
  }

  /**
   * Compiles tie-breaker priority resolution for each step.
   *
   * Tie-breakers are a priority cascade: the first rule whose `when` predicate
   * matches (or has no predicate, making it a catch-all) determines the step's
   * priority. The generated code guards each rule with `priority === undefined`
   * so later predicates are not evaluated after a winner has been chosen.
   */
  private compileTieBreakers(entries: ReachabilityCompilationEntry[], emitter: CodeEmitter): void {
    emitter.comment('ReachabilityCompiler.compileTieBreakers')

    entries.forEach((entry, index) => {
      if (entry.reachabilityTieBreakers.length === 0) {
        return
      }

      emitter.scope(() => {
        const priorityVar = emitter.let('tieBreakerPriority')

        entry.reachabilityTieBreakers.forEach(tieBreaker => {
          const node = tieBreaker.when

          if (node === undefined) {
            emitter.if(`${priorityVar} === undefined`, () => {
              emitter.assign(priorityVar, JSON.stringify(tieBreaker.priority))
            })

            return
          }

          emitter.if(`${priorityVar} === undefined`, () => {
            const whenExpr = this.expr.compileExpression(node)
            const whenVar = emitter.const('tieBreakerWhen', `Boolean(${whenExpr})`)

            emitter.if(whenVar, () => {
              emitter.assign(priorityVar, JSON.stringify(tieBreaker.priority))
            })
          })
        })
        emitter.assign(`tieBreakerPriorities[${index}]`, priorityVar)
      })
    })
  }

  /**
   * Emits the journey resume condition, defaulting to inactive when no predicate is configured.
   */
  private compileResumeCondition(plan: ReachabilityCompilationPlan, emitter: CodeEmitter): void {
    emitter.comment('ReachabilityCompiler.compileResumeCondition')

    if (plan.resumeAlways) {
      emitter.declareConst('resumeActive', 'true')

      return
    }

    const node = plan.resumeWhen

    if (node === undefined) {
      emitter.declareConst('resumeActive', 'false')

      return
    }

    const conditionExpr = this.expr.compileExpression(node)

    emitter.declareConst('resumeActive', `Boolean(${conditionExpr})`)
  }
}
