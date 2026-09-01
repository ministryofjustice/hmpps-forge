import { LlmRenderer } from './LlmRenderer'

describe('LlmRenderer', () => {
  const renderer = new LlmRenderer()

  it('should preserve a structured component output when wrapping a nested block', () => {
    // Arrange
    const output = { kind: 'content', content: 'Hello' }

    // Act
    const wrapped = renderer.wrapNestedBlock({}, output)

    // Assert
    expect(wrapped).toBe(output)
  })

  it('should reject a journey that does not use an LlmTurn renderer', () => {
    // Arrange & Act
    const act = () => renderer.assemblePage()

    // Assert
    expect(act).toThrow('LLM journeys require an LlmTurn renderer')
  })
})
