/**
 * Emits navigation evaluators for a reachability compilation plan.
 *
 * Dynamic result arrays are indexed by step position in `plan.entries`.
 * Navigation evaluators also emit field inventory when request params are
 * present.
 */
import { ASTNode } from '../../../../types/ast.type'
import type { ReachabilityCompilationEntry, ReachabilityCompilationPlan } from '../../../../types/runtimePlans.type'
import NodeRegistry from '../../../registries/NodeRegistry'
import NodeCompilationDispatcher from '../../expressions/NodeCompilationDispatcher'
import CodeEmitter from '../../emitters/CodeEmitter'
import FunctionRegistry from '../../../../registries/FunctionRegistry'
import {
  buildGeneratedSource,
  compileGeneratedFunction,
  GENERATED_FUNCTION_HELPERS_PARAM,
} from '../../generated-functions/GeneratedFunctionCompiler'
import { isRedirectOutcomeNode } from '../../../../typeguards/outcome-nodes'
import type {
  NavigationEvaluationInput,
  NavigationEvaluationResult,
} from '../../../../types/GeneratedNavigationEvaluation.type'
import StepFieldInventoryCompiler, { FieldInventoryStepSource } from '../field-inventory/StepFieldInventoryCompiler'
import type { CompilationDependencies } from '../../compilationDependencies.type'

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
 * by step position in the ReachabilityCompilationPlan.entries array, maintaining a
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

export type CompiledReachabilityFunction = (
  ctx: ReachabilityContext,
) => CompiledReachabilityResult | Promise<CompiledReachabilityResult>

export type CompiledNavigationFunction = (
  ctx: ReachabilityContext,
  navigation: NavigationEvaluationInput,
) => Promise<NavigationEvaluationResult>

/**
 * Builds generated functions from a reachability compilation plan.
 */
export default class ReachabilityCompiler {
  private readonly expr: NodeCompilationDispatcher

  private readonly fieldInventory: StepFieldInventoryCompiler

  constructor(dependencies: CompilationDependencies) {
    this.expr = new NodeCompilationDispatcher(dependencies)
    this.fieldInventory = new StepFieldInventoryCompiler(dependencies, this.expr)
  }

  /**
   * Compiles the plan into an executable reachability evaluator.
   */
  compile(plan: ReachabilityCompilationPlan, nodeRegistry: NodeRegistry): CompiledReachabilityFunction | undefined {
    return compileGeneratedFunction<CompiledReachabilityFunction>(
      this.expr,
      ['ctx'],
      () => this.buildSource(plan, nodeRegistry),
      { phase: 'reachability' },
    )
  }

  /**
   * Compiles the plan into a navigation evaluator.
   *
   * The generated function evaluates dynamic reachability expressions and, when
   * params are available, emits field inventory.
   */
  compileNavigation(
    plan: ReachabilityCompilationPlan,
    fieldInventorySources: FieldInventoryStepSource[],
    nodeRegistry: NodeRegistry,
  ): CompiledNavigationFunction {
    return compileGeneratedFunction<CompiledNavigationFunction>(
      this.expr,
      ['ctx', 'navigation'],
      () => this.buildNavigationSource(plan, fieldInventorySources, nodeRegistry),
      { forceAsync: true, phase: 'navigation' },
    )
  }

  /**
   * Builds the generated source without constructing a function, mainly for debugging.
   */
  generateSource(plan: ReachabilityCompilationPlan, nodeRegistry: NodeRegistry): string {
    return buildGeneratedSource(this.expr, () => this.buildSource(plan, nodeRegistry))
  }

  /**
   * Builds inspectable generated navigation source.
   *
   * Function metadata determines whether emitted calls need `await`.
   */
  generateNavigationSource(
    plan: ReachabilityCompilationPlan,
    fieldInventorySources: FieldInventoryStepSource[],
    nodeRegistry: NodeRegistry,
  ): string {
    return buildGeneratedSource(this.expr, () => this.buildNavigationSource(plan, fieldInventorySources, nodeRegistry))
  }

