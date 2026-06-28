import { describe, expect, it } from 'vitest'
import type { AnswerHistory } from '../../../../contracts/runtime/answerHistory.type'
import type { JourneyReachabilityState } from '../../../../contracts/navigation/journeyReachabilityState.type'
import type { ReachabilityEvaluation } from '../../../../contracts/navigation/reachabilityEvaluation.type'
import type { NavigationRuntimePlan } from '../../../../contracts/plans/runtimePlans.type'
import { evaluateAnswerCleardown } from './evaluateAnswerCleardown'

const noCurrentStep = { steps: [], currentStepId: undefined } as unknown as ReachabilityEvaluation
const emptyPlan = { entries: [] } as unknown as NavigationRuntimePlan

function evaluate(
  reachability: JourneyReachabilityState,
  answers: Record<string, AnswerHistory>,
  evaluation: ReachabilityEvaluation = noCurrentStep,
  navigationPlan: NavigationRuntimePlan = emptyPlan,
): readonly string[] {
  return evaluateAnswerCleardown(reachability, answers, evaluation, navigationPlan, {})
}

describe('evaluateAnswerCleardown', () => {
  describe('evaluateAnswerCleardown()', () => {
    it('should clear unreachable answers and record a cleardown mutation', () => {
      // Arrange
      const answers: Record<string, AnswerHistory> = {
        stale: { current: 'value', parsed: 'VALUE', mutations: [{ value: 'value', source: 'post' }] },
        kept: { current: 'keep', mutations: [{ value: 'keep', source: 'post' }] },
      }
      const reachability: JourneyReachabilityState = {
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
      const reachability: JourneyReachabilityState = {
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
      const reachability: JourneyReachabilityState = {
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
      const reachability: JourneyReachabilityState = {
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
      const reachability: JourneyReachabilityState = {
        reachableSteps: [],
        unreachableSteps: [
          { path: '/forward', fieldCodes: ['retained'] },
          { path: '/stale', fieldCodes: ['stale'] },
        ],
      }
      const evaluation = {
        currentStepId: 'step-1',
        steps: [
          {
            stepId: 'step-1',
            isReachable: true,
            isValid: true,
            forwardRouteTemplatePaths: ['/forward'],
          },
        ],
      } as unknown as ReachabilityEvaluation
      const navigationPlan = {
        entries: [{ stepId: 'step-1', forwardOutcomeEvaluation: 'exact' }],
      } as unknown as NavigationRuntimePlan

      // Act
      const result = evaluate(reachability, answers, evaluation, navigationPlan)

      // Assert
      expect(result).toEqual(['stale'])
      expect(answers.retained.current).toBe('keep')
      expect(answers.stale.current).toBeUndefined()
    })

    it('should return an empty array when there are no answers', () => {
      // Arrange
      const reachability: JourneyReachabilityState = {
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
