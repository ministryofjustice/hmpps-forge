import { ReachabilityRuntimePlan } from '../../compilation/RuntimePlanBuilder'
import RuntimeEvaluationContext from '../context/RuntimeEvaluationContext'
import { NodeId } from '../../types/ast.type'
import NavigationPathAnalyzer from './NavigationPathAnalyzer'
import { NavigationEvaluation, ResumeOutcome } from '../types/NavigationEvaluation.type'
import { JourneyRouteTemplateCatalog } from '../types/routes.type'
import ReachabilityGraphBuilder from '../reachability/ReachabilityGraphBuilder'
import { CompiledReachabilityResult } from '../../compilation/reachability/ReachabilityCompiler'
import FunctionRegistry from '../../registries/FunctionRegistry'

export default class NavigationAnalyzer {
  private readonly reachabilityGraphBuilder = new ReachabilityGraphBuilder()

  private readonly navigationPathAnalyzer = new NavigationPathAnalyzer()

  async evaluate(
    plan: ReachabilityRuntimePlan,
    currentStepId: NodeId | undefined,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
    context: RuntimeEvaluationContext,
    compiledResult: CompiledReachabilityResult,
    functionRegistry: FunctionRegistry,
  ): Promise<NavigationEvaluation> {
    const steps = await this.reachabilityGraphBuilder.build(
      plan,
      currentStepId,
      routeTemplateCatalog,
      context,
      compiledResult,
      functionRegistry,
    )
    const defaultEntryRouteTemplatePath = this.reachabilityGraphBuilder.resolveDefaultEntryRouteTemplatePath(steps)

    const resumeActive = compiledResult.resumeActive
    const pathAnalysis = this.navigationPathAnalyzer.analyze(
      steps,
      currentStepId,
      defaultEntryRouteTemplatePath,
      resumeActive,
    )
    const resumeOutcome = this.resolveResumeOutcome(
      steps,
      currentStepId,
      resumeActive,
      pathAnalysis.progressExists,
      pathAnalysis.frontierRouteTemplatePath,
    )

    return {
      currentStepId,
      steps,
      defaultEntryRouteTemplatePath,
      frontierRouteTemplatePath: pathAnalysis.frontierRouteTemplatePath,
      canonicalPathRouteTemplatePaths: pathAnalysis.canonicalPathRouteTemplatePaths,
      progressExists: pathAnalysis.progressExists,
      resumeActive,
      resumeOutcome,
    }
  }

  private resolveResumeOutcome(
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
}

export function resolveStepRequestRedirect(evaluation: NavigationEvaluation): string | undefined {
  const currentStep = evaluation.steps.find(step => step.stepId === evaluation.currentStepId)

  if (!currentStep) {
    return undefined
  }

  if (evaluation.resumeOutcome === 'redirect') {
    return evaluation.frontierRouteTemplatePath
  }

  if (currentStep.isReachable) {
    return undefined
  }

  return evaluation.defaultEntryRouteTemplatePath
}

export function resolvePostRequestRedirect(evaluation: NavigationEvaluation): string | undefined {
  const currentStep = evaluation.steps.find(step => step.stepId === evaluation.currentStepId)

  if (!currentStep) {
    return undefined
  }

  if (currentStep.isReachable) {
    return undefined
  }

  return evaluation.defaultEntryRouteTemplatePath
}

export function resolveJourneyRootRedirect(evaluation: NavigationEvaluation): string | undefined {
  if (evaluation.resumeOutcome === 'redirect') {
    return evaluation.frontierRouteTemplatePath
  }

  return evaluation.defaultEntryRouteTemplatePath
}
