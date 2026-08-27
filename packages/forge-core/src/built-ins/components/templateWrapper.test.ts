import type { EvaluatedBlock } from '../../components/types/structures.type'
import { TemplateWrapper } from './templateWrapper'
import { ComponentCallType } from '../../authoring/types/enums'

describe('templateWrapper component', () => {
  const mockBlock = (overrides?: Partial<EvaluatedBlock<TemplateWrapper>>): EvaluatedBlock<TemplateWrapper> =>
    ({
      _forge: ComponentCallType.BASIC,
      variant: 'templateWrapper',
      template: '<div>{{slot:content}}</div>',
      ...overrides,
    }) as EvaluatedBlock<TemplateWrapper>

  describe('render()', () => {
    it('should render template with slot content', async () => {
      // Arrange
      const block = mockBlock({
        template: '<section>{{slot:content}}</section>',
        slots: {
          content: [
            { block: { _forge: ComponentCallType.BASIC, variant: 'html' }, html: '<p>Hello</p>' },
            { block: { _forge: ComponentCallType.BASIC, variant: 'html' }, html: '<p>World</p>' },
          ],
        },
      })

      // Act
      const result = await TemplateWrapper.render(block)

      // Assert
      expect(result).toBe('<section><p>Hello</p><p>World</p></section>')
    })

    it('should render template with multiple named slots', async () => {
      // Arrange
      const block = mockBlock({
        template: '<div>{{slot:header}}<main>{{slot:content}}</main>{{slot:footer}}</div>',
        slots: {
          header: [
            {
              block: { _forge: ComponentCallType.BASIC, variant: 'html' },
              html: '<h1>Title</h1>',
            },
          ],
          content: [{ block: { _forge: ComponentCallType.BASIC, variant: 'html' }, html: '<p>Body</p>' }],
          footer: [
            {
              block: { _forge: ComponentCallType.BASIC, variant: 'html' },
              html: '<footer>End</footer>',
            },
          ],
        },
      })

      // Act
      const result = await TemplateWrapper.render(block)

      // Assert
      expect(result).toBe('<div><h1>Title</h1><main><p>Body</p></main><footer>End</footer></div>')
    })

    it('should render template with value substitutions', async () => {
      // Arrange
      const block = mockBlock({
        template: '<h2>{{title}}</h2><p>{{description}}</p>',
        values: {
          title: 'Journey Config',
          description: 'Learn about journey configuration.',
        },
      })

      // Act
      const result = await TemplateWrapper.render(block)

      // Assert
      expect(result).toBe('<h2>Journey Config</h2><p>Learn about journey configuration.</p>')
    })

    it('should render template with both slots and values', async () => {
      // Arrange
      const block = mockBlock({
        template: '<section><h2>{{title}}</h2>{{slot:content}}<p>{{footer}}</p></section>',
        values: {
          title: 'My Section',
          footer: 'See also...',
        },
        slots: {
          content: [
            {
              block: { _forge: ComponentCallType.BASIC, variant: 'html' },
              html: '<p>Content here</p>',
            },
          ],
        },
      })

      // Act
      const result = await TemplateWrapper.render(block)

      // Assert
      expect(result).toBe('<section><h2>My Section</h2><p>Content here</p><p>See also...</p></section>')
    })

    it('should remove unreplaced slot markers', async () => {
      // Arrange
      const block = mockBlock({
        template: '<div>{{slot:content}}{{slot:missing}}</div>',
        slots: {
          content: [
            {
              block: { _forge: ComponentCallType.BASIC, variant: 'html' },
              html: '<p>Present</p>',
            },
          ],
        },
      })

      // Act
      const result = await TemplateWrapper.render(block)

      // Assert
      expect(result).toBe('<div><p>Present</p></div>')
    })

    it('should remove unreplaced value markers', async () => {
      // Arrange
      const block = mockBlock({
        template: '<div>{{title}}{{missing}}</div>',
        values: {
          title: 'Hello',
        },
      })

      // Act
      const result = await TemplateWrapper.render(block)

      // Assert
      expect(result).toBe('<div>Hello</div>')
    })

    it('should render with wrapper div when classes are provided', async () => {
      // Arrange
      const block = mockBlock({
        template: '<p>Content</p>',
        classes: 'govuk-section',
      })

      // Act
      const result = await TemplateWrapper.render(block)

      // Assert
      expect(result).toBe('<div class="govuk-section"><p>Content</p></div>')
    })

    it('should render with wrapper div when attributes are provided', async () => {
      // Arrange
      const block = mockBlock({
        template: '<p>Content</p>',
        attributes: {
          'data-module': 'section',
          id: 'my-section',
        },
      })

      // Act
      const result = await TemplateWrapper.render(block)

      // Assert
      expect(result).toBe('<div data-module="section" id="my-section"><p>Content</p></div>')
    })

    it('should render with wrapper div when both classes and attributes are provided', async () => {
      // Arrange
      const block = mockBlock({
        template: '<p>Content</p>',
        classes: 'custom-class',
        attributes: {
          'data-test': 'value',
        },
      })

      // Act
      const result = await TemplateWrapper.render(block)

      // Assert
      expect(result).toBe('<div class="custom-class" data-test="value"><p>Content</p></div>')
    })

    it('should render with custom tag when tag is provided', async () => {
      // Arrange
      const block = mockBlock({
        template: '<p>Content</p>',
        tag: 'section',
      })

      // Act
      const result = await TemplateWrapper.render(block)

      // Assert
      expect(result).toBe('<section><p>Content</p></section>')
    })

    it('should render with custom tag and classes', async () => {
      // Arrange
      const block = mockBlock({
        template: '<p>Content</p>',
        tag: 'aside',
        classes: 'app-sidebar',
      })

      // Act
      const result = await TemplateWrapper.render(block)

      // Assert
      expect(result).toBe('<aside class="app-sidebar"><p>Content</p></aside>')
    })

    it('should render with custom tag, classes and attributes', async () => {
      // Arrange
      const block = mockBlock({
        template: '<p>Content</p>',
        tag: 'nav',
        classes: 'app-nav',
        attributes: {
          'aria-label': 'Main navigation',
        },
      })

      // Act
      const result = await TemplateWrapper.render(block)

      // Assert
      expect(result).toBe('<nav class="app-nav" aria-label="Main navigation"><p>Content</p></nav>')
    })

    it('should render template without modification when no slots or values provided', async () => {
      // Arrange
      const block = mockBlock({
        template: '<div><p>Plain template</p></div>',
      })

      // Act
      const result = await TemplateWrapper.render(block)

      // Assert
      expect(result).toBe('<div><p>Plain template</p></div>')
    })

    it('should handle empty slots array', async () => {
      // Arrange
      const block = mockBlock({
        template: '<div>{{slot:content}}</div>',
        slots: {
          content: [],
        },
      })

      // Act
      const result = await TemplateWrapper.render(block)

      // Assert
      expect(result).toBe('<div></div>')
    })

    it('should handle slot markers appearing multiple times', async () => {
      // Arrange
      const block = mockBlock({
        template: '<div>{{slot:content}}</div><div>{{slot:content}}</div>',
        slots: {
          content: [
            {
              block: { _forge: ComponentCallType.BASIC, variant: 'html' },
              html: '<span>Repeated</span>',
            },
          ],
        },
      })

      // Act
      const result = await TemplateWrapper.render(block)

      // Assert
      expect(result).toBe('<div><span>Repeated</span></div><div><span>Repeated</span></div>')
    })

    it('should handle value markers appearing multiple times', async () => {
      // Arrange
      const block = mockBlock({
        template: '<span>{{name}}</span> and <span>{{name}}</span>',
        values: {
          name: 'Alice',
        },
      })

      // Act
      const result = await TemplateWrapper.render(block)

      // Assert
      expect(result).toBe('<span>Alice</span> and <span>Alice</span>')
    })

    it('should join array values with empty string', async () => {
      // Arrange
      const block = mockBlock({
        template: '<ul>{{items}}</ul>',
        values: {
          items: ['<li>One</li>', '<li>Two</li>', '<li>Three</li>'] as unknown as string,
        },
      })

      // Act
      const result = await TemplateWrapper.render(block)

      // Assert
      expect(result).toBe('<ul><li>One</li><li>Two</li><li>Three</li></ul>')
    })

    it('should extract html from rendered block values', async () => {
      // Arrange
      const block = mockBlock({
        template: '<div>{{content}}</div>',
        values: {
          content: {
            block: { _forge: ComponentCallType.BASIC, variant: 'html' },
            html: '<p>Rendered block content</p>',
          } as unknown as string,
        },
      })

      // Act
      const result = await TemplateWrapper.render(block)

      // Assert
      expect(result).toBe('<div><p>Rendered block content</p></div>')
    })

    it('should extract html from array of rendered blocks in values', async () => {
      // Arrange
      const block = mockBlock({
        template: '<ul>{{items}}</ul>',
        values: {
          items: [
            {
              block: { _forge: ComponentCallType.BASIC, variant: 'html' },
              html: '<li>First</li>',
            },
            {
              block: { _forge: ComponentCallType.BASIC, variant: 'html' },
              html: '<li>Second</li>',
            },
          ] as unknown as string,
        },
      })

      // Act
      const result = await TemplateWrapper.render(block)

      // Assert
      expect(result).toBe('<ul><li>First</li><li>Second</li></ul>')
    })
  })

  it('should have the correct variant', () => {
    expect(TemplateWrapper.variant).toBe('templateWrapper')
  })
})
