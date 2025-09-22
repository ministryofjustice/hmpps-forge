import { html, HtmlBlock } from './html'
import { EvaluatedBlock } from '../../../../form/types/structures.type'
import { StructureType } from '../../../../form/types/enums'

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

    const result = await html.spec.render(block)

    expect(result).toBe('<div><p>Test content</p></div>')
  })

  it('should render HTML content with wrapper div when classes are provided', async () => {
    const block = mockBlock({
      content: '<p>Test content</p>',
      classes: 'custom-class',
    })

    const result = await html.spec.render(block)

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

    const result = await html.spec.render(block)

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

    const result = await html.spec.render(block)

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

    const result = await html.spec.render(block)

    expect(result).toBe(`
        <div>
          <p class='govuk-body'>By proceeding, you agree to our
             <a href="/terms">Terms of Service</a>
          </p>
        </div>
      `)
  })

  it('should have the correct variant', () => {
    expect(html.spec.variant).toBe('html')
  })
})
