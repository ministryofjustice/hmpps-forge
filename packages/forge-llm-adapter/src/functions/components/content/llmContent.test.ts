import { FunctionRegistryTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'

import { LlmContent } from './llmContent'

describe('LlmContent', () => {
  const harness = new FunctionRegistryTestHarness(LlmContent)

  it('should render Markdown content when a string is provided', async () => {
    // Arrange
    const block = LlmContent({
      content: 'Your application has been saved.',
    })

    // Act
    const output = await harness.render(block)

    // Assert
    expect(output).toEqual({
      kind: 'content',
      content: 'Your application has been saved.',
    })
  })

  it('should join visible Markdown items when conditional content is provided', async () => {
    // Arrange
    const block = LlmContent({
      content: [
        { content: 'Here is what I have understood.' },
        { content: '---' },
        { content: '**Current situation:** Renting' },
        { content: '**Owned property:** House', visibleWhen: false },
      ],
    })

    // Act
    const output = await harness.render(block)

    // Assert
    expect(output).toEqual({
      kind: 'content',
      content: 'Here is what I have understood.\n\n---\n\n**Current situation:** Renting',
    })
  })
})
