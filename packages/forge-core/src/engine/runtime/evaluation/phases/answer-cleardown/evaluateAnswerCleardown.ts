import { resolvePathParams } from '../../../../../framework/path/routePath'
import type { AnswerHistory } from '../../../../contracts/runtime/answerHistory.type'
import type { JourneyReachabilityState } from '../../../../contracts/navigation/journeyReachabilityState.type'
import type { ReachabilityEvaluation } from '../../../../contracts/navigation/reachabilityEvaluation.type'
import type { NavigationRuntimePlan } from '../../../../contracts/plans/runtimePlans.type'

/**
 * Resolves the answers of steps no active path can reach and clears each in place,
 * returning the resolved field codes. Steps on the current step's forward edges are
 * retained — their answers belong to progress the user can still return to — so only
 * steps that no path can reach under the current answers are cleared.
 */
export function evaluateAnswerCleardown(
  reachability: JourneyReachabilityState,
  answers: Record<string, AnswerHistory>,
  evaluation: ReachabilityEvaluation,
  navigationPlan: NavigationRuntimePlan,
  params: Record<string, string>,
): readonly string[] {
  const retainedStepPaths = resolveCurrentForwardStepPaths(evaluation, navigationPlan, params)
  const fieldsToClear = resolveFieldsToClear(reachability, answers, retainedStepPaths)

  clearStaleAnswers(answers, fieldsToClear)

  return fieldsToClear
}

/**
 * Resolves which answer field codes belong to unreachable steps: codes declared on
 * those steps' blocks, plus any answer key matching their `cleardownFieldCodes`
 * patterns. Steps on `retainedStepPaths` are excluded, and only codes that actually
 * have an answer are returned.
 */
function resolveFieldsToClear(
  reachability: JourneyReachabilityState,
  answers: Record<string, AnswerHistory>,
  retainedStepPaths: readonly string[],
): readonly string[] {
  const answerKeys = Object.keys(answers)

  if (answerKeys.length === 0) {
    return []
  }

  const retainedStepPathSet = new Set(retainedStepPaths)
  const unreachableSteps = reachability.unreachableSteps.filter(step => !retainedStepPathSet.has(step.path))
  const answerKeySet = new Set(answerKeys)
  const fieldsToClear = new Set<string>()

  unreachableSteps.forEach(step => {
    step.fieldCodes?.forEach(code => {
      if (answerKeySet.has(code)) {
        fieldsToClear.add(code)
      }
    })
  })

  const matchers = unreachableSteps.flatMap(step => step.cleardownFieldCodes ?? []).map(pattern => new RegExp(pattern))

  if (matchers.length > 0) {
    answerKeys.forEach(answerKey => {
      if (matchers.some(matcher => matcher.test(answerKey))) {
        fieldsToClear.add(answerKey)
      }
    })
  }

  return [...fieldsToClear]
}

/**
 * Pushes a clearing `cleardown` mutation onto each stale answer so later phases
 * observe it as unanswered. Already-cleared answers are skipped so a request never
 * stacks duplicate cleardown mutations.
 */
function clearStaleAnswers(answers: Record<string, AnswerHistory>, fieldCodes: readonly string[]): void {
  fieldCodes.forEach(fieldCode => {
    const history = answers[fieldCode]

    if (history === undefined || history.current === undefined) {
      return
    }

    history.current = undefined
    history.parsed = undefined
    history.mutations.push({ value: undefined, source: 'cleardown' })
  })
}

/**
 * Navigation's `isReachable` is current-step-relative: steps ahead of the requested
 * step count as unreachable so users cannot jump forward. Cleardown must not treat
 * those as stale — their answers belong to progress the user can still return to. So
 * the current step's own forward edges are retained, leaving cleardown to clear only
 * steps that no path can reach under the current answers.
 */
function resolveCurrentForwardStepPaths(
  evaluation: ReachabilityEvaluation,
  navigationPlan: NavigationRuntimePlan,
  params: Record<string, string>,
): readonly string[] {
  const currentStep = evaluation.steps.find(step => step.stepId === evaluation.currentStepId)
  const currentEntry = navigationPlan.entries?.find(entry => entry.stepId === evaluation.currentStepId)

  if (
    currentStep === undefined ||
    currentEntry?.forwardOutcomeEvaluation === 'over-approximate' ||
    !currentStep.isReachable ||
    !currentStep.isValid
  ) {
    return []
  }

  return currentStep.forwardRouteTemplatePaths.map(routeTemplatePath => resolvePathParams(routeTemplatePath, params))
}
