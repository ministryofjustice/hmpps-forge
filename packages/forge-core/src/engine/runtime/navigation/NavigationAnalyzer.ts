import { ReachabilityRuntimePlan } from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '../../compilation/thunks/types'
import { NodeId } from '../../types/ast.type'
import StepValidityAnalyzer from '../validation/StepValidityAnalyzer'
import NavigationPathAnalyzer from './NavigationPathAnalyzer'
import { NavigationEvaluation, ResumeOutcome } from './NavigationEvaluation.type'
import { JourneyRouteTemplateCatalog } from '../routes/routes.type'
import ReachabilityGraphBuilder from './ReachabilityGraphBuilder'

export default class NavigationAnalyzer {
  private readonly reachabilityGraphBuilder = new ReachabilityGraphBuilder()

  private readonly navigationPathAnalyzer = new NavigationPathAnalyzer()

  async evaluate(
    plan: ReachabilityRuntimePlan,
    currentStepId: NodeId | undefined,
    routeTemplateCatalog: JourneyRouteTemplateCatalog,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
    stepValidityAnalyzer: StepValidityAnalyzer,
  ): Promise<NavigationEvaluation> {
    const steps = await this.reachabilityGraphBuilder.build(
      plan,
      currentStepId,
      routeTemplateCatalog,
      invoker,
      context,
      stepValidityAnalyzer,
    )
    const defaultEntryRouteTemplatePath = this.reachabilityGraphBuilder.resolveDefaultEntryRouteTemplatePath(steps)
    const resumeActive = await this.evaluateResumeCondition(plan, invoker, context)
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

  private async evaluateResumeCondition(
    plan: ReachabilityRuntimePlan,
    invoker: ThunkInvocationAdapter,
    context: ThunkEvaluationContext,
  ): Promise<boolean> {
    if (plan.resumeAlways) {
      return true
    }

    if (plan.resumeWhenNodeId === undefined) {
      return false
    }

    const result = await invoker.invoke(plan.resumeWhenNodeId, context)

    return !result.error && Boolean(result.value)
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
