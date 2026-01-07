import { MojComponentTestHelper } from '@form-engine-moj-components/test-utils/MojComponentTestHelper'
import { setupComponentTest } from '@form-engine-moj-components/test-utils/setupComponentTest'
import { mojProgressBar } from './mojProgressBar'

jest.mock('nunjucks')

describe('mojProgressBar', () => {
  setupComponentTest()

  const helper = new MojComponentTestHelper(mojProgressBar)

  describe('Item data transformation', () => {
    it('should transform item with string label to object format', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ label: 'Step 1' }],
      })

      // Assert
      expect(params.items?.[0].label).toEqual({ text: 'Step 1' })
    })

    it('should pass through item with object label unchanged', async () => {
      // Arrange
      const label = {
        text: 'Step 1',
        classes: 'custom-label-class',
      }

      // Act
      const params = await helper.getParams({
        items: [{ label }],
      })

      // Assert
      expect(params.items?.[0].label).toEqual(label)
    })

    it('should pass through item label with HTML content', async () => {
      // Arrange
      const label = {
        html: '<strong>Important</strong> Step',
      }

      // Act
      const params = await helper.getParams({
        items: [{ label }],
      })

      // Assert
      expect(params.items?.[0].label).toEqual(label)
    })

    it('should transform multiple items correctly', async () => {
      // Arrange
      const items = [
        { label: 'Personal details' },
        { label: { text: 'Contact information', classes: 'custom' } },
        { label: { html: '<span>Review</span>' } },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items).toHaveLength(3)
      expect(params.items?.[0].label).toEqual({ text: 'Personal details' })
      expect(params.items?.[1].label).toEqual({ text: 'Contact information', classes: 'custom' })
      expect(params.items?.[2].label).toEqual({ html: '<span>Review</span>' })
    })
  })

  describe('Item states', () => {
    it('should pass through active state as true', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ label: 'Current step', active: true }],
      })

      // Assert
      expect(params.items?.[0].active).toBe(true)
    })

    it('should pass through active state as false', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ label: 'Inactive step', active: false }],
      })

      // Assert
      expect(params.items?.[0].active).toBe(false)
    })

    it('should leave active undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ label: 'Step' }],
      })

      // Assert
      expect(params.items?.[0].active).toBeUndefined()
    })

    it('should pass through complete state as true', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ label: 'Completed step', complete: true }],
      })

      // Assert
      expect(params.items?.[0].complete).toBe(true)
    })

    it('should pass through complete state as false', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ label: 'Incomplete step', complete: false }],
      })

      // Assert
      expect(params.items?.[0].complete).toBe(false)
    })

    it('should leave complete undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ label: 'Step' }],
      })

      // Assert
      expect(params.items?.[0].complete).toBeUndefined()
    })

    it('should handle item with both active and complete states', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          { label: 'Done', complete: true, active: false },
          { label: 'Current', complete: false, active: true },
        ],
      })

      // Assert
      expect(params.items?.[0].complete).toBe(true)
      expect(params.items?.[0].active).toBe(false)
      expect(params.items?.[1].complete).toBe(false)
      expect(params.items?.[1].active).toBe(true)
    })

    it('should handle pending state (neither active nor complete)', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ label: 'Future step' }],
      })

      // Assert
      expect(params.items?.[0].active).toBeUndefined()
      expect(params.items?.[0].complete).toBeUndefined()
    })
  })

  describe('Item identifiers', () => {
    it('should pass through item id when provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ id: 'step-personal-details', label: 'Personal details' }],
      })

      // Assert
      expect(params.items?.[0].id).toBe('step-personal-details')
    })

    it('should leave item id undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ label: 'Step' }],
      })

      // Assert
      expect(params.items?.[0].id).toBeUndefined()
    })

    it('should pass through multiple item ids', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ id: 'step-1', label: 'First' }, { id: 'step-2', label: 'Second' }, { label: 'Third' }],
      })

      // Assert
      expect(params.items?.[0].id).toBe('step-1')
      expect(params.items?.[1].id).toBe('step-2')
      expect(params.items?.[2].id).toBeUndefined()
    })
  })

  describe('Progress bar options', () => {
    it('should pass through id when provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'application-progress',
        items: [{ label: 'Step' }],
      })

      // Assert
      expect(params.id).toBe('application-progress')
    })

    it('should leave id undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ label: 'Step' }],
      })

      // Assert
      expect(params.id).toBeUndefined()
    })

    it('should pass through label for accessibility', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        label: 'Application progress',
        items: [{ label: 'Step' }],
      })

      // Assert
      expect(params.label).toBe('Application progress')
    })

    it('should leave label undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ label: 'Step' }],
      })

      // Assert
      expect(params.label).toBeUndefined()
    })
  })

  describe('Item optional attributes', () => {
    it('should pass through item classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            label: 'Step',
            classes: 'custom-item-class',
          },
        ],
      })

      // Assert
      expect(params.items?.[0].classes).toBe('custom-item-class')
    })

    it('should pass through item attributes', async () => {
      // Arrange
      const attributes = {
        'data-testid': 'progress-item-1',
        'data-tracking': 'step-viewed',
      }

      // Act
      const params = await helper.getParams({
        items: [
          {
            label: 'Step',
            attributes,
          },
        ],
      })

      // Assert
      expect(params.items?.[0].attributes).toEqual(attributes)
    })
  })

  describe('Container optional attributes', () => {
    it('should pass through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ label: 'Step' }],
        classes: 'custom-progress-bar-class',
      })

      // Assert
      expect(params.classes).toBe('custom-progress-bar-class')
    })

    it('should pass through attributes', async () => {
      // Arrange
      const attributes = {
        'data-testid': 'progress-bar',
        'data-module': 'progress-tracker',
      }

      // Act
      const params = await helper.getParams({
        items: [{ label: 'Step' }],
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
        items: [{ label: 'Step' }],
      })

      // Assert
      expect(template).toBe('moj/components/progress-bar/template.njk')
    })

    it('should wrap params in context object', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        items: [{ label: 'Step' }],
      })

      // Assert
      expect(context).toHaveProperty('params')
      expect((context as { params: Record<string, any> }).params).toHaveProperty('items')
    })

    it('should include all params in context', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        id: 'application-progress',
        label: 'Application progress',
        items: [
          {
            id: 'step-1',
            label: 'Personal details',
            complete: true,
            classes: 'item-custom',
            attributes: { 'data-step': '1' },
          },
          {
            id: 'step-2',
            label: { text: 'Contact information', classes: 'label-custom' },
            active: true,
          },
          {
            label: 'Review and submit',
          },
        ],
        classes: 'custom-progress-class',
        attributes: { 'data-test': 'value' },
      })

      // Assert
      const params = (context as { params: Record<string, any> }).params
      expect(params).toHaveProperty('id', 'application-progress')
      expect(params).toHaveProperty('label', 'Application progress')
      expect(params).toHaveProperty('items')
      expect(params.items).toHaveLength(3)
      expect(params).toHaveProperty('classes', 'custom-progress-class')
      expect(params).toHaveProperty('attributes')
    })

    it('should transform all item labels in context', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        items: [
          { label: 'String label' },
          { label: { text: 'Object label' } },
          { label: { html: '<b>HTML label</b>' } },
        ],
      })

      // Assert
      const params = (context as { params: Record<string, any> }).params
      expect(params.items[0].label).toEqual({ text: 'String label' })
      expect(params.items[1].label).toEqual({ text: 'Object label' })
      expect(params.items[2].label).toEqual({ html: '<b>HTML label</b>' })
    })
  })
})
