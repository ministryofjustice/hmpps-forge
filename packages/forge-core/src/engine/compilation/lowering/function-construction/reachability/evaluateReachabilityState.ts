import NavigationPathAnalyzer from './NavigationPathAnalyzer'
import ReachabilityGraphBuilder from './ReachabilityGraphBuilder'
import ReachabilityStateProjector from './ReachabilityStateProjector'
import type { NavigationRuntimePlan } from '../../../../contracts/plans/runtimePlans.type'
import type { NodeId } from '../../../../contracts/ast/ast.type'
import type {
  ReachabilityEvaluation,
  ReachabilityNode,
  ResumeOutcome,
} from '../../../../contracts/navigation/reachabilityEvaluation.type'
import type {
  ReachabilityStateInput,
  ReachabilityEvaluationResult,
} from '../../../../contracts/navigation/generatedReachabilityEvaluation.type'

/**
 * The compiled reachability state function's body. From precomputed facts (the
 * dynamic expression results) and per-step navigation-mode validities it seeds
 * entry points, walks reachability, resolves the default entry and canonical path,
 * derives the frontier and resume outcome, and projects the consumer-facing
 * reachability state when field inventory and params are available.
 *
 * It owns no state across calls. Lowering binds the static `plan` into a closure
 * so the runtime can call it with only request-time inputs.
 */
export function evaluateReachabilityState(
  plan: NavigationRuntimePlan,
  input: ReachabilityStateInput,
): ReachabilityEvaluationResult {
  const builder = new ReachabilityGraphBuilder()
  const steps = builder.buildReachableSteps(
    plan,
    input.currentStepId,
    input.routeTemplateCatalog,
    input.facts,
    input.stepValidities,
  )
  const defaultEntryRouteTemplatePath = builder.resolveDefaultEntryRouteTemplatePath()
  const resumeActive = input.facts.resumeActive
  const pathAnalysis = new NavigationPathAnalyzer().analyze(
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
    cleardownRetentionRouteTemplatePaths: resolveCleardownRetentionRouteTemplatePaths(plan, input.currentStepId, steps),
  }

  if (input.facts.fieldInventory === undefined || input.params === undefined) {
    return { evaluation }
  }

  return {
    evaluation,
    reachability: new ReachabilityStateProjector().project(evaluation, input.facts.fieldInventory, input.params),
  }
}

/**
 * Navigation's `isReachable` is current-step-relative: steps ahead of the requested
 * step count as unreachable so users cannot jump forward. Answer-cleardown must not
 * treat those as stale, so the current step's own forward edges are retained — unless
 * the step is unreachable, invalid, or its forward outcomes are over-approximated, in
 * which case nothing can be safely retained.
 */
function resolveCleardownRetentionRouteTemplatePaths(
  plan: NavigationRuntimePlan,
  currentStepId: NodeId | undefined,
  steps: ReachabilityNode[],
): string[] {
  const currentStep = steps.find(step => step.stepId === currentStepId)
  const currentEntry = plan.entries.find(entry => entry.stepId === currentStepId)

  if (
    currentStep === undefined ||
    currentEntry?.forwardOutcomeEvaluation === 'over-approximate' ||
    !currentStep.isReachable ||
    !currentStep.isValid
  ) {
    return []
  }

  return currentStep.forwardRouteTemplatePaths
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
