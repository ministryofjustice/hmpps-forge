/**
 * Emits the compiled reachability facts function for a reachability compilation
 * plan.
 *
 * Dynamic result arrays are indexed by step position in `plan.entries`. The facts
 * function also emits per-step field inventory when request params are present.
 */
import { ASTNode } from '../../../../contracts/ast/ast.type'
import type {
  ForwardOutcomeGroup,
  ReachabilityCompilationEntry,
  ReachabilityCompilationPlan,
} from '../../../../contracts/plans/runtimePlans.type'
import ASTNodeIndex from '../../../ast/ast-state/ASTNodeIndex'
import ExpressionDispatcher from '../../expressions/ExpressionDispatcher'
import CodeEmitter from '../../emitters/CodeEmitter'
import type { CompiledReachabilityFactsFunction } from '../../../../contracts/compiled/compiledFunctions.type'
import { buildGeneratedSource, compileGeneratedFunction } from '../../function-construction/GeneratedFunctionCompiler'
import { isRedirectOutcomeNode } from '../../../../contracts/ast/outcome-nodes'
import type { FieldInventoryStepSource } from '../../../../contracts/plans/compilationPlan.type'
import StepFieldInventoryCompiler from './StepFieldInventoryCompiler'
import type { CompilationDependencies } from '../../compilationDependencies.type'

/**
 * Builds the generated reachability facts function from a reachability compilation plan.
 */
export default class ReachabilityCompiler {
  private readonly expr: ExpressionDispatcher

