import { html, HtmlBlock } from './html'
import { EvaluatedBlock } from '../../form/types/structures.type'
import { StructureType } from '../../form/types/enums'

describe('html component', () => {
  const mockBlock = (overrides?: Partial<HtmlBlock>): EvaluatedBlock<HtmlBlock> =>
    ({
      type: StructureType.BLOCK,
      variant: 'html',
      content: '<p>Default content</p>',
      ...overrides,
    }) as EvaluatedBlock<HtmlBlock>

  it('should render HTML content without wrapper', async () => {
    const block = mockBlock({
      content: '<div><p>Test content</p></div>',
    })

    const result = await html.render(block)

    expect(result).toBe('<div><p>Test content</p></div>')
  })

  it('should render HTML content with wrapper div when classes are provided', async () => {
    const block = mockBlock({
      content: '<p>Test content</p>',
      classes: 'custom-class',
    })

    const result = await html.render(block)

    expect(result).toBe('<div class="custom-class"><p>Test content</p></div>')
  })

  it('should render HTML content with wrapper div when attributes are provided', async () => {
    const block = mockBlock({
      content: '<p>Test content</p>',
      attributes: {
        'data-test': 'value',
        id: 'test-id',
      },
    })

    const result = await html.render(block)

    expect(result).toBe('<div data-test="value" id="test-id"><p>Test content</p></div>')
  })

  it('should render HTML content with wrapper div when both classes and attributes are provided', async () => {
    const block = mockBlock({
      content: '<p>Test content</p>',
      classes: 'custom-class',
      attributes: {
        'data-test': 'value',
      },
    })

    const result = await html.render(block)

    expect(result).toBe('<div class="custom-class" data-test="value"><p>Test content</p></div>')
  })

  it('should render complex HTML content', async () => {
    const block = mockBlock({
      content: `
        <div>
          <p class='govuk-body'>By proceeding, you agree to our
             <a href="/terms">Terms of Service</a>
          </p>
        </div>
      `,
    })

    const result = await html.render(block)

    expect(result).toBe(`
        <div>
          <p class='govuk-body'>By proceeding, you agree to our
             <a href="/terms">Terms of Service</a>
          </p>
        </div>
      `)
  })

  it('should have the correct variant', () => {
    expect(html.variant).toBe('html')
  })

  describe('tag element', () => {
    it('should render content within the specified tag', async () => {
      // Arrange
      const block = mockBlock({ tag: 'p', content: 'Hello world' })

      // Act
      const result = await html.render(block)

      // Assert
      expect(result).toBe('<p>Hello world</p>')
    })

    it('should apply classes to the tag element', async () => {
      // Arrange
      const block = mockBlock({ tag: 'h1', content: 'Title', classes: 'govuk-heading-l' })

      // Act
      const result = await html.render(block)

      // Assert
      expect(result).toBe('<h1 class="govuk-heading-l">Title</h1>')
    })

    it('should apply attributes to the tag element', async () => {
      // Arrange
      const block = mockBlock({ tag: 'p', content: 'Text', attributes: { id: 'intro' } })

      // Act
      const result = await html.render(block)

      // Assert
      expect(result).toBe('<p id="intro">Text</p>')
    })

    it('should apply both classes and attributes to the tag element', async () => {
      // Arrange
      const block = mockBlock({
        tag: 'p',
        content: 'Text',
        classes: 'govuk-body',
        attributes: { 'data-test': 'value' },
      })

      // Act
      const result = await html.render(block)

      // Assert
      expect(result).toBe('<p class="govuk-body" data-test="value">Text</p>')
    })

    it('should render void elements as self-closing', async () => {
      // Arrange
      const block = mockBlock({ tag: 'hr', classes: 'govuk-section-break' })

      // Act
      const result = await html.render(block)

      // Assert
      expect(result).toBe('<hr class="govuk-section-break">')
    })

    it('should ignore content for void elements', async () => {
      // Arrange
      const block = mockBlock({ tag: 'hr', content: 'should be ignored', classes: 'govuk-section-break' })

      // Act
      const result = await html.render(block)

      // Assert
      expect(result).toBe('<hr class="govuk-section-break">')
    })
  })
})
