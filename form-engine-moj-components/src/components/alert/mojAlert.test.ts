import { MojComponentTestHelper } from '@form-engine-moj-components/test-utils/MojComponentTestHelper'
import { setupComponentTest } from '@form-engine-moj-components/test-utils/setupComponentTest'
import { mojAlert } from './mojAlert'

jest.mock('nunjucks')

describe('mojAlert', () => {
  setupComponentTest()

  const helper = new MojComponentTestHelper(mojAlert)

  describe('alertVariant transformation', () => {
    it('should pass through alertVariant as variant', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        alertVariant: 'success',
        title: 'Success',
      })

      // Assert
      expect(params.variant).toBe('success')
    })

    it('should leave variant undefined when alertVariant not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        title: 'Information',
      })

      // Assert
      expect(params.variant).toBeUndefined()
    })

    it('should handle warning variant', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        alertVariant: 'warning',
        title: 'Warning',
      })

      // Assert
      expect(params.variant).toBe('warning')
    })

    it('should handle error variant', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        alertVariant: 'error',
        title: 'Error',
      })

      // Assert
      expect(params.variant).toBe('error')
    })

    it('should handle information variant', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        alertVariant: 'information',
        title: 'Information',
      })

      // Assert
      expect(params.variant).toBe('information')
    })
  })

  describe('Title transformation', () => {
    it('should pass through title unchanged', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        title: 'Alert title',
      })

      // Assert
      expect(params.title).toBe('Alert title')
    })
  })

  describe('Content transformation', () => {
    it('should pass through text content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        title: 'Alert',
        text: 'This is alert text content',
      })

      // Assert
      expect(params.text).toBe('This is alert text content')
    })

    it('should pass through HTML content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        title: 'Alert',
        html: '<p>This is <strong>HTML</strong> content</p>',
      })

      // Assert
      expect(params.html).toBe('<p>This is <strong>HTML</strong> content</p>')
    })

    it('should leave text undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        title: 'Alert',
        html: '<p>HTML only</p>',
      })

      // Assert
      expect(params.text).toBeUndefined()
    })
  })

  describe('Heading options transformation', () => {
    it('should pass through showTitleAsHeading', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        title: 'Alert',
        showTitleAsHeading: true,
      })

      // Assert
      expect(params.showTitleAsHeading).toBe(true)
    })

    it('should pass through headingTag', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        title: 'Alert',
        showTitleAsHeading: true,
        headingTag: 'h3',
      })

      // Assert
      expect(params.headingTag).toBe('h3')
    })

    it('should handle h4 heading tag', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        title: 'Alert',
        showTitleAsHeading: true,
        headingTag: 'h4',
      })

      // Assert
      expect(params.headingTag).toBe('h4')
    })
  })

  describe('Dismissible options transformation', () => {
    it('should pass through dismissible flag', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        title: 'Alert',
        dismissible: true,
      })

      // Assert
      expect(params.dismissible).toBe(true)
    })

    it('should pass through dismissText', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        title: 'Alert',
        dismissible: true,
        dismissText: 'Close this message',
      })

      // Assert
      expect(params.dismissText).toBe('Close this message')
    })

    it('should pass through focusOnDismissSelector', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        title: 'Alert',
        dismissible: true,
        focusOnDismissSelector: '#main-content',
      })

      // Assert
      expect(params.focusOnDismissSelector).toBe('#main-content')
    })
  })

  describe('Accessibility options transformation', () => {
    it('should pass through disableAutoFocus', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        title: 'Alert',
        disableAutoFocus: true,
      })

      // Assert
      expect(params.disableAutoFocus).toBe(true)
    })

    it('should pass through role', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        title: 'Alert',
        role: 'alert',
      })

      // Assert
      expect(params.role).toBe('alert')
    })
  })

  describe('Additional options', () => {
    it('should pass through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        title: 'Alert',
        classes: 'custom-alert-class',
      })

      // Assert
      expect(params.classes).toBe('custom-alert-class')
    })

    it('should pass through attributes', async () => {
      // Arrange
      const attributes = {
        'data-testid': 'my-alert',
        'data-tracking': 'alert-viewed',
      }

      // Act
      const params = await helper.getParams({
        title: 'Alert',
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
        title: 'Alert',
      })

      // Assert
      expect(template).toBe('moj/components/alert/template.njk')
    })

    it('should wrap params in context object', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        title: 'Alert',
      })

      // Assert
      expect(context).toHaveProperty('params')
      expect((context as { params: Record<string, any> }).params).toHaveProperty('title')
    })

    it('should include all params in context', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        alertVariant: 'success',
        title: 'Success Alert',
        text: 'Operation completed',
        showTitleAsHeading: true,
        headingTag: 'h3',
        dismissible: true,
        dismissText: 'Close',
        disableAutoFocus: false,
        focusOnDismissSelector: '#content',
        role: 'alert',
        classes: 'custom-class',
        attributes: { 'data-test': 'value' },
      })

      // Assert
      const params = (context as { params: Record<string, any> }).params
      expect(params).toHaveProperty('variant', 'success')
      expect(params).toHaveProperty('title', 'Success Alert')
      expect(params).toHaveProperty('text', 'Operation completed')
      expect(params).toHaveProperty('showTitleAsHeading', true)
      expect(params).toHaveProperty('headingTag', 'h3')
      expect(params).toHaveProperty('dismissible', true)
      expect(params).toHaveProperty('dismissText', 'Close')
      expect(params).toHaveProperty('disableAutoFocus', false)
      expect(params).toHaveProperty('focusOnDismissSelector', '#content')
      expect(params).toHaveProperty('role', 'alert')
      expect(params).toHaveProperty('classes', 'custom-class')
      expect(params).toHaveProperty('attributes')
    })
  })
})
