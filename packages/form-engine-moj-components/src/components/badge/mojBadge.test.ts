import { MojComponentTestHelper } from '@form-engine-moj-components/test-utils/MojComponentTestHelper'
import { setupComponentTest } from '@form-engine-moj-components/test-utils/setupComponentTest'
import { mojBadge } from './mojBadge'

jest.mock('nunjucks')

describe('mojBadge', () => {
  setupComponentTest()

  const helper = new MojComponentTestHelper(mojBadge)

  describe('Data transformation', () => {
    it('should pass through text content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Complete',
      })

      // Assert
      expect(params.text).toBe('Complete')
    })

    it('should pass through HTML content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        html: '<strong>Urgent</strong>',
      })

      // Assert
      expect(params.html).toBe('<strong>Urgent</strong>')
    })

    it('should leave text undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        html: '<strong>HTML only</strong>',
      })

      // Assert
      expect(params.text).toBeUndefined()
    })

    it('should leave html undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Text only',
      })

      // Assert
      expect(params.html).toBeUndefined()
    })

    it('should pass through both text and html when both provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Fallback text',
        html: '<strong>HTML content</strong>',
      })

      // Assert
      expect(params.text).toBe('Fallback text')
      expect(params.html).toBe('<strong>HTML content</strong>')
    })
  })

  describe('Colour classes', () => {
    it('should pass through red colour class', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Urgent',
        classes: 'moj-badge--red',
      })

      // Assert
      expect(params.classes).toBe('moj-badge--red')
    })

    it('should pass through green colour class', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Complete',
        classes: 'moj-badge--green',
      })

      // Assert
      expect(params.classes).toBe('moj-badge--green')
    })

    it('should pass through blue colour class', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Information',
        classes: 'moj-badge--blue',
      })

      // Assert
      expect(params.classes).toBe('moj-badge--blue')
    })

    it('should pass through purple colour class', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'New',
        classes: 'moj-badge--purple',
      })

      // Assert
      expect(params.classes).toBe('moj-badge--purple')
    })

    it('should pass through light-blue colour class', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Draft',
        classes: 'moj-badge--light-blue',
      })

      // Assert
      expect(params.classes).toBe('moj-badge--light-blue')
    })

    it('should pass through grey colour class', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Inactive',
        classes: 'moj-badge--mid-grey',
      })

      // Assert
      expect(params.classes).toBe('moj-badge--mid-grey')
    })

    it('should pass through multiple classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Custom',
        classes: 'moj-badge--red custom-badge-class',
      })

      // Assert
      expect(params.classes).toBe('moj-badge--red custom-badge-class')
    })

    it('should leave classes undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Default',
      })

      // Assert
      expect(params.classes).toBeUndefined()
    })
  })

  describe('Accessibility', () => {
    it('should pass through accessible label', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Complete',
        label: 'Status: Complete',
      })

      // Assert
      expect(params.label).toBe('Status: Complete')
    })

    it('should leave label undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Complete',
      })

      // Assert
      expect(params.label).toBeUndefined()
    })
  })

  describe('Optional attributes', () => {
    it('should pass through custom attributes', async () => {
      // Arrange
      const attributes = {
        'data-status': 'complete',
        'data-tracking': 'badge-viewed',
      }

      // Act
      const params = await helper.getParams({
        text: 'Complete',
        attributes,
      })

      // Assert
      expect(params.attributes).toEqual(attributes)
    })

    it('should leave attributes undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Complete',
      })

      // Assert
      expect(params.attributes).toBeUndefined()
    })
  })

  describe('Template and context', () => {
    it('should call nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        text: 'Badge',
      })

      // Assert
      expect(template).toBe('moj/components/badge/template.njk')
    })

    it('should wrap params in context object', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        text: 'Badge',
      })

      // Assert
      expect(context).toHaveProperty('params')
      expect((context as { params: Record<string, any> }).params).toHaveProperty('text')
    })

    it('should include all params in context', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        text: 'Complete',
        html: '<strong>Complete</strong>',
        classes: 'moj-badge--green',
        label: 'Status: Complete',
        attributes: { 'data-status': 'complete' },
      })

      // Assert
      const params = (context as { params: Record<string, any> }).params
      expect(params).toHaveProperty('text', 'Complete')
      expect(params).toHaveProperty('html', '<strong>Complete</strong>')
      expect(params).toHaveProperty('classes', 'moj-badge--green')
      expect(params).toHaveProperty('label', 'Status: Complete')
      expect(params).toHaveProperty('attributes')
    })
  })
})
