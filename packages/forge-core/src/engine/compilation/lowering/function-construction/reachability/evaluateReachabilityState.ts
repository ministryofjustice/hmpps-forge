import ReachabilityPathAnalyzer from './ReachabilityPathAnalyzer'
import ReachabilityGraphBuilder from './ReachabilityGraphBuilder'
import ReachabilityStateProjector from './ReachabilityStateProjector'
import type { ReachabilityStateTable } from '../../../../contracts/plans/runtimePlans.type'
import type { NodeId } from '../../../../contracts/ast/ast.type'
import type {
  ReachabilityEvaluation,
  ReachabilityNode,
  ResumeOutcome,
} from '../../../../contracts/reachability/reachabilityEvaluation.type'
import type {
  ReachabilityStateInput,
  ReachabilityEvaluationResult,
} from '../../../../contracts/reachability/generatedReachabilityEvaluation.type'

/**
 * The compiled reachability state function's body. From precomputed facts (the
 * dynamic expression results) and per-step reachability-mode validities it seeds
 * entry points, walks reachability, resolves the default entry and canonical path,
 * derives the frontier and resume outcome, and projects the consumer-facing
 * reachability state when field inventory and params are available.
 *
 * It owns no state across calls. Lowering binds the static `plan` into a closure
 * so the runtime can call it with only request-time inputs.
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

  if (input.facts.fieldInventory === undefined || input.params === undefined) {
    return { evaluation }
  }

  return {
    evaluation,
    reachability: new ReachabilityStateProjector().project(evaluation, input.facts.fieldInventory, input.params),
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
