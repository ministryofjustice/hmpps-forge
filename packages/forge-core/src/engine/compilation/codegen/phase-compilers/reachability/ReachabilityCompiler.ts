/**
 * Compiles one reachability evaluator per journey.
 *
 * The generated function pre-computes every dynamic value the graph builder
 * needs: entry predicates, redirect outcome targets, tie-breaker priorities, and
 * resume state. The graph algorithm stays in TypeScript and consumes these arrays
 * by step index.
 *
 * Redirect URL resolution and validation-aware graph walking remain outside the
 * generated function. This keeps generated code limited to expression evaluation
 * while navigation policy stays in ordinary TypeScript.
 *
 * Generated-function construction failures throw ForgeCompilationError. There is
 * no secondary reachability execution path.
 */
import { ASTNode } from '../../../../types/ast.type'
import { ReachabilityRuntimePlan, ReachabilityStepEntry } from '../../../RuntimePlanBuilder'
import NodeRegistry from '../../../registries/NodeRegistry'
import NodeCompilationDispatcher from '../../expressions/NodeCompilationDispatcher'
import CodeEmitter from '../../emitters/CodeEmitter'
import FunctionRegistry from '../../../../registries/FunctionRegistry'
import { buildGeneratedSource, compileGeneratedFunction } from '../../generated-functions/GeneratedFunctionCompiler'
import { isRedirectOutcomeNode } from '../../../../typeguards/outcome-nodes'

/**
 * Context passed to the compiled reachability function. Reachability expressions
 * run at journey scope, so no iterator scope stack is needed here.
 */
export interface ReachabilityContext {
  answers: Record<string, { current: unknown }>
  data: Record<string, unknown>
  session: Record<string, unknown>
  params: Record<string, unknown>
  query: Record<string, unknown>
  request: Record<string, unknown>
  conditions: FunctionRegistry
}

/**
 * The result of calling the compiled reachability function. Arrays are indexed
 * by step position in the ReachabilityRuntimePlan.entries array, maintaining a
 * 1:1 correspondence with the plan's step ordering.
 */
export interface CompiledReachabilityResult {
  /** Per-step: result of evaluating the entryWhen predicate (undefined = no predicate) */
  entryResults: (boolean | undefined)[]
  /** Per-step: raw path strings from forward outcome goto expressions */
  outcomeValues: (string | undefined)[][]
  /** Per-step: resolved tie-breaker priority from the first matching rule */
  tieBreakerPriorities: (number | undefined)[]
  /** Whether the journey's resume condition evaluated to true */
  resumeActive: boolean
}

type SyncCompiledReachabilityFunction = (ctx: ReachabilityContext) => CompiledReachabilityResult

export type CompiledReachabilityFunction = (
  ctx: ReachabilityContext,
) => CompiledReachabilityResult | Promise<CompiledReachabilityResult>

/**
 * Turns a reachability runtime plan into a generated evaluator function.
 *
 * The compiler only emits value evaluation. Graph policy remains in the
 * TypeScript reachability runtime so navigation behaviour is easier to audit.
 */
export default class ReachabilityCompiler {
  private readonly expr = new NodeCompilationDispatcher()

  /**
   * Compiles the plan into an executable reachability evaluator.
   */
  compile(plan: ReachabilityRuntimePlan, nodeRegistry: NodeRegistry): SyncCompiledReachabilityFunction | undefined

  compile(
    plan: ReachabilityRuntimePlan,
    nodeRegistry: NodeRegistry,
    functionRegistry: FunctionRegistry,
  ): CompiledReachabilityFunction | undefined

  compile(
    plan: ReachabilityRuntimePlan,
    nodeRegistry: NodeRegistry,
    functionRegistry?: FunctionRegistry,
  ): CompiledReachabilityFunction | SyncCompiledReachabilityFunction | undefined {
    return compileGeneratedFunction<CompiledReachabilityFunction>(
      this.expr,
      ['ctx'],
      functionRegistry,
      () => this.buildSource(plan, nodeRegistry),
      { phase: 'reachability' },
    )
  }

  /**
   * Builds the generated source without constructing a function, mainly for debugging.
   */
  generateSource(
    plan: ReachabilityRuntimePlan,
    nodeRegistry: NodeRegistry,
    functionRegistry?: FunctionRegistry,
  ): string {
    return buildGeneratedSource(this.expr, functionRegistry, () => this.buildSource(plan, nodeRegistry))
  }

