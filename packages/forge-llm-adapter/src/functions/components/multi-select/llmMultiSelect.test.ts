import { FunctionRegistryTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'

import { LlmMultiSelect } from './llmMultiSelect'

describe('LlmMultiSelect', () => {
  const harness = new FunctionRegistryTestHarness(LlmMultiSelect)

  it('should render visible choices and selected values when multiple choices are selected', async () => {
    // Arrange
    const field = LlmMultiSelect({
      code: 'contactMethods',
      prompt: 'How can we contact you?',
      hint: 'Choose all that apply.',
      llmHint: 'Include only methods the user explicitly accepts.',
      llmClarificationHint: 'Explain that they can choose more than one method.',
      options: [
        { value: 'email', text: 'Email' },
        { value: 'phone', text: 'Phone' },
        { value: 'letter', text: 'Letter', visibleWhen: false },
      ],
    })

    // Act
    const output = await harness.render(field).withValue(['email', 'phone'])

    // Assert
    expect(output).toEqual({
      kind: 'multi-select',
      code: 'contactMethods',
      prompt: 'How can we contact you?',
      hint: 'Choose all that apply.',
      llmHint: 'Include only methods the user explicitly accepts.',
      llmClarificationHint: 'Explain that they can choose more than one method.',
      options: [
        { value: 'email', text: 'Email', hint: undefined },
        { value: 'phone', text: 'Phone', hint: undefined },
      ],
      value: ['email', 'phone'],
      errors: [],
    })
  })

  it('should accept an array of strings and reject a scalar when validating input', () => {
    // Arrange & Act
    const arrayResult = LlmMultiSelect.inputSchema?.safeParse(['email', 'phone'])
    const scalarResult = LlmMultiSelect.inputSchema?.safeParse('email')

    // Assert
    expect(arrayResult?.success).toBe(true)
    expect(scalarResult?.success).toBe(false)
  })
})
