import { evaluateCleardown } from './evaluateCleardown'
import type { AnswerHistory } from '../../../contracts/runtime/answerHistory.type'
import type { RuntimeEvaluationGlobalState } from '../../../contracts/runtime/evaluationState.type'
import type { NavigationEvaluation, NavigationStepState } from '../../../contracts/navigation/navigationEvaluation.type'
import type { NodeId } from '../../../contracts/ast/ast.type'

function createAnswers(values: Record<string, unknown>): Record<string, AnswerHistory> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, { current: value, mutations: [{ value, source: 'post' }] }]),
  )
}

interface StepStateOptions {
  readonly path: string
  readonly isEntryPoint?: boolean
  readonly isReachable?: boolean
  readonly forward?: readonly string[]
}

function createStepState(options: StepStateOptions, declarationIndex: number): NavigationStepState {
  return {
    stepNodeId: `compile_ast:${declarationIndex + 1}` as NodeId,
    routeTemplatePath: options.path,
    declarationIndex,
    isEntryPoint: options.isEntryPoint ?? false,
    isConditionalEntry: false,
    hasValidation: false,
    isReachable: options.isReachable ?? false,
    isValid: true,
    forwardRouteTemplatePaths: [...(options.forward ?? [])],
    declaredForwardRouteTemplatePaths: [],
    predecessorRouteTemplatePaths: [],
  }
}

function createEvaluation(stepOptions: StepStateOptions[]): NavigationEvaluation {
  return {
    currentStepNodeId: undefined,
    steps: stepOptions.map(createStepState),
    defaultEntryRouteTemplatePath: undefined,
    frontierRouteTemplatePath: undefined,
    canonicalPathRouteTemplatePaths: [],
    progressExists: false,
    resumeActive: false,
    resumeOutcome: 'no-op',
    unreachableRedirect: 'entry',
  }
}

describe('evaluateCleardown', () => {
  it('should push a cleardown mutation and clear current when a field belongs to a stale step', () => {
    // Arrange — /step-b sits on a branch no active forward edge reaches
    const global: RuntimeEvaluationGlobalState = {
      data: {},
      answers: createAnswers({ fieldA: 'value', fieldB: 'value' }),
      reachability: {
        reachableSteps: [{ path: '/step-a' }],
        unreachableSteps: [{ path: '/step-b', fieldCodes: ['fieldB'] }],
      },
    }
    const evaluation = createEvaluation([
      { path: '/step-a', isEntryPoint: true, isReachable: true, forward: [] },
      { path: '/step-b' },
    ])

    // Act
    const fieldCodesToClear = evaluateCleardown(global, evaluation, {})

    // Assert
    expect(fieldCodesToClear).toEqual(['fieldB'])
    expect(global.answers.fieldB.current).toBeUndefined()
    expect(global.answers.fieldB.mutations).toEqual([
      { value: 'value', source: 'post' },
      { value: undefined, source: 'cleardown' },
    ])
    expect(global.answers.fieldA.current).toBe('value')
    expect(global.answers.fieldA.mutations).toEqual([{ value: 'value', source: 'post' }])
  })

  it('should not clear answers for steps ahead of the current step on the active path', () => {
    // Arrange — /step-b is unreachable only because the user is on /step-a,
    // but /step-a's active forward edge still reaches it
    const global: RuntimeEvaluationGlobalState = {
      data: {},
      answers: createAnswers({ fieldB: 'value' }),
      reachability: {
        reachableSteps: [{ path: '/step-a' }],
        unreachableSteps: [{ path: '/step-b', fieldCodes: ['fieldB'] }],
      },
    }
    const evaluation = createEvaluation([
      { path: '/step-a', isEntryPoint: true, isReachable: true, forward: ['/step-b'] },
      { path: '/step-b', forward: [] },
    ])

    // Act
    const fieldCodesToClear = evaluateCleardown(global, evaluation, {})

    // Assert
    expect(fieldCodesToClear).toEqual([])
    expect(global.answers.fieldB.current).toBe('value')
    expect(global.answers.fieldB.mutations).toEqual([{ value: 'value', source: 'post' }])
  })

  it('should push a cleardown mutation when an answer key matches a stale step cleardownFieldCodes pattern', () => {
    // Arrange
    const global: RuntimeEvaluationGlobalState = {
      data: {},
      answers: createAnswers({ note_1: 'first', note_2: 'second', unrelated: 'value' }),
      reachability: {
        reachableSteps: [{ path: '/step-a' }],
        unreachableSteps: [{ path: '/step-b', cleardownFieldCodes: ['^note_\\d+$'] }],
      },
    }
    const evaluation = createEvaluation([
      { path: '/step-a', isEntryPoint: true, isReachable: true, forward: [] },
      { path: '/step-b' },
    ])

    // Act
    const fieldCodesToClear = evaluateCleardown(global, evaluation, {})

    // Assert
    expect(fieldCodesToClear).toEqual(['note_1', 'note_2'])
    expect(global.answers.note_1.current).toBeUndefined()
    expect(global.answers.note_2.current).toBeUndefined()
    expect(global.answers.unrelated.current).toBe('value')
  })

  it('should match stale steps by resolved path when the route template has params', () => {
    // Arrange — the projection resolves :personId, the evaluation keeps the template
    const global: RuntimeEvaluationGlobalState = {
      data: {},
      answers: createAnswers({ fieldB: 'value' }),
      reachability: {
        reachableSteps: [{ path: '/42/step-a' }],
        unreachableSteps: [{ path: '/42/step-b', fieldCodes: ['fieldB'] }],
      },
    }
    const evaluation = createEvaluation([
      { path: '/:personId/step-a', isEntryPoint: true, isReachable: true, forward: [] },
      { path: '/:personId/step-b' },
    ])

    // Act
    const fieldCodesToClear = evaluateCleardown(global, evaluation, { personId: '42' })

    // Assert
    expect(fieldCodesToClear).toEqual(['fieldB'])
    expect(global.answers.fieldB.current).toBeUndefined()
  })

  it('should leave answers untouched when no reachability projection exists', () => {
    // Arrange
    const global: RuntimeEvaluationGlobalState = {
      data: {},
      answers: createAnswers({ fieldA: 'value' }),
    }
    const evaluation = createEvaluation([{ path: '/step-a', isEntryPoint: true, isReachable: true }])

    // Act
    const fieldCodesToClear = evaluateCleardown(global, evaluation, {})

    // Assert
    expect(fieldCodesToClear).toEqual([])
    expect(global.answers.fieldA.current).toBe('value')
  })

  it('should leave answers untouched when no navigation evaluation exists', () => {
    // Arrange
    const global: RuntimeEvaluationGlobalState = {
      data: {},
      answers: createAnswers({ fieldA: 'value' }),
      reachability: {
        reachableSteps: [],
        unreachableSteps: [{ path: '/step-a', fieldCodes: ['fieldA'] }],
      },
    }

    // Act
    const fieldCodesToClear = evaluateCleardown(global, undefined, {})

    // Assert
    expect(fieldCodesToClear).toEqual([])
    expect(global.answers.fieldA.current).toBe('value')
  })
})