  /**
   * Emits the full reachability function body in compilation-plan step order.
   */
  private buildSource(plan: ReachabilityCompilationPlan, nodeRegistry: NodeRegistry): string {
    const emitter = new CodeEmitter()
    const stepCount = plan.entries.length

    emitter.code('"use strict";')

    emitter.comment('ReachabilityCompiler.buildSource')
    this.compileReachabilityResult(plan, nodeRegistry, emitter, stepCount)

    emitter.return(this.buildReachabilityResultExpression())

    return emitter.toString()
  }

  /**
   * Emits the generated navigation function body with reachability arrays and
   * optional field inventory.
   */
  private buildNavigationSource(
    plan: ReachabilityCompilationPlan,
    fieldInventorySources: FieldInventoryStepSource[],
    nodeRegistry: NodeRegistry,
  ): string {
    const emitter = new CodeEmitter()
    const stepCount = plan.entries.length

    emitter.code('"use strict";')

    emitter.comment('ReachabilityCompiler.buildNavigationSource')
    this.compileReachabilityResult(plan, nodeRegistry, emitter, stepCount)
    this.compileFieldInventory(fieldInventorySources, emitter)

    emitter.return(
      `${GENERATED_FUNCTION_HELPERS_PARAM}.evaluateNavigation(ctx, fieldInventory === undefined ? navigation : { ...navigation, fieldInventory: fieldInventory }, ${this.buildReachabilityResultExpression()})`,
    )

    return emitter.toString()
  }

  /**
   * Emits reachability arrays aligned to `plan.entries`.
   */
  private compileReachabilityResult(
    plan: ReachabilityCompilationPlan,
    nodeRegistry: NodeRegistry,
    emitter: CodeEmitter,
    stepCount: number,
  ): void {
    emitter.declareConst('entryResults', `new Array(${stepCount})`)
    emitter.declareConst('outcomeValues', `[${plan.entries.map(() => '[]').join(', ')}]`)
    emitter.declareConst('tieBreakerPriorities', `new Array(${stepCount})`)

    this.compileEntryPredicates(plan.entries, nodeRegistry, emitter)
    this.compileForwardOutcomes(plan.entries, nodeRegistry, emitter)
    this.compileTieBreakers(plan.entries, nodeRegistry, emitter)
    this.compileResumeCondition(plan, nodeRegistry, emitter)
  }

  /**
   * Emits field inventory only for navigation calls that can project params.
   */
  private compileFieldInventory(fieldInventorySources: FieldInventoryStepSource[], emitter: CodeEmitter): void {
    emitter.comment('ReachabilityCompiler.compileFieldInventory')
    emitter.declareLet('fieldInventory')
    emitter.if('navigation.params !== undefined', () => {
      emitter.assign('fieldInventory', '[]')
      this.fieldInventory.compileInto(fieldInventorySources, emitter, 'fieldInventory')
    })
  }

  /**
   * Builds the reachability result object literal.
   */
  private buildReachabilityResultExpression(): string {
    return '{ entryResults: entryResults, outcomeValues: outcomeValues, tieBreakerPriorities: tieBreakerPriorities, resumeActive: resumeActive }'
  }

  /**
   * Emits the optional per-step entryWhen predicates used to seed extra entry points.
   */
  private compileEntryPredicates(
    entries: ReachabilityCompilationEntry[],
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
   * Only REDIRECT outcomes contribute path candidates.
   */
  private compileForwardOutcomes(
    entries: ReachabilityCompilationEntry[],
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
   * through the shared dispatcher. Expression failures surface as Forge runtime
   * errors with diagnostic context.
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
  private compileTieBreakers(
    entries: ReachabilityCompilationEntry[],
    nodeRegistry: NodeRegistry,
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
    plan: ReachabilityCompilationPlan,
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
