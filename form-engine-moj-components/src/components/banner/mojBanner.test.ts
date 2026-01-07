import { MojComponentTestHelper } from '@form-engine-moj-components/test-utils/MojComponentTestHelper'
import { setupComponentTest } from '@form-engine-moj-components/test-utils/setupComponentTest'
import { mojBanner } from './mojBanner'

jest.mock('nunjucks')

describe('mojBanner', () => {
  setupComponentTest()

  const helper = new MojComponentTestHelper(mojBanner)

  describe('Data transformation', () => {
    it('should pass through text content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Your application has been submitted.',
      })

      // Assert
      expect(params.text).toBe('Your application has been submitted.')
    })

    it('should pass through HTML content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        html: '<p>Your application has been <strong>submitted</strong>.</p>',
      })

      // Assert
      expect(params.html).toBe('<p>Your application has been <strong>submitted</strong>.</p>')
    })

    it('should leave text undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        html: '<p>HTML only</p>',
      })

      // Assert
      expect(params.text).toBeUndefined()
    })

    it('should handle both text and html when provided together', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Plain text',
        html: '<p>HTML content</p>',
      })

      // Assert
      expect(params.text).toBe('Plain text')
      expect(params.html).toBe('<p>HTML content</p>')
    })
  })

  describe('Banner types', () => {
    it('should pass through success type', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        bannerType: 'success',
        text: 'Success message',
      })

      // Assert
      expect(params.type).toBe('success')
    })

    it('should pass through warning type', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        bannerType: 'warning',
        text: 'Warning message',
      })

      // Assert
      expect(params.type).toBe('warning')
    })

    it('should pass through information type', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        bannerType: 'information',
        text: 'Information message',
      })

      // Assert
      expect(params.type).toBe('information')
    })

    it('should leave type undefined when bannerType not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Default banner',
      })

      // Assert
      expect(params.type).toBeUndefined()
    })
  })

  describe('Icon fallback text', () => {
    it('should pass through iconFallbackText for accessibility', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        bannerType: 'success',
        text: 'Success message',
        iconFallbackText: 'Success',
      })

      // Assert
      expect(params.iconFallbackText).toBe('Success')
    })

    it('should leave iconFallbackText undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        bannerType: 'success',
        text: 'Success message',
      })

      // Assert
      expect(params.iconFallbackText).toBeUndefined()
    })

    it('should handle custom iconFallbackText', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        bannerType: 'warning',
        text: 'Warning message',
        iconFallbackText: 'Important warning',
      })

      // Assert
      expect(params.iconFallbackText).toBe('Important warning')
    })
  })

  describe('Optional attributes', () => {
    it('should pass through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Banner message',
        classes: 'app-banner--custom',
      })

      // Assert
      expect(params.classes).toBe('app-banner--custom')
    })

    it('should pass through attributes', async () => {
      // Arrange
      const attributes = {
        'data-module': 'custom-banner',
        'data-testid': 'banner-component',
      }

      // Act
      const params = await helper.getParams({
        text: 'Banner message',
        attributes,
      })

      // Assert
      expect(params.attributes).toEqual(attributes)
    })

    it('should leave classes undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Banner message',
      })

      // Assert
      expect(params.classes).toBeUndefined()
    })

    it('should leave attributes undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Banner message',
      })

      // Assert
      expect(params.attributes).toBeUndefined()
    })
  })

  describe('Template and context', () => {
    it('should call nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        text: 'Banner message',
      })

      // Assert
      expect(template).toBe('moj/components/banner/template.njk')
    })

    it('should wrap params in context object', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        text: 'Banner message',
      })

      // Assert
      expect(context).toHaveProperty('params')
      expect((context as { params: Record<string, any> }).params).toHaveProperty('text')
    })

    it('should include all params in context', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        bannerType: 'success',
        text: 'Success message',
        html: '<p>Success HTML</p>',
        iconFallbackText: 'Success',
        classes: 'custom-class',
        attributes: { 'data-test': 'value' },
      })

      // Assert
      const params = (context as { params: Record<string, any> }).params
      expect(params).toHaveProperty('type', 'success')
      expect(params).toHaveProperty('text', 'Success message')
      expect(params).toHaveProperty('html', '<p>Success HTML</p>')
      expect(params).toHaveProperty('iconFallbackText', 'Success')
      expect(params).toHaveProperty('classes', 'custom-class')
      expect(params).toHaveProperty('attributes')
    })
  })
})
