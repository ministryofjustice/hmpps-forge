import ReachabilityGraphBuilder from '../../navigation/ReachabilityGraphBuilder'
import NavigationPathAnalyzer from '../../navigation/NavigationPathAnalyzer'
import ReachabilityStateProjector from '../../navigation/ReachabilityStateProjector'
import {
  resolveJourneyRootRedirect,
  resolvePostRequestRedirect,
  resolveStepRequestRedirect,
} from '../../navigation/navigationRedirects'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type {
  NavigationEvaluation,
  NavigationEvaluationInput,
  NavigationEvaluationResult,
  NavigationRedirectRule,
  ResumeOutcome,
} from '../../../contracts/navigation/navigationEvaluation.type'
import type { NavigationRuntimePlan } from '../../../contracts/plans/runtimePlans.type'
import type { StepFieldInventory } from '../../../contracts/plans/stepFieldInventory.type'
import type { CompiledReachabilityResult } from '../../../contracts/compiled/compiledFunctions.type'
import type { ReachabilityContext } from '../../../contracts/compiled/phaseContexts.type'
import type TraceRecorder from '../trace/TraceRecorder'

/**
 * Runs the navigation plan against the current request: evaluates every step's
 * compiled leaves (entry predicate, forward outcomes, tie-breaker) plus the
 * journey's resume predicate — all read-only, so concurrently — then builds the
 * reachability graph from the verdicts, analyzes the progress path, projects
 * the reachability state when request params are supplied, and resolves the
 * redirect under `input.redirectRule` (step GET, step POST, and journey-root
 * pipelines redirect under different rules).
 *
 * When a trace recorder is supplied, one decision is recorded per journey step
 * with its reachability verdict, then a resolution unit carrying the resume
 * outcome and the redirect target chosen — absent when navigation lets the
 * request continue.
 */
export async function evaluateNavigation(
  plan: NavigationRuntimePlan,
  ctx: ReachabilityContext,
  input: NavigationEvaluationInput,
  trace?: TraceRecorder,
): Promise<NavigationEvaluationResult> {
  const startedAt = performance.now()
  const compiledResult = await evaluateNavigationLeaves(plan, ctx)
  const graphBuilder = new ReachabilityGraphBuilder()
  const steps = await graphBuilder.build(plan, input.currentStepId, input.routeTemplateCatalog, ctx, compiledResult)
  const defaultEntryRouteTemplatePath = graphBuilder.resolveDefaultEntryRouteTemplatePath(steps)
  const pathAnalysis = new NavigationPathAnalyzer().analyze(
    steps,
    input.currentStepId,
    defaultEntryRouteTemplatePath,
    compiledResult.resumeActive,
  )
  const evaluation: NavigationEvaluation = {
    currentStepId: input.currentStepId,
    steps,
    defaultEntryRouteTemplatePath,
    frontierRouteTemplatePath: pathAnalysis.frontierRouteTemplatePath,
    canonicalPathRouteTemplatePaths: pathAnalysis.canonicalPathRouteTemplatePaths,
    progressExists: pathAnalysis.progressExists,
    resumeActive: compiledResult.resumeActive,
    resumeOutcome: resolveResumeOutcome(
      steps,
      input.currentStepId,
      compiledResult.resumeActive,
      pathAnalysis.progressExists,
      pathAnalysis.frontierRouteTemplatePath,
    ),
    unreachableRedirect: plan.unreachableRedirect,
  }

  const reachability =
    input.params === undefined
      ? undefined
      : new ReachabilityStateProjector().project(evaluation, await collectFieldInventory(plan, ctx), input.params)
  const redirectTarget = resolveRedirect(evaluation, input.redirectRule)

  recordNavigationTrace(trace, evaluation, redirectTarget, performance.now() - startedAt)

  return { evaluation, reachability, redirectTarget }
}

function resolveRedirect(evaluation: NavigationEvaluation, rule: NavigationRedirectRule): string | undefined {
  if (rule === 'step-get') {
    return resolveStepRequestRedirect(evaluation)
  }

  if (rule === 'step-post') {
    return resolvePostRequestRedirect(evaluation)
  }

  return resolveJourneyRootRedirect(evaluation)
}

/**
 * Evaluates every step's compiled navigation leaves and the journey's resume
 * predicate, assembling the per-step verdict arrays the reachability graph
 * consumes. Leaves are read-only expression evaluations, so steps evaluate
 * concurrently; steps without a leaf use their static default.
 */
async function evaluateNavigationLeaves(
  plan: NavigationRuntimePlan,
  ctx: ReachabilityContext,
): Promise<CompiledReachabilityResult> {
  const [verdicts, resumeActive] = await Promise.all([
    Promise.all(
      plan.entries.map(async entry => {
        const [entryResult, outcomes, tieBreakerPriority] = await Promise.all([
          entry.evaluateEntry?.(ctx),
          entry.evaluateOutcomes?.(ctx),
          entry.evaluateTieBreaker?.(ctx),
        ])

        return { entryResult, outcomes: outcomes ?? [], tieBreakerPriority }
      }),
    ),
    plan.evaluateResume ? plan.evaluateResume(ctx) : plan.resumeAlways,
  ])

  return {
    entryResults: verdicts.map(verdict => verdict.entryResult),
    outcomeValues: verdicts.map(verdict => verdict.outcomes),
    declaredOutcomeValues: plan.entries.map(entry => [...entry.declaredOutcomes]),
    tieBreakerPriorities: verdicts.map(verdict => verdict.tieBreakerPriority),
    resumeActive,
  }
}

/**
 * Collects every step's possible field codes for reachability projection.
 * Steps without a field-codes leaf inventory no codes.
 */
async function collectFieldInventory(
  plan: NavigationRuntimePlan,
  ctx: ReachabilityContext,
): Promise<StepFieldInventory[]> {
  return Promise.all(
    plan.entries.map(async entry => ({
      stepId: entry.stepId,
      fieldCodes: entry.evaluateFieldCodes ? await entry.evaluateFieldCodes(ctx) : [],
      cleardownFieldCodes: entry.cleardownFieldCodes,
    })),
  )
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

/**
 * Records the navigation verdicts: one unit per journey step in declaration
 * order, then the resolution unit. The verdicts come out of one whole-journey
 * evaluation, so step units carry no individual timing; `durationMs` on the
 * resolution unit times the full evaluation.
 */
function recordNavigationTrace(
  trace: TraceRecorder | undefined,
  evaluation: NavigationEvaluation,
  redirect: string | undefined,
  durationMs: number,
): void {
  if (!trace) {
    return
  }

  evaluation.steps.forEach(step => {
    trace.record({
      kind: 'navigation-step',
      nodeId: step.stepId,
      isReachable: step.isReachable,
      isValid: step.isValid,
    })
  })

  trace.record({
    kind: 'navigation-resolution',
    resumeOutcome: evaluation.resumeOutcome,
    redirect,
    durationMs,
  })
}
