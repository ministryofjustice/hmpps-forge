/**
 * Compiles a reachability plan's dynamic expressions into per-step navigation
 * leaves — entry predicate, forward outcomes, tie-breaker priority — plus the
 * journey-level resume predicate. Each leaf is a small self-contained generated
 * function; the navigation walk evaluates them per request and feeds the
 * results to the reachability graph.
 */
import { ASTNode, NodeId } from '../../../contracts/ast/ast.type'
import type { RedirectOutcomeASTNode } from '../../../contracts/ast/expressions.type'
import type {
  ForwardOutcomeGroup,
  ReachabilityCompilationEntry,
  ReachabilityCompilationPlan,
} from '../../../contracts/plans/runtimePlans.type'
import ASTNodeIndex from '../../../ast/ast-state/ASTNodeIndex'
import ExpressionDispatcher from '../../expressions/ExpressionDispatcher'
import CodeEmitter from '../../emitters/CodeEmitter'
import type {
  CompiledNavigationOutcomesFunction,
  CompiledNavigationPredicateFunction,
  CompiledNavigationTieBreakerFunction,
} from '../../../contracts/compiled/compiledFunctions.type'
import { compileGeneratedFunction } from '../../function-construction/GeneratedFunctionCompiler'
import { isRedirectOutcomeNode } from '../../../contracts/ast/outcome-nodes'
import type { CompilationDependencies } from '../../compilationDependencies.type'

/**
 * Builds the per-step generated navigation leaves from a reachability
 * compilation plan.
 */
export default class ReachabilityCompiler {
  private readonly expr: ExpressionDispatcher

  constructor(dependencies: CompilationDependencies) {
    this.expr = new ExpressionDispatcher(dependencies)
  }

  /**
   * Compiles one step's conditional-entry predicate. Returns undefined when the
   * step has no `entryWhen` expression to evaluate.
   */
  compileEntryPredicate(
    entry: ReachabilityCompilationEntry,
    nodeRegistry: ASTNodeIndex,
  ): CompiledNavigationPredicateFunction | undefined {
    return this.compilePredicate(entry.entryWhenNodeId, nodeRegistry, 'ReachabilityCompiler.compileEntryPredicate')
  }

  /**
   * Compiles the journey's `resumeWhen` predicate. Returns undefined when
   * resume is static (`resumeWhen: true` or not configured), in which case the
   * plan's `resumeAlways` flag decides.
   */
  compileResumePredicate(
    plan: ReachabilityCompilationPlan,
    nodeRegistry: ASTNodeIndex,
  ): CompiledNavigationPredicateFunction | undefined {
    return this.compilePredicate(plan.resumeWhenNodeId, nodeRegistry, 'ReachabilityCompiler.compileResumePredicate')
  }

  /**
   * Compiles one step's forward outcome evaluation.
   *
   * Forward outcomes are RedirectOutcomeASTNodes grouped by their owning submit
   * hook. Each group cascades independently — a fresh `outcomeMatched` flag per
   * group, optionally guarded by `if (hookWhen)` when the hook's `when:` is
   * reachability-compilable. Hooks with non-compilable `when:` (e.g. `Post(...)`
   * references) contribute unguarded as an intentional over-approximation.
   *
   * Returns undefined when no hook contributes a redirect outcome.
   */
  compileStepOutcomes(
    entry: ReachabilityCompilationEntry,
    nodeRegistry: ASTNodeIndex,
  ): CompiledNavigationOutcomesFunction | undefined {
    const groups = entry.forwardOutcomeGroups
      .map(group => ({
        group,
        redirectOutcomes: group.outcomeIds.map(outcomeId => nodeRegistry.get(outcomeId)).filter(isRedirectOutcomeNode),
      }))
      .filter(({ redirectOutcomes }) => redirectOutcomes.length > 0)

    if (groups.length === 0) {
      return undefined
    }

    return compileGeneratedFunction<CompiledNavigationOutcomesFunction>(
      this.expr,
      ['ctx'],
      () => this.buildOutcomesSource(groups, nodeRegistry),
      { phase: 'navigation' },
    )!
  }

