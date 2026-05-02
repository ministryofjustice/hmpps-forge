import { JourneyReachabilityState } from '../../../types/JourneyReachabilityState.type'
import { AnswerHistory } from '../../../runtime/types/AnswerHistory.type'

export default class FieldsToClearResolver {
  resolve(reachability: JourneyReachabilityState | undefined, answers: Record<string, AnswerHistory>): string[] {
    const unreachableSteps = reachability?.unreachableSteps ?? []
    const answerKeys = Object.keys(answers)

    if (answerKeys.length === 0) {
      return []
    }

    const answerKeySet = new Set(answerKeys)
    const fieldsToClear = new Set<string>()

    unreachableSteps.forEach(step => {
      step.fieldCodes?.forEach(code => {
        if (answerKeySet.has(code)) {
          fieldsToClear.add(code)
        }
      })
    })

    const patterns = unreachableSteps.flatMap(step => step.cleardownFieldCodes ?? [])

    if (patterns.length > 0) {
      const matchers = patterns.map(pattern => {
        const regex = new RegExp(pattern)

        return (code: string) => regex.test(code)
      })

      answerKeys.forEach(answerKey => {
        if (matchers.some(matcher => matcher(answerKey))) {
          fieldsToClear.add(answerKey)
        }
      })
    }

    return [...fieldsToClear]
  }
}
