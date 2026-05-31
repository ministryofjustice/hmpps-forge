import ReachabilityGraphBuilder from './ReachabilityGraphBuilder'
import ReachabilityStateProjector from './ReachabilityStateProjector'
import NavigationPathAnalyzer from './NavigationPathAnalyzer'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { NavigationEvaluation, ResumeOutcome } from '../../../contracts/navigation/navigationEvaluation.type'
import type { ValidationContext } from '../../../contracts/compiled/phaseContexts.type'
import type { CompiledReachabilityResult } from '../../../contracts/compiled/compiledFunctions.type'
import type {
  NavigationEvaluationInput,
  NavigationEvaluationResult,
} from '../../../contracts/navigation/generatedNavigationEvaluation.type'

export async function evaluateGeneratedNavigation(
  validationContext: ValidationContext,
  input: NavigationEvaluationInput,
  compiledResult: CompiledReachabilityResult,
): Promise<NavigationEvaluationResult> {
  const graphBuilder = new ReachabilityGraphBuilder()
  const pathAnalyzer = new NavigationPathAnalyzer()
  const steps = await graphBuilder.build(
    input.plan,
    input.currentStepId,
    input.routeTemplateCatalog,
    validationContext,
    compiledResult,
  )
  const defaultEntryRouteTemplatePath = graphBuilder.resolveDefaultEntryRouteTemplatePath(steps)
  const resumeActive = compiledResult.resumeActive
  const pathAnalysis = pathAnalyzer.analyze(steps, input.currentStepId, defaultEntryRouteTemplatePath, resumeActive)
  const evaluation: NavigationEvaluation = {
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
  steps: NavigationEvaluation['steps'],
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
