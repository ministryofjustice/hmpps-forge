import { MojComponentTestHelper } from '@form-engine-moj-components/test-utils/MojComponentTestHelper'
import { setupComponentTest } from '@form-engine-moj-components/test-utils/setupComponentTest'
import { mojTicketPanel } from './mojTicketPanel'

jest.mock('nunjucks')

describe('mojTicketPanel', () => {
  setupComponentTest()

  const helper = new MojComponentTestHelper(mojTicketPanel)

  describe('Item data transformation', () => {
    it('should pass through single item with text content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Reference: ABC123',
          },
        ],
      })

      // Assert
      expect(params.items).toEqual([
        {
          text: 'Reference: ABC123',
        },
      ])
    })

    it('should pass through multiple items', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'First section',
          },
          {
            text: 'Second section',
          },
          {
            text: 'Third section',
          },
        ],
      })

      // Assert
      expect(params.items).toHaveLength(3)
      expect(params.items[0]).toEqual({ text: 'First section' })
      expect(params.items[1]).toEqual({ text: 'Second section' })
      expect(params.items[2]).toEqual({ text: 'Third section' })
    })

    it('should preserve item array structure', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            html: '<h2>Application submitted</h2>',
            classes: 'moj-ticket-panel__content--green',
          },
          {
            text: 'You will receive a confirmation email.',
          },
        ],
      })

      // Assert
      expect(params.items).toHaveLength(2)
      expect(params.items[0]).toHaveProperty('html')
      expect(params.items[0]).toHaveProperty('classes')
      expect(params.items[1]).toHaveProperty('text')
    })
  })

  describe('Item content', () => {
    it('should pass through text content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Reference: ABC123',
          },
        ],
      })

      // Assert
      expect(params.items[0].text).toBe('Reference: ABC123')
    })

    it('should pass through HTML content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            html: '<h2 class="govuk-heading-m">Application details</h2><p>Reference: ABC123</p>',
          },
        ],
      })

      // Assert
      expect(params.items[0].html).toBe('<h2 class="govuk-heading-m">Application details</h2><p>Reference: ABC123</p>')
    })

    it('should handle items with both text and html properties', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Plain text fallback',
            html: '<p>HTML content</p>',
          },
        ],
      })

      // Assert
      expect(params.items[0].text).toBe('Plain text fallback')
      expect(params.items[0].html).toBe('<p>HTML content</p>')
    })

    it('should handle items with only html', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            html: '<strong>Important information</strong>',
          },
        ],
      })

      // Assert
      expect(params.items[0].html).toBe('<strong>Important information</strong>')
      expect(params.items[0].text).toBeUndefined()
    })
  })

  describe('Item colour classes', () => {
    it('should pass through blue colour class', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Blue section',
            classes: 'moj-ticket-panel__content--blue',
          },
        ],
      })

      // Assert
      expect(params.items[0].classes).toBe('moj-ticket-panel__content--blue')
    })

    it('should pass through red colour class', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Red section',
            classes: 'moj-ticket-panel__content--red',
          },
        ],
      })

      // Assert
      expect(params.items[0].classes).toBe('moj-ticket-panel__content--red')
    })

    it('should pass through green colour class', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Green section',
            classes: 'moj-ticket-panel__content--green',
          },
        ],
      })

      // Assert
      expect(params.items[0].classes).toBe('moj-ticket-panel__content--green')
    })

    it('should pass through yellow colour class', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Yellow section',
            classes: 'moj-ticket-panel__content--yellow',
          },
        ],
      })

      // Assert
      expect(params.items[0].classes).toBe('moj-ticket-panel__content--yellow')
    })

    it('should pass through purple colour class', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Purple section',
            classes: 'moj-ticket-panel__content--purple',
          },
        ],
      })

      // Assert
      expect(params.items[0].classes).toBe('moj-ticket-panel__content--purple')
    })

    it('should pass through orange colour class', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Orange section',
            classes: 'moj-ticket-panel__content--orange',
          },
        ],
      })

      // Assert
      expect(params.items[0].classes).toBe('moj-ticket-panel__content--orange')
    })

    it('should handle multiple classes on an item', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Multi-class section',
            classes: 'moj-ticket-panel__content--blue custom-class',
          },
        ],
      })

      // Assert
      expect(params.items[0].classes).toBe('moj-ticket-panel__content--blue custom-class')
    })

    it('should handle items without classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'No classes',
          },
        ],
      })

      // Assert
      expect(params.items[0].classes).toBeUndefined()
    })
  })

  describe('Item attributes', () => {
    it('should pass through item attributes', async () => {
      // Arrange
      const itemAttributes = {
        'data-testid': 'ticket-section',
        'aria-label': 'Application summary',
      }

      // Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Section with attributes',
            attributes: itemAttributes,
          },
        ],
      })

      // Assert
      expect(params.items[0].attributes).toEqual(itemAttributes)
    })

    it('should handle items without attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'No attributes',
          },
        ],
      })

      // Assert
      expect(params.items[0].attributes).toBeUndefined()
    })

    it('should handle different attributes on different items', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'First item',
            attributes: { 'data-section': 'header' },
          },
          {
            text: 'Second item',
            attributes: { 'data-section': 'content' },
          },
        ],
      })

      // Assert
      expect(params.items[0].attributes).toEqual({ 'data-section': 'header' })
      expect(params.items[1].attributes).toEqual({ 'data-section': 'content' })
    })
  })

  describe('Container options', () => {
    it('should pass through container classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Content',
          },
        ],
        classes: 'app-ticket-panel--custom',
      })

      // Assert
      expect(params.classes).toBe('app-ticket-panel--custom')
    })

    it('should pass through container attributes', async () => {
      // Arrange
      const containerAttributes = {
        'data-testid': 'ticket-panel',
        'aria-label': 'Summary panel',
      }

      // Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Content',
          },
        ],
        attributes: containerAttributes,
      })

      // Assert
      expect(params.attributes).toEqual(containerAttributes)
    })

    it('should handle container without classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Content',
          },
        ],
      })

      // Assert
      expect(params.classes).toBeUndefined()
    })

    it('should handle container without attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Content',
          },
        ],
      })

      // Assert
      expect(params.attributes).toBeUndefined()
    })
  })

  describe('Template and context', () => {
    it('should call nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        items: [
          {
            text: 'Content',
          },
        ],
      })

      // Assert
      expect(template).toBe('moj/components/ticket-panel/template.njk')
    })

    it('should wrap params in context object', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        items: [
          {
            text: 'Content',
          },
        ],
      })

      // Assert
      expect(context).toHaveProperty('params')
      expect((context as { params: Record<string, any> }).params).toHaveProperty('items')
    })

    it('should include all params in context', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        items: [
          {
            html: '<h2>Application submitted</h2>',
            classes: 'moj-ticket-panel__content--green',
            attributes: { 'data-section': 'header' },
          },
          {
            text: 'You will receive a confirmation email.',
          },
        ],
        classes: 'app-custom-panel',
        attributes: { 'data-testid': 'panel' },
      })

      // Assert
      const params = (context as { params: Record<string, any> }).params
      expect(params).toHaveProperty('items')
      expect(params.items).toHaveLength(2)
      expect(params).toHaveProperty('classes', 'app-custom-panel')
      expect(params).toHaveProperty('attributes')
      expect(params.attributes).toEqual({ 'data-testid': 'panel' })
    })
  })
})
