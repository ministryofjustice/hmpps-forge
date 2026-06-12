import FieldsToClearResolver from '../../context/FieldsToClearResolver'
import { resolvePathParams } from '../../../../framework/path/routePath'
import type { NavigationEvaluation } from '../../../contracts/navigation/navigationEvaluation.type'
import type { ReachabilityStep } from '../../../contracts/navigation/journeyReachabilityState.type'
import type { RuntimeEvaluationGlobalState } from '../../../contracts/runtime/evaluationState.type'

/**
 * Runs the cleardown walk: resolves which answer field codes belong to stale
 * steps — steps no active path can reach — then pushes a clearing `cleardown`
 * mutation onto each of those answers so every later phase observes them as
 * unanswered.
 *
 * Runs directly after navigation so the navigation evaluation, the
 * reachability projection, and the answer record are sampled at the same
 * point in the request; without them (navigation never ran, or reachability
 * checks are disabled) nothing resolves and no answer is touched.
 */
export function evaluateCleardown(
  global: RuntimeEvaluationGlobalState,
  evaluation: NavigationEvaluation | undefined,
  params: Record<string, string>,
): readonly string[] {
  if (!global.reachability || !evaluation) {
    return []
  }

  const staleSteps = resolveStaleSteps(evaluation, global.reachability.unreachableSteps, params)
  const fieldCodesToClear = new FieldsToClearResolver().resolve(
    { ...global.reachability, unreachableSteps: staleSteps },
    global.answers,
  )

  fieldCodesToClear.forEach(fieldCode => {
    const answerHistory = global.answers[fieldCode]

    if (!answerHistory) {
      return
    }

    answerHistory.mutations.push({ value: undefined, source: 'cleardown' })
    answerHistory.current = undefined
  })

  return fieldCodesToClear
}

/**
 * Navigation's `isReachable` is current-step-relative: steps ahead of the
 * requested step count as unreachable so users cannot jump forward. Cleardown
 * must not treat those as stale — their answers belong to progress the user
 * can still return to. A step is stale only when it sits outside the closure
 * of the request's active forward edges walked from the journey's entry
 * points, ignoring the user's position and step validity: no amount of
 * further progress can reach it under the current answers.
 */
function resolveStaleSteps(
  evaluation: NavigationEvaluation,
  unreachableSteps: readonly ReachabilityStep[],
  params: Record<string, string>,
): ReachabilityStep[] {
  const stepsByRouteTemplatePath = new Map(evaluation.steps.map(step => [step.routeTemplatePath, step]))
  const activeRouteTemplatePaths = new Set<string>()
  const walkQueue = evaluation.steps
    .filter(step => step.isEntryPoint || step.isConditionalEntry)
    .map(step => step.routeTemplatePath)

  while (walkQueue.length > 0) {
    const routeTemplatePath = walkQueue.pop()

    if (routeTemplatePath === undefined || activeRouteTemplatePaths.has(routeTemplatePath)) {
      continue
    }

    activeRouteTemplatePaths.add(routeTemplatePath)
    stepsByRouteTemplatePath.get(routeTemplatePath)?.forwardRouteTemplatePaths.forEach(forwardRouteTemplatePath => {
      walkQueue.push(forwardRouteTemplatePath)
    })
  }

  const staleResolvedPaths = new Set(
    evaluation.steps
      .filter(step => !activeRouteTemplatePaths.has(step.routeTemplatePath))
      .map(step => resolvePathParams(step.routeTemplatePath, params)),
  )

  return unreachableSteps.filter(step => staleResolvedPaths.has(step.path))
}
