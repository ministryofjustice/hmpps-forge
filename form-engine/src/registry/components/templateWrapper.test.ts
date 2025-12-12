import { templateWrapper, EvaluatedTemplateWrapper } from './templateWrapper'
import { StructureType } from '../../form/types/enums'

describe('templateWrapper component', () => {
  const mockBlock = (overrides?: Partial<EvaluatedTemplateWrapper>): EvaluatedTemplateWrapper =>
    ({
      type: StructureType.BLOCK,
      variant: 'templateWrapper',
      template: '<div>{{slot:content}}</div>',
      ...overrides,
    }) as EvaluatedTemplateWrapper

  describe('render()', () => {
    it('should render template with slot content', async () => {
      // Arrange
      const block = mockBlock({
        template: '<section>{{slot:content}}</section>',
        slots: {
          content: [
            { block: { type: StructureType.BLOCK, variant: 'html' }, html: '<p>Hello</p>' },
            { block: { type: StructureType.BLOCK, variant: 'html' }, html: '<p>World</p>' },
          ],
        },
      })

      // Act
      const result = await templateWrapper.render(block)

      // Assert
      expect(result).toBe('<section><p>Hello</p><p>World</p></section>')
    })

    it('should render template with multiple named slots', async () => {
      // Arrange
      const block = mockBlock({
        template: '<div>{{slot:header}}<main>{{slot:content}}</main>{{slot:footer}}</div>',
        slots: {
          header: [{ block: { type: StructureType.BLOCK, variant: 'html' }, html: '<h1>Title</h1>' }],
          content: [{ block: { type: StructureType.BLOCK, variant: 'html' }, html: '<p>Body</p>' }],
          footer: [{ block: { type: StructureType.BLOCK, variant: 'html' }, html: '<footer>End</footer>' }],
        },
      })

      // Act
      const result = await templateWrapper.render(block)

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
      const result = await templateWrapper.render(block)

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
          content: [{ block: { type: StructureType.BLOCK, variant: 'html' }, html: '<p>Content here</p>' }],
        },
      })

      // Act
      const result = await templateWrapper.render(block)

      // Assert
      expect(result).toBe('<section><h2>My Section</h2><p>Content here</p><p>See also...</p></section>')
    })

    it('should remove unreplaced slot markers', async () => {
      // Arrange
      const block = mockBlock({
        template: '<div>{{slot:content}}{{slot:missing}}</div>',
        slots: {
          content: [{ block: { type: StructureType.BLOCK, variant: 'html' }, html: '<p>Present</p>' }],
        },
      })

      // Act
      const result = await templateWrapper.render(block)

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
      const result = await templateWrapper.render(block)

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
      const result = await templateWrapper.render(block)

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
      const result = await templateWrapper.render(block)

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
      const result = await templateWrapper.render(block)

      // Assert
      expect(result).toBe('<div class="custom-class" data-test="value"><p>Content</p></div>')
    })

    it('should render template without modification when no slots or values provided', async () => {
      // Arrange
      const block = mockBlock({
        template: '<div><p>Plain template</p></div>',
      })

      // Act
      const result = await templateWrapper.render(block)

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
      const result = await templateWrapper.render(block)

      // Assert
      expect(result).toBe('<div></div>')
    })

    it('should handle slot markers appearing multiple times', async () => {
      // Arrange
      const block = mockBlock({
        template: '<div>{{slot:content}}</div><div>{{slot:content}}</div>',
        slots: {
          content: [{ block: { type: StructureType.BLOCK, variant: 'html' }, html: '<span>Repeated</span>' }],
        },
      })

      // Act
      const result = await templateWrapper.render(block)

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
      const result = await templateWrapper.render(block)

      // Assert
      expect(result).toBe('<span>Alice</span> and <span>Alice</span>')
    })
  })

  it('should have the correct variant', () => {
    expect(templateWrapper.variant).toBe('templateWrapper')
  })
})
