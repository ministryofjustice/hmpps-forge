import ReachabilityStateProjector from './ReachabilityStateProjector'
import NavigationPathAnalyzer from './NavigationPathAnalyzer'
import type { NodeId } from '../../../../contracts/ast/ast.type'
import type {
  ReachabilityEvaluation,
  ReachabilityNode,
  ResumeOutcome,
} from '../../../../contracts/navigation/reachabilityEvaluation.type'
import type { CompiledReachabilityResult } from '../../../../contracts/compiled/compiledFunctions.type'
import type {
  ReachabilityEvaluationInput,
  ReachabilityEvaluationResult,
} from '../../../../contracts/navigation/generatedReachabilityEvaluation.type'

/**
 * Assembles the navigation result once the reachability walk is complete. The
 * walk reads precomputed per-step validities (filled by the eager validities
 * phase before navigation); this only derives the default entry path, runs path
 * analysis, computes the resume outcome, and optionally projects reachability.
 */
export function finalizeReachabilityEvaluation(
  steps: ReachabilityNode[],
  defaultEntryRouteTemplatePath: string | undefined,
  input: ReachabilityEvaluationInput,
  compiledResult: CompiledReachabilityResult,
): ReachabilityEvaluationResult {
  const pathAnalyzer = new NavigationPathAnalyzer()
  const resumeActive = compiledResult.resumeActive
  const pathAnalysis = pathAnalyzer.analyze(steps, input.currentStepId, defaultEntryRouteTemplatePath, resumeActive)
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
    unreachableRedirect: input.plan.unreachableRedirect,
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
  steps: ReachabilityEvaluation['steps'],
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
