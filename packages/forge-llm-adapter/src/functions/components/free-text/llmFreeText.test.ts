import { FunctionRegistryTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'

import { LlmFreeText } from './llmFreeText'

describe('LlmFreeText', () => {
  const harness = new FunctionRegistryTestHarness(LlmFreeText)

  it('should render the conversational field when content, value and errors are present', async () => {
    // Arrange
    const field = LlmFreeText({
      code: 'fullName',
      prompt: 'What is your full name?',
      hint: 'Enter your name as it appears on official documents.',
      llmHint: 'Return the name without a title.',
      llmClarificationHint: 'Explain that we need their complete official name.',
    })

    // Act
    const output = await harness.render(field).withValue('Sam Smith', [{ message: 'Enter your full name' }])

    // Assert
    expect(output).toEqual({
      kind: 'free-text',
      code: 'fullName',
      prompt: 'What is your full name?',
      hint: 'Enter your name as it appears on official documents.',
      llmHint: 'Return the name without a title.',
      llmClarificationHint: 'Explain that we need their complete official name.',
      value: 'Sam Smith',
      errors: ['Enter your full name'],
    })
  })

  it('should accept a scalar string and reject an array when validating input', () => {
    // Arrange & Act
    const scalarResult = LlmFreeText.inputSchema?.safeParse('Sam Smith')
    const arrayResult = LlmFreeText.inputSchema?.safeParse(['Sam Smith'])

    // Assert
    expect(scalarResult?.success).toBe(true)
    expect(arrayResult?.success).toBe(false)
  })
})