  /**
   * Compiles one step's tie-breaker priority resolution.
   *
   * Tie-breakers are a priority cascade: the first rule whose `when` predicate
   * matches (or has no predicate, making it a catch-all) determines the step's
   * priority. The generated code guards each rule with `priority === undefined`
   * so later predicates are not evaluated after a winner has been chosen.
   *
   * Returns undefined when the step declares no tie-breakers.
   */
  compileTieBreaker(
    entry: ReachabilityCompilationEntry,
    nodeRegistry: ASTNodeIndex,
  ): CompiledNavigationTieBreakerFunction | undefined {
    if (entry.reachabilityTieBreakers.length === 0) {
      return undefined
    }

    return compileGeneratedFunction<CompiledNavigationTieBreakerFunction>(
      this.expr,
      ['ctx'],
      () => this.buildTieBreakerSource(entry, nodeRegistry),
      { phase: 'navigation' },
    )!
  }

  private compilePredicate(
    nodeId: NodeId | undefined,
    nodeRegistry: ASTNodeIndex,
    label: string,
  ): CompiledNavigationPredicateFunction | undefined {
    if (nodeId === undefined) {
      return undefined
    }

    const node = nodeRegistry.get(nodeId)

    if (!node) {
      return undefined
    }

    return compileGeneratedFunction<CompiledNavigationPredicateFunction>(
      this.expr,
      ['ctx'],
      () => this.buildPredicateSource(node, label),
      { phase: 'navigation' },
    )!
  }

  private buildPredicateSource(node: ASTNode, label: string): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')
    emitter.comment(label)
    emitter.return(`Boolean(${this.expr.compileExpression(node)})`)

    return emitter.toString()
  }

  private buildOutcomesSource(
    groups: Array<{ group: ForwardOutcomeGroup; redirectOutcomes: RedirectOutcomeASTNode[] }>,
    nodeRegistry: ASTNodeIndex,
  ): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')
    emitter.comment('ReachabilityCompiler.compileStepOutcomes')
    emitter.declareConst('outcomes', '[]')

    groups.forEach(({ group, redirectOutcomes }) => {
      this.compileForwardOutcomeGroup(group, redirectOutcomes, nodeRegistry, emitter)
    })

    emitter.return('outcomes')

    return emitter.toString()
  }

  private compileForwardOutcomeGroup(
    group: ForwardOutcomeGroup,
    redirectOutcomes: RedirectOutcomeASTNode[],
    nodeRegistry: ASTNodeIndex,
    emitter: CodeEmitter,
  ): void {
    const emitCascade = () => {
      emitter.scope(() => {
        const outcomeMatchedVar = emitter.let('outcomeMatched', 'false')

        redirectOutcomes.forEach(outcome => {
          this.compileForwardOutcomeCascade(outcome.properties, outcomeMatchedVar, emitter)
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
   * Emits the cascade step for one redirect outcome within a hook group: the
   * cascade guard (`outcomeMatched === false`) and the optional outcome-level
   * `when:` evaluation around the goto resolution.
   */
  private compileForwardOutcomeCascade(
    properties: RedirectOutcomeASTNode['properties'],
    outcomeMatchedVar: string,
    emitter: CodeEmitter,
  ): void {
    emitter.scope(() => {
      const { when, goto } = properties

      emitter.if(`${outcomeMatchedVar} === false`, () => {
        if (when !== undefined && this.expr.isCompilableNode(when)) {
          const whenExpr = this.expr.compileExpression(when)
          const whenVar = emitter.const('outcomeWhen', `Boolean(${whenExpr})`)

          emitter.if(whenVar, () => {
            this.compileGotoResolution(goto, outcomeMatchedVar, emitter)
          })

          return
        }

        this.compileGotoResolution(goto, outcomeMatchedVar, emitter)
      })
    })
  }

  /**
   * Emits the goto target evaluation and pushes the result to the outcomes.
   * String literals are emitted as JSON constants. AST expressions are compiled
   * through the shared dispatcher. Expression failures surface as Forge runtime
   * errors with diagnostic context.
   */
  private compileGotoResolution(goto: ASTNode | string, outcomeMatchedVar: string, emitter: CodeEmitter): void {
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
      emitter.code(`outcomes.push(String(${gotoVar}));`)
      emitter.assign(outcomeMatchedVar, 'true')
    })
  }

  private buildTieBreakerSource(entry: ReachabilityCompilationEntry, nodeRegistry: ASTNodeIndex): string {
    const emitter = new CodeEmitter()

    emitter.code('"use strict";')
    emitter.comment('ReachabilityCompiler.compileTieBreaker')

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

    emitter.return(priorityVar)

    return emitter.toString()
  }
}
