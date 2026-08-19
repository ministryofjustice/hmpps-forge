import { describe, expect, it } from 'vitest'
import type { AnswerHistory } from '../../../chassis/contracts/runtime/answerHistory.type'
import type { JourneyReachabilityProjection } from '../../reachability/contracts/journeyReachabilityProjection.type'
import { evaluateAnswerCleardown } from './evaluateAnswerCleardown'

function evaluate(
  reachability: JourneyReachabilityProjection,
  answers: Record<string, AnswerHistory>,
): readonly string[] {
  return evaluateAnswerCleardown(reachability, answers)
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