  private readonly fieldInventory: StepFieldInventoryCompiler

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
    this.fieldInventory = new StepFieldInventoryCompiler(dependencies, this.expr)
  }

  /**
   * Compiles the plan into a reachability facts evaluator.
   *
   * The generated function evaluates dynamic reachability expressions and, when
   * params are available, the per-step field inventory. It returns the facts as a
   * plain result object; the static graph walk over those facts runs in the
   * compiled reachability state function.
   */
  compileFacts(
    plan: ReachabilityCompilationPlan,
    fieldInventorySources: FieldInventoryStepSource[],
    nodeRegistry: ASTNodeIndex,
  ): CompiledReachabilityFactsFunction {
    return compileGeneratedFunction<CompiledReachabilityFactsFunction>(
      this.expr,
      ['ctx', 'factsInput'],
      () => this.buildFactsSource(plan, fieldInventorySources, nodeRegistry),
      { phase: 'reachability' },
    )
  }

  /**
   * Builds inspectable generated facts source.
   *
   * Function metadata determines whether emitted calls need `await`.
   */
  generateFactsSource(
    plan: ReachabilityCompilationPlan,
    fieldInventorySources: FieldInventoryStepSource[],
    nodeRegistry: ASTNodeIndex,
  ): string {
    return buildGeneratedSource(this.expr, () => this.buildFactsSource(plan, fieldInventorySources, nodeRegistry))
  }

  /**
   * Emits the generated facts function body with reachability arrays and optional
   * field inventory.
   */
  private buildFactsSource(
    plan: ReachabilityCompilationPlan,
    fieldInventorySources: FieldInventoryStepSource[],
    nodeRegistry: ASTNodeIndex,
  ): string {
    const emitter = new CodeEmitter()
    const stepCount = plan.entries.length

    emitter.code('"use strict";')

    emitter.comment('ReachabilityCompiler.buildFactsSource')
    this.compileReachabilityResult(plan, nodeRegistry, emitter, stepCount)
    this.compileFieldInventory(fieldInventorySources, emitter)

    emitter.return(this.buildReachabilityResultExpression())

    return emitter.toString()
  }

  /**
   * Emits reachability arrays aligned to `plan.entries`.
   */
  private compileReachabilityResult(
    plan: ReachabilityCompilationPlan,
    nodeRegistry: ASTNodeIndex,
    emitter: CodeEmitter,
    stepCount: number,
  ): void {
    emitter.declareConst('entryResults', `new Array(${stepCount})`)
    emitter.declareConst('outcomeValues', `[${plan.entries.map(() => '[]').join(', ')}]`)
    emitter.declareConst('declaredOutcomeValues', `[${plan.entries.map(() => '[]').join(', ')}]`)
    emitter.declareConst('tieBreakerPriorities', `new Array(${stepCount})`)

    this.compileEntryPredicates(plan.entries, nodeRegistry, emitter)
    this.compileForwardOutcomes(plan.entries, nodeRegistry, emitter)
    this.compileTieBreakers(plan.entries, nodeRegistry, emitter)
    this.compileResumeCondition(plan, nodeRegistry, emitter)
  }

  /**
   * Emits field inventory only when a request supplies params (step requests). The
   * `factsInput` argument is absent for facts-only calls, so the guard tolerates it.
   */
  private compileFieldInventory(fieldInventorySources: FieldInventoryStepSource[], emitter: CodeEmitter): void {
    emitter.comment('ReachabilityCompiler.compileFieldInventory')
    emitter.declareLet('fieldInventory')
    emitter.if('factsInput !== undefined && factsInput.params !== undefined', () => {
      emitter.assign('fieldInventory', '[]')
      this.fieldInventory.compileInto(fieldInventorySources, emitter, 'fieldInventory')
    })
  }

  /**
   * Builds the reachability result object literal.
   */
  private buildReachabilityResultExpression(): string {
    return '{ entryResults: entryResults, outcomeValues: outcomeValues, declaredOutcomeValues: declaredOutcomeValues, tieBreakerPriorities: tieBreakerPriorities, resumeActive: resumeActive, fieldInventory: fieldInventory }'
  }

  /**
   * Emits the optional per-step entryWhen predicates used to seed extra entry points.
   */
  private compileEntryPredicates(
    entries: ReachabilityCompilationEntry[],
    nodeRegistry: ASTNodeIndex,
    emitter: CodeEmitter,
  ): void {
    emitter.comment('ReachabilityCompiler.compileEntryPredicates')

    entries.forEach((entry, index) => {
      if (entry.entryWhenNodeId === undefined) {
        return
      }

      const node = nodeRegistry.get(entry.entryWhenNodeId)

      if (!node) {
        throw new Error(`Entry predicate node "${entry.entryWhenNodeId}" missing from registry`)
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
  private compileForwardOutcomes(
    entries: ReachabilityCompilationEntry[],
    nodeRegistry: ASTNodeIndex,
    emitter: CodeEmitter,
  ): void {
    emitter.comment('ReachabilityCompiler.compileForwardOutcomes')

    entries.forEach((entry, stepIndex) => {
      entry.forwardOutcomeGroups.forEach(group => {
        this.compileForwardOutcomeGroup(group, stepIndex, nodeRegistry, emitter)
      })
    })
  }

  private compileForwardOutcomeGroup(
    group: ForwardOutcomeGroup,
    stepIndex: number,
    nodeRegistry: ASTNodeIndex,
    emitter: CodeEmitter,
  ): void {
    const redirectOutcomes = group.outcomeIds
      .map(outcomeId => nodeRegistry.get(outcomeId))
      .filter(isRedirectOutcomeNode)

    if (redirectOutcomes.length === 0) {
      return
    }

    const overApproximateOutcomeIds = new Set(group.overApproximateOutcomeIds ?? [])

    redirectOutcomes.forEach(outcome => {
      this.compileDeclaredGotoResolution(outcome.properties.goto, stepIndex, emitter)
    })

    const emitCascade = () => {
      emitter.scope(() => {
        const outcomeMatchedVar = emitter.let('outcomeMatched', 'false')

        redirectOutcomes.forEach(outcome => {
          this.compileForwardOutcomeCascade(
            outcome.properties,
            stepIndex,
            outcomeMatchedVar,
            overApproximateOutcomeIds.has(outcome.id),
            emitter,
          )
        })
      })
    }

    const hookWhenNode = group.hookWhenNodeId !== undefined ? nodeRegistry.get(group.hookWhenNodeId) : undefined

    if (hookWhenNode !== undefined && this.expr.isCompilableNode(hookWhenNode)) {
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
  private compileTieBreakers(
    entries: ReachabilityCompilationEntry[],
    nodeRegistry: ASTNodeIndex,
    emitter: CodeEmitter,
  ): void {
    emitter.comment('ReachabilityCompiler.compileTieBreakers')

    entries.forEach((entry, index) => {
      if (entry.reachabilityTieBreakers.length === 0) {
        return
      }

      emitter.scope(() => {
        const priorityVar = emitter.let('tieBreakerPriority')

        entry.reachabilityTieBreakers.forEach(tieBreaker => {
          if (tieBreaker.whenNodeId === undefined) {
            emitter.if(`${priorityVar} === undefined`, () => {
              emitter.assign(priorityVar, JSON.stringify(tieBreaker.priority))
            })

            return
          }

          const node = nodeRegistry.get(tieBreaker.whenNodeId)

          if (!node) {
            throw new Error(`Tie-breaker predicate node "${tieBreaker.whenNodeId}" missing from registry`)
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
  private compileResumeCondition(
    plan: ReachabilityCompilationPlan,
    nodeRegistry: ASTNodeIndex,
    emitter: CodeEmitter,
  ): void {
    emitter.comment('ReachabilityCompiler.compileResumeCondition')

    if (plan.resumeAlways) {
      emitter.declareConst('resumeActive', 'true')

      return
    }

    if (plan.resumeWhenNodeId === undefined) {
      emitter.declareConst('resumeActive', 'false')

      return
    }

    const node = nodeRegistry.get(plan.resumeWhenNodeId)

    if (!node) {
      throw new Error(`Resume predicate node "${plan.resumeWhenNodeId}" missing from registry`)
    }

    const conditionExpr = this.expr.compileExpression(node)

    emitter.declareConst('resumeActive', `Boolean(${conditionExpr})`)
  }
}
