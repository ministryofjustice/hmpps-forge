import { MojComponentTestHelper } from '@form-engine-moj-components/test-utils/MojComponentTestHelper'
import { setupComponentTest } from '@form-engine-moj-components/test-utils/setupComponentTest'
import { mojSubNavigation } from './mojSubNavigation'

jest.mock('nunjucks')

describe('mojSubNavigation', () => {
  setupComponentTest()

  const helper = new MojComponentTestHelper(mojSubNavigation)

  describe('Label transformation', () => {
    it('should pass through label unchanged', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        label: 'Case sections',
        items: [{ text: 'Item 1', href: '#1' }],
      })

      // Assert
      expect(params.label).toBe('Case sections')
    })

    it('should leave label undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ text: 'Item 1', href: '#1' }],
      })

      // Assert
      expect(params.label).toBeUndefined()
    })
  })

  describe('Items transformation', () => {
    it('should pass through items array unchanged', async () => {
      // Arrange
      const items = [
        { text: 'Item 1', href: '#1', active: true },
        { text: 'Item 2', href: '#2' },
        { text: 'Item 3', href: '#3' },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items).toEqual(items)
    })

    it('should pass through item with HTML content', async () => {
      // Arrange
      const items = [{ html: '<strong>Bold Item</strong>', href: '#1' }]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items).toEqual(items)
    })

    it('should pass through item attributes', async () => {
      // Arrange
      const items = [
        {
          text: 'Item 1',
          href: '#1',
          attributes: { 'data-testid': 'nav-item-1' },
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items).toEqual(items)
    })

    it('should handle item active state', async () => {
      // Arrange
      const items = [
        { text: 'Active Item', href: '#1', active: true },
        { text: 'Inactive Item', href: '#2', active: false },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].active).toBe(true)
      expect(params.items?.[1].active).toBe(false)
    })
  })

  describe('Additional options', () => {
    it('should pass through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ text: 'Item 1', href: '#1' }],
        classes: 'custom-nav-class',
      })

      // Assert
      expect(params.classes).toBe('custom-nav-class')
    })

    it('should pass through attributes', async () => {
      // Arrange
      const attributes = {
        'data-testid': 'sub-nav',
        'aria-describedby': 'nav-description',
      }

      // Act
      const params = await helper.getParams({
        items: [{ text: 'Item 1', href: '#1' }],
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
        items: [{ text: 'Item 1', href: '#1' }],
      })

      // Assert
      expect(template).toBe('moj/components/sub-navigation/template.njk')
    })

    it('should wrap params in context object', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        items: [{ text: 'Item 1', href: '#1' }],
      })

      // Assert
      expect(context).toHaveProperty('params')
      expect((context as { params: Record<string, any> }).params).toHaveProperty('items')
    })

    it('should include all params in context', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        label: 'Navigation',
        items: [{ text: 'Item', href: '#' }],
        classes: 'custom-class',
        attributes: { 'data-test': 'value' },
      })

      // Assert
      const params = (context as { params: Record<string, any> }).params
      expect(params).toHaveProperty('label', 'Navigation')
      expect(params).toHaveProperty('items')
      expect(params).toHaveProperty('classes', 'custom-class')
      expect(params).toHaveProperty('attributes')
    })
  })
})
