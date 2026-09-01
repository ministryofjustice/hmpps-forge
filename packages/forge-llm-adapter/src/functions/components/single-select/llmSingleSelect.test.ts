import { FunctionRegistryTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'

import { LlmSingleSelect } from './llmSingleSelect'

describe('LlmSingleSelect', () => {
  const harness = new FunctionRegistryTestHarness(LlmSingleSelect)

  it('should render visible choices when some choices are hidden', async () => {
    // Arrange
    const field = LlmSingleSelect({
      code: 'contactMethod',
      prompt: 'How should we contact you?',
      hint: 'Choose one option.',
      llmHint: 'Use the method the user most strongly prefers.',
      llmClarificationHint: 'Explain that only one preferred method is needed.',
      requiresExplicitAnswer: true,
      options: [
        { value: 'email', text: 'Email', hint: 'We will use your saved email address.' },
        { value: 'phone', text: 'Phone' },
        { value: 'letter', text: 'Letter', visibleWhen: false },
      ],
    })

    // Act
    const output = await harness.render(field).withValue('email')

    // Assert
    expect(output).toEqual({
      kind: 'single-select',
      code: 'contactMethod',
      prompt: 'How should we contact you?',
      hint: 'Choose one option.',
      llmHint: 'Use the method the user most strongly prefers.',
      llmClarificationHint: 'Explain that only one preferred method is needed.',
      requiresExplicitAnswer: true,
      options: [
        { value: 'email', text: 'Email', hint: 'We will use your saved email address.' },
        { value: 'phone', text: 'Phone', hint: undefined },
      ],
      value: 'email',
      errors: [],
    })
  })

  it('should accept a scalar string and reject an array when validating input', () => {
    // Arrange & Act
    const scalarResult = LlmSingleSelect.inputSchema?.safeParse('email')
    const arrayResult = LlmSingleSelect.inputSchema?.safeParse(['email'])

    // Assert
    expect(scalarResult?.success).toBe(true)
    expect(arrayResult?.success).toBe(false)
  })
})
