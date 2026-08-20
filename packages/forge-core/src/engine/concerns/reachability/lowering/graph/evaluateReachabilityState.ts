import ReachabilityPathAnalyzer from './ReachabilityPathAnalyzer'
import ReachabilityGraphBuilder from './ReachabilityGraphBuilder'
import ReachabilityStateProjector from './ReachabilityStateProjector'
import type { ReachabilityStateTable } from '../../contracts/reachabilityModel.type'
import type { NodeId } from '../../../../chassis/contracts/ast/ast.type'
import type {
  ReachabilityEvaluation,
  ReachabilityNode,
  ResumeOutcome,
} from '../../contracts/reachabilityEvaluation.type'
import type {
  ReachabilityStateInput,
  ReachabilityEvaluationResult,
} from '../../contracts/generatedReachabilityEvaluation.type'

/**
 * The body of the compiled reachability state function. From precomputed facts
 * (the evaluated expression results) and per-step validation results, it marks
 * entry points as reachable, walks forward through the step graph, resolves the
 * default entry and canonical path, finds the frontier (the furthest reachable
 * step), derives the resume outcome, and builds the consumer-facing reachability
 * state when field inventory and params are available.
 *
 * It owns no state across calls. The lowering stage (which turns analysis models
 * into generated JavaScript) binds the static `plan` into a closure so the
 * runtime can call this with only request-time inputs.
 */
export function evaluateReachabilityState(
  plan: ReachabilityStateTable,
  input: ReachabilityStateInput,
): ReachabilityEvaluationResult {
  const builder = new ReachabilityGraphBuilder()
  const steps = builder.buildReachableSteps(plan, input.routeTemplateCatalog, input.facts, input.stepValidities)
  const defaultEntryRouteTemplatePath = builder.resolveDefaultEntryRouteTemplatePath()
  const resumeActive = input.facts.resumeActive
  const pathAnalysis = new ReachabilityPathAnalyzer().analyze(
    steps,
    input.currentStepId,
    defaultEntryRouteTemplatePath,
    resumeActive,
  )

  const evaluation: ReachabilityEvaluation = {
    currentStepId: input.currentStepId,
    steps,
    defaultEntryRouteTemplatePath,
    frontierRouteTemplatePath: pathAnalysis.frontierRouteTemplatePath,
    canonicalPathRouteTemplatePaths: pathAnalysis.canonicalPathRouteTemplatePaths,
    progressExists: pathAnalysis.progressExists,
    resumeActive,
    resumeOutcome: resolveResumeOutcome(
      steps,
      input.currentStepId,
      resumeActive,
      pathAnalysis.progressExists,
      pathAnalysis.frontierRouteTemplatePath,
    ),
    unreachableRedirect: plan.unreachableRedirect,
  }

  if (input.fieldInventory === undefined || input.params === undefined) {
    return { evaluation }
  }

  return {
    evaluation,
    reachability: new ReachabilityStateProjector().project(evaluation, input.fieldInventory, input.params),
  }
}

function resolveResumeOutcome(
  steps: ReachabilityNode[],
  currentStepId: NodeId | undefined,
  resumeActive: boolean,
  progressExists: boolean,
  frontierRouteTemplatePath: string | undefined,
): ResumeOutcome {
  if (!resumeActive || !progressExists || !frontierRouteTemplatePath) {
    return 'no-op'
  }

  if (currentStepId === undefined) {
    return 'redirect'
  }

  const currentStep = steps.find(step => step.stepId === currentStepId)

  if (!currentStep) {
    return 'no-op'
  }

  return currentStep.routeTemplatePath === frontierRouteTemplatePath ? 'no-op' : 'redirect'
}
