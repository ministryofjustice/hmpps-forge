import { AnswerHistory } from '../../compilation/thunks/types'
import FieldsToClearResolver from './FieldsToClearResolver'

describe('FieldsToClearResolver', () => {
  const resolver = new FieldsToClearResolver()

  function createAnswers(values: Record<string, unknown>): Record<string, AnswerHistory> {
    return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { current: value, mutations: [] }]))
  }

  it('should only return field codes that have answers set', () => {
    // Arrange
    const answers = createAnswers({
      fieldA: 'value',
      fieldB: 'value',
    })

    // Act
    const result = resolver.resolve(
      {
        reachableSteps: [{ path: '/step-a' }],
        unreachableSteps: [
          { path: '/step-b', fieldCodes: ['fieldA', 'fieldB'] },
          { path: '/step-c', fieldCodes: ['fieldB', 'fieldC'] },
        ],
      },
      answers,
    )

    // Assert
    expect(result).toEqual(['fieldA', 'fieldB'])
    expect(result).not.toContain('fieldC')
  })

  it('should return empty array when no reachability data exists', () => {
    // Arrange
    const answers = createAnswers({ fieldA: 'value' })

    // Act
    const result = resolver.resolve(undefined, answers)

    // Assert
    expect(result).toEqual([])
  })

  it('should include answer keys that match cleardown patterns', () => {
    // Arrange
    const answers = createAnswers({
      task_1_status: 'done',
      task_2_status: 'pending',
      unrelated: 'value',
    })

    // Act
    const result = resolver.resolve(
      {
        reachableSteps: [],
        unreachableSteps: [{ path: '/step-a', cleardownFieldCodes: ['^task_\\d+_status$'] }],
      },
      answers,
    )

    // Assert
    expect(result).toContain('task_1_status')
    expect(result).toContain('task_2_status')
    expect(result).not.toContain('unrelated')
  })

  it('should combine discovered field codes and cleardown pattern matches', () => {
    // Arrange
    const answers = createAnswers({
      staticField: 'value',
      dynamic_99: 'value',
    })

    // Act
    const result = resolver.resolve(
      {
        reachableSteps: [],
        unreachableSteps: [
          {
            path: '/step-a',
            fieldCodes: ['staticField'],
            cleardownFieldCodes: ['^dynamic_\\d+$'],
          },
        ],
      },
      answers,
    )

    // Assert
    expect(result).toContain('staticField')
    expect(result).toContain('dynamic_99')
  })
})