  /**
   * Emits the full reachability function body in the order consumed by the runtime plan.
   */
  private buildSource(plan: ReachabilityRuntimePlan, nodeRegistry: NodeRegistry): string {
    const emitter = new CodeEmitter()
    const stepCount = plan.entries.length

    emitter.code('"use strict";')

    emitter.comment('ReachabilityCompiler.buildSource')
    emitter.declareConst('entryResults', `new Array(${stepCount})`)
    emitter.declareConst('outcomeValues', `[${plan.entries.map(() => '[]').join(', ')}]`)
    emitter.declareConst('tieBreakerPriorities', `new Array(${stepCount})`)

    this.compileEntryPredicates(plan.entries, nodeRegistry, emitter)
    this.compileForwardOutcomes(plan.entries, nodeRegistry, emitter)
    this.compileTieBreakers(plan.entries, nodeRegistry, emitter)
    this.compileResumeCondition(plan, nodeRegistry, emitter)

    emitter.return(
      '{ entryResults: entryResults, outcomeValues: outcomeValues, tieBreakerPriorities: tieBreakerPriorities, resumeActive: resumeActive }',
    )

    return emitter.toString()
  }

  /**
   * Emits the optional per-step entryWhen predicates used to seed extra entry points.
   */
  private compileEntryPredicates(
    entries: ReachabilityStepEntry[],
    nodeRegistry: NodeRegistry,
    emitter: CodeEmitter,
  ): void {
    emitter.comment('ReachabilityCompiler.compileEntryPredicates')

    entries.forEach((entry, index) => {
      if (entry.entryWhenNodeId === undefined) {
        return
      }

      const node = nodeRegistry.get(entry.entryWhenNodeId)

      if (!node) {
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
   * Forward outcomes are RedirectOutcomeASTNodes extracted from submit hooks
   * during plan building. Each has an optional `when` guard (predicate) and a
   * `goto` target (string literal or AST expression). If `when` is truthy (or
   * absent), the generated code evaluates `goto` and pushes the string result
   * to the step's outcome array.
   *
   * The outcome IDs in the plan point to AST nodes in the shared registry —
   * they're looked up here at compile time, not at runtime. Only REDIRECT
   * outcomes are compiled; THROW_ERROR outcomes are skipped (they don't
   * contribute to the reachability graph).
   */
  private compileForwardOutcomes(
    entries: ReachabilityStepEntry[],
    nodeRegistry: NodeRegistry,
    emitter: CodeEmitter,
  ): void {
    emitter.comment('ReachabilityCompiler.compileForwardOutcomes')

    entries.forEach((entry, stepIndex) => {
      if (entry.forwardOutcomeIds.length === 0) {
        return
      }

      entry.forwardOutcomeIds.forEach(outcomeId => {
        const outcomeNode = nodeRegistry.get(outcomeId)

        if (!isRedirectOutcomeNode(outcomeNode)) {
          return
        }

        this.compileForwardOutcome(outcomeNode.properties, stepIndex, emitter)
      })
    })
  }

  /**
   * Emits one redirect outcome, including its optional when guard.
   */
  private compileForwardOutcome(
    properties: { readonly when?: ASTNode; readonly goto: ASTNode | string },
    stepIndex: number,
    emitter: CodeEmitter,
  ): void {
    emitter.scope(() => {
      const { when, goto } = properties

      if (when !== undefined && this.expr.isCompilableNode(when)) {
        const whenExpr = this.expr.compileExpression(when)
        const whenVar = emitter.const('outcomeWhen', `Boolean(${whenExpr})`)

        emitter.if(whenVar, () => {
          this.compileGotoResolution(goto, stepIndex, emitter)
        })

        return
      }

      this.compileGotoResolution(goto, stepIndex, emitter)
    })
  }

  /**
   * Emits the goto target evaluation and pushes the result to outcomeValues.
   * String literals are emitted as JSON constants. AST expressions are compiled
   * through the shared dispatcher. Expression failures throw contextual Forge
   * runtime errors rather than silently removing a graph edge.
   */
  private compileGotoResolution(goto: ASTNode | string, stepIndex: number, emitter: CodeEmitter): void {
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
  private compileTieBreakers(entries: ReachabilityStepEntry[], nodeRegistry: NodeRegistry, emitter: CodeEmitter): void {
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
  private compileResumeCondition(
    plan: ReachabilityRuntimePlan,
    nodeRegistry: NodeRegistry,
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
      emitter.declareConst('resumeActive', 'false')

      return
    }

    const conditionExpr = this.expr.compileExpression(node)

    emitter.declareConst('resumeActive', `Boolean(${conditionExpr})`)
  }
}
