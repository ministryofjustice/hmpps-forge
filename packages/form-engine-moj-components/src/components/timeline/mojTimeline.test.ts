import { MojComponentTestHelper } from '@form-engine-moj-components/test-utils/MojComponentTestHelper'
import { setupComponentTest } from '@form-engine-moj-components/test-utils/setupComponentTest'
import { mojTimeline } from './mojTimeline'

jest.mock('nunjucks')

describe('mojTimeline', () => {
  setupComponentTest()

  const helper = new MojComponentTestHelper(mojTimeline)

  describe('Item data transformation', () => {
    it('should pass through single item with label text', async () => {
      // Arrange
      const items = [
        {
          label: { text: 'Application submitted' },
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items).toEqual(items)
      expect(params.items?.[0].label.text).toBe('Application submitted')
    })

    it('should pass through single item with label html', async () => {
      // Arrange
      const items = [
        {
          label: { html: '<strong>Application</strong> submitted' },
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items).toEqual(items)
      expect(params.items?.[0].label.html).toBe('<strong>Application</strong> submitted')
    })

    it('should pass through multiple items', async () => {
      // Arrange
      const items = [
        {
          label: { text: 'Application approved' },
          text: 'Your application has been approved.',
        },
        {
          label: { text: 'Application submitted' },
          text: 'Your application has been received.',
        },
        {
          label: { text: 'Application started' },
          text: 'You began your application.',
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items).toEqual(items)
      expect(params.items).toHaveLength(3)
    })
  })

  describe('Item content', () => {
    it('should pass through text content', async () => {
      // Arrange
      const items = [
        {
          label: { text: 'Event' },
          text: 'This is plain text content',
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].text).toBe('This is plain text content')
    })

    it('should pass through html content', async () => {
      // Arrange
      const items = [
        {
          label: { text: 'Event' },
          html: '<p>This is <strong>HTML</strong> content</p>',
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].html).toBe('<p>This is <strong>HTML</strong> content</p>')
    })

    it('should leave text undefined when not provided', async () => {
      // Arrange
      const items = [
        {
          label: { text: 'Event' },
          html: '<p>HTML only</p>',
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].text).toBeUndefined()
    })

    it('should leave html undefined when not provided', async () => {
      // Arrange
      const items = [
        {
          label: { text: 'Event' },
          text: 'Text only',
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].html).toBeUndefined()
    })
  })

  describe('Datetime', () => {
    it('should pass through datetime with timestamp and type', async () => {
      // Arrange
      const items = [
        {
          label: { text: 'Event' },
          datetime: {
            timestamp: '2019-06-14T14:01:00.000Z',
            type: 'datetime',
          },
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].datetime?.timestamp).toBe('2019-06-14T14:01:00.000Z')
      expect(params.items?.[0].datetime?.type).toBe('datetime')
    })

    it('should pass through datetime with shortdatetime type', async () => {
      // Arrange
      const items = [
        {
          label: { text: 'Event' },
          datetime: {
            timestamp: '2019-06-14T14:01:00.000Z',
            type: 'shortdatetime',
          },
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].datetime?.type).toBe('shortdatetime')
    })

    it('should pass through datetime with date type', async () => {
      // Arrange
      const items = [
        {
          label: { text: 'Event' },
          datetime: {
            timestamp: '2019-06-14T14:01:00.000Z',
            type: 'date',
          },
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].datetime?.type).toBe('date')
    })

    it('should pass through datetime with shortdate type', async () => {
      // Arrange
      const items = [
        {
          label: { text: 'Event' },
          datetime: {
            timestamp: '2019-06-14T14:01:00.000Z',
            type: 'shortdate',
          },
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].datetime?.type).toBe('shortdate')
    })

    it('should pass through datetime with time type', async () => {
      // Arrange
      const items = [
        {
          label: { text: 'Event' },
          datetime: {
            timestamp: '2019-06-14T14:01:00.000Z',
            type: 'time',
          },
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].datetime?.type).toBe('time')
    })

    it('should pass through datetime with custom format', async () => {
      // Arrange
      const items = [
        {
          label: { text: 'Event' },
          datetime: {
            timestamp: '2019-06-14T14:01:00.000Z',
            format: 'DD/MM/YYYY',
          },
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].datetime?.timestamp).toBe('2019-06-14T14:01:00.000Z')
      expect(params.items?.[0].datetime?.format).toBe('DD/MM/YYYY')
    })

    it('should leave datetime undefined when not provided', async () => {
      // Arrange
      const items = [
        {
          label: { text: 'Event' },
          text: 'Event without datetime',
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].datetime).toBeUndefined()
    })
  })

  describe('Byline', () => {
    it('should pass through byline with text', async () => {
      // Arrange
      const items = [
        {
          label: { text: 'Event' },
          byline: { text: 'Joe Bloggs' },
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].byline?.text).toBe('Joe Bloggs')
    })

    it('should pass through byline with html', async () => {
      // Arrange
      const items = [
        {
          label: { text: 'Event' },
          byline: { html: '<strong>Joe Bloggs</strong>' },
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].byline?.html).toBe('<strong>Joe Bloggs</strong>')
    })

    it('should leave byline undefined when not provided', async () => {
      // Arrange
      const items = [
        {
          label: { text: 'Event' },
          text: 'Event without byline',
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].byline).toBeUndefined()
    })
  })

  describe('Timeline options', () => {
    it('should pass through headingLevel 2', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ label: { text: 'Event' } }],
        headingLevel: 2,
      })

      // Assert
      expect(params.headingLevel).toBe(2)
    })

    it('should pass through headingLevel 3', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ label: { text: 'Event' } }],
        headingLevel: 3,
      })

      // Assert
      expect(params.headingLevel).toBe(3)
    })

    it('should pass through headingLevel 4', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ label: { text: 'Event' } }],
        headingLevel: 4,
      })

      // Assert
      expect(params.headingLevel).toBe(4)
    })

    it('should leave headingLevel undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ label: { text: 'Event' } }],
      })

      // Assert
      expect(params.headingLevel).toBeUndefined()
    })
  })

  describe('Item options', () => {
    it('should pass through item classes', async () => {
      // Arrange
      const items = [
        {
          label: { text: 'Event' },
          classes: 'custom-timeline-item-class',
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].classes).toBe('custom-timeline-item-class')
    })

    it('should pass through item attributes', async () => {
      // Arrange
      const items = [
        {
          label: { text: 'Event' },
          attributes: {
            'data-testid': 'timeline-item-1',
            'data-event-id': '12345',
          },
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].attributes).toEqual({
        'data-testid': 'timeline-item-1',
        'data-event-id': '12345',
      })
    })
  })

  describe('Additional options', () => {
    it('should pass through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ label: { text: 'Event' } }],
        classes: 'custom-timeline-class',
      })

      // Assert
      expect(params.classes).toBe('custom-timeline-class')
    })

    it('should pass through attributes', async () => {
      // Arrange
      const attributes = {
        'data-testid': 'my-timeline',
        'data-module': 'app-timeline',
      }

      // Act
      const params = await helper.getParams({
        items: [{ label: { text: 'Event' } }],
        attributes,
      })

      // Assert
      expect(params.attributes).toEqual(attributes)
    })
  })

  describe('Template and context', () => {
    it('should call nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        items: [{ label: { text: 'Event' } }],
      })

      // Assert
      expect(template).toBe('moj/components/timeline/template.njk')
    })

    it('should wrap params in context object', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        items: [{ label: { text: 'Event' } }],
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
            label: { text: 'Application submitted' },
            text: 'Your application has been received.',
            datetime: {
              timestamp: '2019-06-14T14:01:00.000Z',
              type: 'datetime',
            },
            byline: { text: 'Joe Bloggs' },
            classes: 'custom-item-class',
            attributes: { 'data-item': 'value' },
          },
        ],
        headingLevel: 3,
        classes: 'custom-class',
        attributes: { 'data-test': 'value' },
      })

      // Assert
      const params = (context as { params: Record<string, any> }).params
      expect(params).toHaveProperty('items')
      expect(params).toHaveProperty('headingLevel', 3)
      expect(params).toHaveProperty('classes', 'custom-class')
      expect(params).toHaveProperty('attributes')
      expect(params.items[0]).toHaveProperty('label')
      expect(params.items[0]).toHaveProperty('text', 'Your application has been received.')
      expect(params.items[0]).toHaveProperty('datetime')
      expect(params.items[0]).toHaveProperty('byline')
      expect(params.items[0]).toHaveProperty('classes', 'custom-item-class')
      expect(params.items[0]).toHaveProperty('attributes')
    })
  })
})
