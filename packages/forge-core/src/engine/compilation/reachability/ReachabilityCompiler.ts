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
 * If source generation fails, compile() returns undefined and controllers fail
 * fast. There is no secondary reachability execution path.
 */
import { ASTNode } from '../../types/ast.type'
import { ASTNodeType } from '../../types/enums'
import { OutcomeType } from '../../../authoring/types/enums'
import { RedirectOutcomeASTNode } from '../../types/expressions.type'
import { ReachabilityRuntimePlan, ReachabilityStepEntry } from '../RuntimePlanBuilder'
import NodeRegistry from '../registries/NodeRegistry'
import NodeCompilationDispatcher from '../codegen/NodeCompilationDispatcher'
import CodeEmitter from '../codegen/CodeEmitter'
import FunctionRegistry from '../../registries/FunctionRegistry'
import { buildGeneratedSource, compileGeneratedFunction } from '../codegen/GeneratedFunctionCompiler'

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

export default class ReachabilityCompiler {
  private readonly expr = new NodeCompilationDispatcher()

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
    return compileGeneratedFunction<CompiledReachabilityFunction>(this.expr, ['ctx'], functionRegistry, () =>
      this.buildSource(plan, nodeRegistry),
    )
  }

  generateSource(
    plan: ReachabilityRuntimePlan,
    nodeRegistry: NodeRegistry,
    functionRegistry?: FunctionRegistry,
  ): string {
    return buildGeneratedSource(this.expr, functionRegistry, () => this.buildSource(plan, nodeRegistry))
  }

  private buildSource(plan: ReachabilityRuntimePlan, nodeRegistry: NodeRegistry): string {
    const emitter = new CodeEmitter()
    const stepCount = plan.entries.length

    emitter.emit('"use strict";')
    emitter.emit(`var entryResults = new Array(${stepCount});`)
    emitter.emit(`var outcomeValues = [${plan.entries.map(() => '[]').join(', ')}];`)
    emitter.emit(`var tieBreakerPriorities = new Array(${stepCount});`)
    emitter.emitBlank()

    this.compileEntryPredicates(plan.entries, nodeRegistry, emitter)
    this.compileForwardOutcomes(plan.entries, nodeRegistry, emitter)
    this.compileTieBreakers(plan.entries, nodeRegistry, emitter)
    this.compileResumeCondition(plan, nodeRegistry, emitter)

    emitter.emitBlank()
    emitter.emit(
      'return { entryResults: entryResults, outcomeValues: outcomeValues, tieBreakerPriorities: tieBreakerPriorities, resumeActive: resumeActive };',
    )

    return emitter.toString()
  }

  private compileEntryPredicates(
    entries: ReachabilityStepEntry[],
    nodeRegistry: NodeRegistry,
    emitter: CodeEmitter,
  ): void {
    entries.forEach((entry, index) => {
      if (entry.entryWhenNodeId === undefined) {
        return
      }

      const node = nodeRegistry.get(entry.entryWhenNodeId) as ASTNode | undefined

      if (!node) {
        return
      }

      const condVar = emitter.nextVar('_e')
      const condExpr = this.expr.compileExpression(node)

      emitter.emit(`var ${condVar};`)
      emitter.emitBlock('try', () => {
        emitter.emit(`${condVar} = ${condExpr};`)
      })
      emitter.emitBlock('catch(e)', () => {
        emitter.emit(`${condVar} = false;`)
      })
      emitter.emit(`entryResults[${index}] = !!${condVar};`)
      emitter.emitBlank()
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
    entries.forEach((entry, stepIndex) => {
      if (entry.forwardOutcomeIds.length === 0) {
        return
      }

      for (const outcomeId of entry.forwardOutcomeIds) {
        const outcomeNode = nodeRegistry.get(outcomeId)

        if (!outcomeNode || outcomeNode.type !== ASTNodeType.OUTCOME) {
          continue
        }

        const redirectNode = outcomeNode as RedirectOutcomeASTNode

        if (redirectNode.outcomeType !== OutcomeType.REDIRECT) {
          continue
        }

        const { when, goto } = redirectNode.properties

        if (when && this.isASTNode(when)) {
          const whenVar = emitter.nextVar('_ow')
          const whenExpr = this.expr.compileExpression(when)

          emitter.emit(`var ${whenVar};`)
          emitter.emitBlock('try', () => {
            emitter.emit(`${whenVar} = ${whenExpr};`)
          })
          emitter.emitBlock('catch(e)', () => {
            emitter.emit(`${whenVar} = false;`)
          })

          emitter.emitBlock(`if (${whenVar})`, () => {
            this.emitGotoResolution(goto, stepIndex, emitter)
          })
        } else {
          this.emitGotoResolution(goto, stepIndex, emitter)
        }

        emitter.emitBlank()
      }
    })
  }

  /**
   * Emits the goto target evaluation and pushes the result to outcomeValues.
   * String literals are emitted as JSON constants. AST expressions are compiled
   * through the shared dispatcher. A failing expression produces undefined, so
   * that outcome simply contributes no forward edge to the graph.
   */
  private emitGotoResolution(goto: ASTNode | string, stepIndex: number, emitter: CodeEmitter): void {
    const gotoVar = emitter.nextVar('_og')

    if (typeof goto === 'string') {
      emitter.emit(`var ${gotoVar} = ${JSON.stringify(goto)};`)
    } else if (this.isASTNode(goto)) {
      const gotoExpr = this.expr.compileExpression(goto)

      emitter.emit(`var ${gotoVar};`)
      emitter.emitBlock('try', () => {
        emitter.emit(`${gotoVar} = ${gotoExpr};`)
      })
      emitter.emitBlock('catch(e)', () => {
        emitter.emit(`${gotoVar} = undefined;`)
      })
    } else {
      return
    }

    emitter.emitBlock(`if (${gotoVar} !== undefined)`, () => {
      emitter.emit(`outcomeValues[${stepIndex}].push(String(${gotoVar}));`)
    })
  }

  /**
   * Compiles tie-breaker priority resolution for each step.
   *
   * Tie-breakers are a priority cascade: the first rule whose `when` predicate
   * matches (or has no predicate, making it a catch-all) determines the step's
   * priority. This mirrors resolveTieBreakerPriority in ReachabilityGraphBuilder.
   * The generated code uses `if (result === undefined && <when>)` guards to
   * implement first-match semantics — once a priority is assigned, subsequent
   * rules are skipped.
   */
  private compileTieBreakers(entries: ReachabilityStepEntry[], nodeRegistry: NodeRegistry, emitter: CodeEmitter): void {
    entries.forEach((entry, index) => {
      if (entry.reachabilityTieBreakers.length === 0) {
        return
      }

      const resultVar = emitter.nextVar('_tbr')

      emitter.emit(`var ${resultVar};`)

      for (const tieBreaker of entry.reachabilityTieBreakers) {
        if (tieBreaker.whenNodeId === undefined) {
          emitter.emitBlock(`if (${resultVar} === undefined)`, () => {
            emitter.emit(`${resultVar} = ${JSON.stringify(tieBreaker.priority)};`)
          })
        } else {
          const node = nodeRegistry.get(tieBreaker.whenNodeId) as ASTNode | undefined

          if (!node) {
            continue
          }

          const whenVar = emitter.nextVar('_tbw')
          const whenExpr = this.expr.compileExpression(node)

          emitter.emit(`var ${whenVar};`)
          emitter.emitBlock('try', () => {
            emitter.emit(`${whenVar} = ${whenExpr};`)
          })
          emitter.emitBlock('catch(e)', () => {
            emitter.emit(`${whenVar} = false;`)
          })
          emitter.emitBlock(`if (${resultVar} === undefined && ${whenVar})`, () => {
            emitter.emit(`${resultVar} = ${JSON.stringify(tieBreaker.priority)};`)
          })
        }
      }

      emitter.emit(`tieBreakerPriorities[${index}] = ${resultVar};`)
      emitter.emitBlank()
    })
  }

  private compileResumeCondition(
    plan: ReachabilityRuntimePlan,
    nodeRegistry: NodeRegistry,
    emitter: CodeEmitter,
  ): void {
    if (plan.resumeAlways) {
      emitter.emit('var resumeActive = true;')

      return
    }

    if (plan.resumeWhenNodeId === undefined) {
      emitter.emit('var resumeActive = false;')

      return
    }

    const node = nodeRegistry.get(plan.resumeWhenNodeId) as ASTNode | undefined

    if (!node) {
      emitter.emit('var resumeActive = false;')

      return
    }

    const condVar = emitter.nextVar('_rc')
    const condExpr = this.expr.compileExpression(node)

    emitter.emit(`var ${condVar};`)
    emitter.emitBlock('try', () => {
      emitter.emit(`${condVar} = ${condExpr};`)
    })
    emitter.emitBlock('catch(e)', () => {
      emitter.emit(`${condVar} = false;`)
    })
    emitter.emit(`var resumeActive = !!${condVar};`)
  }

  private isASTNode(value: unknown): value is ASTNode {
    return value !== null &&
      value !== undefined &&
      typeof value === 'object' &&
      'type' in (value as Record<string, unknown>) &&
      'id' in (value as Record<string, unknown>) &&
      (value as Record<string, unknown>).type !== ASTNodeType.TEMPLATE
  }
}
