import type { AnswerHistory } from '../../../chassis/contracts/runtime/answerHistory.type'
import type { JourneyReachabilityProjection } from '../../reachability/contracts/journeyReachabilityProjection.type'

/**
 * Resolves the answers of steps no active path can reach and clears each in place,
 * returning the resolved field codes. The reachability walk marks every step a valid
 * chain reaches — including steps ahead of the current one — as reachable, so only
 * steps no path can reach under the current answers are cleared.
 */
export function evaluateAnswerCleardown(
  reachability: JourneyReachabilityProjection,
  answers: Record<string, AnswerHistory>,
): readonly string[] {
  const fieldsToClear = resolveFieldsToClear(reachability, answers)

  clearStaleAnswers(answers, fieldsToClear)

  return fieldsToClear
}

/**
 * Resolves which answer field codes belong to unreachable steps: codes declared on
 * those steps' blocks, plus any answer key matching their `cleardownFieldCodes`
 * patterns. Only codes that actually have an answer are returned.
 */
function resolveFieldsToClear(
  reachability: JourneyReachabilityProjection,
  answers: Record<string, AnswerHistory>,
): readonly string[] {
  const answerKeys = Object.keys(answers)

  if (answerKeys.length === 0) {
    return []
  }

  const unreachableSteps = reachability.unreachableSteps
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
