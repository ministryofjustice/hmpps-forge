import { MojComponentTestHelper } from '@form-engine-moj-components/test-utils/MojComponentTestHelper'
import { setupComponentTest } from '@form-engine-moj-components/test-utils/setupComponentTest'
import { mojMessages } from './mojMessages'

jest.mock('nunjucks')

describe('mojMessages', () => {
  setupComponentTest()

  const helper = new MojComponentTestHelper(mojMessages)

  describe('Item data transformation', () => {
    it('should pass through single message', async () => {
      // Arrange
      const items = [
        {
          id: 1,
          text: 'Hello, how can I help you today?',
          type: 'received',
          sender: 'Support Agent',
          timestamp: '2019-06-14T10:00:00.000Z',
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items).toEqual(items)
      expect(params.items).toHaveLength(1)
    })

    it('should pass through multiple messages', async () => {
      // Arrange
      const items = [
        {
          id: 1,
          text: 'Hello, how can I help you today?',
          type: 'received',
          sender: 'Support Agent',
          timestamp: '2019-06-14T10:00:00.000Z',
        },
        {
          id: 2,
          text: 'I need help with my application.',
          type: 'sent',
          sender: 'John Smith',
          timestamp: '2019-06-14T10:05:00.000Z',
        },
        {
          id: 3,
          text: 'Sure, I can help you with that.',
          type: 'received',
          sender: 'Support Agent',
          timestamp: '2019-06-14T10:10:00.000Z',
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items).toEqual(items)
      expect(params.items).toHaveLength(3)
    })
  })

  describe('Message content', () => {
    it('should pass through text content', async () => {
      // Arrange
      const items = [
        {
          text: 'This is plain text content',
          type: 'sent',
          sender: 'User',
          timestamp: '2019-06-14T10:00:00.000Z',
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
          html: '<p>This is <strong>HTML</strong> content</p>',
          type: 'sent',
          sender: 'User',
          timestamp: '2019-06-14T10:00:00.000Z',
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
          html: '<p>HTML only</p>',
          type: 'sent',
          sender: 'User',
          timestamp: '2019-06-14T10:00:00.000Z',
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
          text: 'Text only',
          type: 'sent',
          sender: 'User',
          timestamp: '2019-06-14T10:00:00.000Z',
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].html).toBeUndefined()
    })
  })

  describe('Message type', () => {
    it('should pass through sent type', async () => {
      // Arrange
      const items = [
        {
          text: 'Outgoing message',
          type: 'sent',
          sender: 'User',
          timestamp: '2019-06-14T10:00:00.000Z',
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].type).toBe('sent')
    })

    it('should pass through received type', async () => {
      // Arrange
      const items = [
        {
          text: 'Incoming message',
          type: 'received',
          sender: 'Support Agent',
          timestamp: '2019-06-14T10:00:00.000Z',
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].type).toBe('received')
    })
  })

  describe('Message metadata', () => {
    it('should pass through sender', async () => {
      // Arrange
      const items = [
        {
          text: 'Message content',
          type: 'sent',
          sender: 'John Smith',
          timestamp: '2019-06-14T10:00:00.000Z',
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].sender).toBe('John Smith')
    })

    it('should pass through timestamp', async () => {
      // Arrange
      const items = [
        {
          text: 'Message content',
          type: 'sent',
          sender: 'User',
          timestamp: '2019-06-14T14:01:00.000Z',
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].timestamp).toBe('2019-06-14T14:01:00.000Z')
    })

    it('should pass through id as number', async () => {
      // Arrange
      const items = [
        {
          id: 12345,
          text: 'Message content',
          type: 'sent',
          sender: 'User',
          timestamp: '2019-06-14T10:00:00.000Z',
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].id).toBe(12345)
    })

    it('should pass through id as string', async () => {
      // Arrange
      const items = [
        {
          id: 'msg-001',
          text: 'Message content',
          type: 'sent',
          sender: 'User',
          timestamp: '2019-06-14T10:00:00.000Z',
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].id).toBe('msg-001')
    })

    it('should leave id undefined when not provided', async () => {
      // Arrange
      const items = [
        {
          text: 'Message without id',
          type: 'sent',
          sender: 'User',
          timestamp: '2019-06-14T10:00:00.000Z',
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].id).toBeUndefined()
    })
  })

  describe('Container options', () => {
    it('should pass through container id', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Message',
            type: 'sent',
            sender: 'User',
            timestamp: '2019-06-14T10:00:00.000Z',
          },
        ],
        id: 'case-messages',
      })

      // Assert
      expect(params.id).toBe('case-messages')
    })

    it('should leave container id undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Message',
            type: 'sent',
            sender: 'User',
            timestamp: '2019-06-14T10:00:00.000Z',
          },
        ],
      })

      // Assert
      expect(params.id).toBeUndefined()
    })

    it('should pass through label as aria-label', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Message',
            type: 'sent',
            sender: 'User',
            timestamp: '2019-06-14T10:00:00.000Z',
          },
        ],
        label: 'Case correspondence',
      })

      // Assert
      expect(params.label).toBe('Case correspondence')
    })

    it('should leave label undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Message',
            type: 'sent',
            sender: 'User',
            timestamp: '2019-06-14T10:00:00.000Z',
          },
        ],
      })

      // Assert
      expect(params.label).toBeUndefined()
    })
  })

  describe('Optional attributes', () => {
    it('should pass through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Message',
            type: 'sent',
            sender: 'User',
            timestamp: '2019-06-14T10:00:00.000Z',
          },
        ],
        classes: 'app-messages--compact',
      })

      // Assert
      expect(params.classes).toBe('app-messages--compact')
    })

    it('should pass through attributes', async () => {
      // Arrange
      const attributes = {
        'data-testid': 'my-messages',
        'data-module': 'app-messages',
      }

      // Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Message',
            type: 'sent',
            sender: 'User',
            timestamp: '2019-06-14T10:00:00.000Z',
          },
        ],
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
        items: [
          {
            text: 'Message',
            type: 'sent',
            sender: 'User',
            timestamp: '2019-06-14T10:00:00.000Z',
          },
        ],
      })

      // Assert
      expect(template).toBe('moj/components/messages/template.njk')
    })

    it('should wrap params in context object', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        items: [
          {
            text: 'Message',
            type: 'sent',
            sender: 'User',
            timestamp: '2019-06-14T10:00:00.000Z',
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
            id: 1,
            text: 'Hello, how can I help you today?',
            type: 'received',
            sender: 'Support Agent',
            timestamp: '2019-06-14T10:00:00.000Z',
          },
          {
            id: 2,
            html: '<p>I need help with my <strong>application</strong>.</p>',
            type: 'sent',
            sender: 'John Smith',
            timestamp: '2019-06-14T10:05:00.000Z',
          },
        ],
        id: 'case-messages',
        label: 'Case correspondence',
        classes: 'custom-class',
        attributes: { 'data-test': 'value' },
      })

      // Assert
      const params = (context as { params: Record<string, any> }).params
      expect(params).toHaveProperty('items')
      expect(params).toHaveProperty('id', 'case-messages')
      expect(params).toHaveProperty('label', 'Case correspondence')
      expect(params).toHaveProperty('classes', 'custom-class')
      expect(params).toHaveProperty('attributes')
      expect(params.items).toHaveLength(2)
      expect(params.items[0]).toHaveProperty('id', 1)
      expect(params.items[0]).toHaveProperty('text', 'Hello, how can I help you today?')
      expect(params.items[0]).toHaveProperty('type', 'received')
      expect(params.items[0]).toHaveProperty('sender', 'Support Agent')
      expect(params.items[0]).toHaveProperty('timestamp', '2019-06-14T10:00:00.000Z')
      expect(params.items[1]).toHaveProperty('id', 2)
      expect(params.items[1]).toHaveProperty('html', '<p>I need help with my <strong>application</strong>.</p>')
      expect(params.items[1]).toHaveProperty('type', 'sent')
      expect(params.items[1]).toHaveProperty('sender', 'John Smith')
      expect(params.items[1]).toHaveProperty('timestamp', '2019-06-14T10:05:00.000Z')
    })
  })
})
