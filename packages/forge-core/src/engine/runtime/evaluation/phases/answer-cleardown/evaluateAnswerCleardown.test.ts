import { describe, expect, it } from 'vitest'
import type { AnswerHistory } from '../../../../contracts/runtime/answerHistory.type'
import type { JourneyReachabilityProjection } from '../../../../contracts/reachability/journeyReachabilityProjection.type'
import type { ReachabilityEvaluation } from '../../../../contracts/reachability/reachabilityEvaluation.type'
import { evaluateAnswerCleardown } from './evaluateAnswerCleardown'

const noCurrentStep = {
  steps: [],
  currentStepId: undefined,
  cleardownRetentionRouteTemplatePaths: [],
} as unknown as ReachabilityEvaluation

function evaluate(
  reachability: JourneyReachabilityProjection,
  answers: Record<string, AnswerHistory>,
  evaluation: ReachabilityEvaluation = noCurrentStep,
): readonly string[] {
  return evaluateAnswerCleardown(reachability, answers, evaluation, {})
}

describe('evaluateAnswerCleardown', () => {
  describe('evaluateAnswerCleardown()', () => {
    it('should clear unreachable answers and record a cleardown mutation', () => {
      // Arrange
      const answers: Record<string, AnswerHistory> = {
        stale: { current: 'value', parsed: 'VALUE', mutations: [{ value: 'value', source: 'post' }] },
        kept: { current: 'keep', mutations: [{ value: 'keep', source: 'post' }] },
      }
      const reachability: JourneyReachabilityProjection = {
        reachableSteps: [{ path: '/choose', fieldCodes: ['kept'] }],
        unreachableSteps: [{ path: '/detail', fieldCodes: ['stale'] }],
      }

      // Act
      const result = evaluate(reachability, answers)

      // Assert
      expect(result).toEqual(['stale'])
      expect(answers.stale).toEqual({
        current: undefined,
        parsed: undefined,
        mutations: [
          { value: 'value', source: 'post' },
          { value: undefined, source: 'cleardown' },
        ],
      })
      expect(answers.kept.current).toBe('keep')
    })

    it('should only return field codes that have answers', () => {
      // Arrange
      const answers: Record<string, AnswerHistory> = {
        fieldA: { current: 'value', mutations: [] },
      }
      const reachability: JourneyReachabilityProjection = {
        reachableSteps: [],
        unreachableSteps: [{ path: '/detail', fieldCodes: ['fieldA', 'fieldB'] }],
      }

      // Act
      const result = evaluate(reachability, answers)

      // Assert
      expect(result).toEqual(['fieldA'])
    })

    it('should clear answer keys matching cleardownFieldCodes patterns', () => {
      // Arrange
      const answers: Record<string, AnswerHistory> = {
        task_1_status: { current: 'done', mutations: [] },
        task_2_status: { current: 'pending', mutations: [] },
        unrelated: { current: 'value', mutations: [] },
      }
      const reachability: JourneyReachabilityProjection = {
        reachableSteps: [],
        unreachableSteps: [{ path: '/detail', cleardownFieldCodes: ['^task_\\d+_status$'] }],
      }

      // Act
      const result = evaluate(reachability, answers)

      // Assert
      expect(result).toContain('task_1_status')
      expect(result).toContain('task_2_status')
      expect(result).not.toContain('unrelated')
    })

    it('should not stack a duplicate cleardown mutation on an already-cleared answer', () => {
      // Arrange
      const answers: Record<string, AnswerHistory> = {
        stale: { current: undefined, mutations: [{ value: undefined, source: 'cleardown' }] },
      }
      const reachability: JourneyReachabilityProjection = {
        reachableSteps: [],
        unreachableSteps: [{ path: '/detail', fieldCodes: ['stale'] }],
      }

      // Act
      evaluate(reachability, answers)

      // Assert
      expect(answers.stale.mutations).toEqual([{ value: undefined, source: 'cleardown' }])
    })

    it('should retain answers of steps on the current step forward edges', () => {
      // Arrange
      const answers: Record<string, AnswerHistory> = {
        retained: { current: 'keep', mutations: [{ value: 'keep', source: 'post' }] },
        stale: { current: 'drop', mutations: [{ value: 'drop', source: 'post' }] },
      }
      const reachability: JourneyReachabilityProjection = {
        reachableSteps: [],
        unreachableSteps: [
          { path: '/forward', fieldCodes: ['retained'] },
          { path: '/stale', fieldCodes: ['stale'] },
        ],
      }
      const evaluation = {
        currentStepId: 'step-1',
        steps: [],
        cleardownRetentionRouteTemplatePaths: ['/forward'],
      } as unknown as ReachabilityEvaluation

      // Act
      const result = evaluate(reachability, answers, evaluation)

      // Assert
      expect(result).toEqual(['stale'])
      expect(answers.retained.current).toBe('keep')
      expect(answers.stale.current).toBeUndefined()
    })

    it('should return an empty array when there are no answers', () => {
      // Arrange
      const reachability: JourneyReachabilityProjection = {
        reachableSteps: [],
        unreachableSteps: [{ path: '/detail', fieldCodes: ['stale'] }],
      }

      // Act
      const result = evaluate(reachability, {})

      // Assert
      expect(result).toEqual([])
    })
  })
})
