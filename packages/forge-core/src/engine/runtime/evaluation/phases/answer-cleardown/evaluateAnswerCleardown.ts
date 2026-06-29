import { resolvePathParams } from '../../../../../framework/path/routePath'
import type { AnswerHistory } from '../../../../contracts/runtime/answerHistory.type'
import type { JourneyReachabilityProjection } from '../../../../contracts/navigation/journeyReachabilityProjection.type'
import type { ReachabilityEvaluation } from '../../../../contracts/navigation/reachabilityEvaluation.type'

/**
 * Resolves the answers of steps no active path can reach and clears each in place,
 * returning the resolved field codes. The current step's forward edges, retained by
 * the compiled reachability state, are excluded — their answers belong to progress
 * the user can still return to — so only steps that no path can reach under the
 * current answers are cleared.
 */
export function evaluateAnswerCleardown(
  reachability: JourneyReachabilityProjection,
  answers: Record<string, AnswerHistory>,
  evaluation: ReachabilityEvaluation,
  params: Record<string, string>,
): readonly string[] {
  const retainedStepPaths = evaluation.cleardownRetentionRouteTemplatePaths.map(routeTemplatePath =>
    resolvePathParams(routeTemplatePath, params),
  )
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
  reachability: JourneyReachabilityProjection,
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
