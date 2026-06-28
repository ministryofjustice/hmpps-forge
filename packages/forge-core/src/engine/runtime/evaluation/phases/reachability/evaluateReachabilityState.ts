import { finalizeReachabilityEvaluation } from './evaluateGeneratedNavigation'
import ReachabilityGraphBuilder from './ReachabilityGraphBuilder'
import type { CompiledReachabilityResult } from '../../../../contracts/compiled/compiledFunctions.type'
import type {
  ReachabilityEvaluationInput,
  ReachabilityEvaluationResult,
} from '../../../../contracts/navigation/generatedReachabilityEvaluation.type'

/**
 * The single pure entry point for reachability. From precomputed compiled facts
 * and per-step validities it seeds entry points, walks reachability, resolves the
 * default entry and canonical path, derives the frontier and resume outcome, and
 * optionally projects the consumer-facing reachability state.
 *
 * It owns no state across calls. Today the runtime reachability work handler
 * delegates to it; later the generated state function will call the same logic.
 */
export function evaluateReachabilityState(
  input: ReachabilityEvaluationInput,
  compiledResult: CompiledReachabilityResult,
): ReachabilityEvaluationResult {
  const builder = new ReachabilityGraphBuilder()
  const steps = builder.buildReachableSteps(
    input.plan,
    input.currentStepId,
    input.routeTemplateCatalog,
    compiledResult,
    input.stepValidities ?? new Map(),
  )
  const defaultEntryRouteTemplatePath = builder.resolveDefaultEntryRouteTemplatePath()

  return finalizeReachabilityEvaluation(steps, defaultEntryRouteTemplatePath, input, compiledResult)
}
