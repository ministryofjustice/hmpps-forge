import { FunctionRegistryTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'

import { LlmDate } from './llmDate'

describe('LlmDate', () => {
  const harness = new FunctionRegistryTestHarness(LlmDate)

  it('should render the date field without imposing a date representation', async () => {
    // Arrange
    const field = LlmDate({
      code: 'dateOfBirth',
      prompt: 'What is your date of birth?',
      hint: 'For example, 12 June 1985.',
      llmHint: 'Return the date as YYYY-MM-DD.',
      llmClarificationHint: 'Explain which parts of a complete date are needed.',
    })

    // Act
    const output = await harness.render(field).withValue('1985-06-12', [{ message: 'Enter a valid date' }])

    // Assert
    expect(output).toEqual({
      kind: 'date',
      code: 'dateOfBirth',
      prompt: 'What is your date of birth?',
      hint: 'For example, 12 June 1985.',
      llmHint: 'Return the date as YYYY-MM-DD.',
      llmClarificationHint: 'Explain which parts of a complete date are needed.',
      value: '1985-06-12',
      errors: ['Enter a valid date'],
    })
  })

  it('should accept a scalar string and reject a structured object when validating input', () => {
    // Arrange & Act
    const scalarResult = LlmDate.inputSchema?.safeParse('1985-06-12')
    const objectResult = LlmDate.inputSchema?.safeParse({ day: '12', month: '6', year: '1985' })

    // Assert
    expect(scalarResult?.success).toBe(true)
    expect(objectResult?.success).toBe(false)
  })
})
