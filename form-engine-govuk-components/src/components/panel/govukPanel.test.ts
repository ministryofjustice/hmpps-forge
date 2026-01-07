import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { govukPanel } from './govukPanel'

jest.mock('nunjucks')

describe('GOV.UK Panel Component', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukPanel)

  describe('Title transformation', () => {
    it('sets titleText correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        titleText: 'Application complete',
        text: 'Your reference number is HDJ2123F',
      })

      // Assert
      expect(params.titleText).toBe('Application complete')
      expect(params.titleHtml).toBeUndefined()
    })

    it('uses titleHtml over titleText', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        titleText: 'This is ignored',
        titleHtml: '<span class="govuk-visually-hidden">Success:</span> Application complete',
        text: 'Your reference number is HDJ2123F',
      })

      // Assert
      expect(params.titleText).toBeUndefined()
      expect(params.titleHtml).toBe('<span class="govuk-visually-hidden">Success:</span> Application complete')
    })

    it('passes through headingLevel', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        titleText: 'Application complete',
        headingLevel: 2,
        text: 'Your reference number is HDJ2123F',
      })

      // Assert
      expect(params.headingLevel).toBe(2)
    })

    it('handles title without body content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        titleText: 'Application complete',
      })

      // Assert
      expect(params.titleText).toBe('Application complete')
      expect(params.text).toBeUndefined()
      expect(params.html).toBeUndefined()
    })
  })

  describe('Body content', () => {
    it('sets text content correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        titleText: 'Application complete',
        text: 'Your reference number is HDJ2123F',
      })

      // Assert
      expect(params.text).toBe('Your reference number is HDJ2123F')
      expect(params.html).toBeUndefined()
    })

    it('uses html over text when both provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        titleText: 'Application complete',
        text: 'This is ignored',
        html: '<strong>Your reference number</strong><br>HDJ2123F',
      })

      // Assert
      expect(params.text).toBeUndefined()
      expect(params.html).toBe('<strong>Your reference number</strong><br>HDJ2123F')
    })

    it('handles panel with only title', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        titleText: 'Application complete',
      })

      // Assert
      expect(params.titleText).toBe('Application complete')
      expect(params.text).toBeUndefined()
      expect(params.html).toBeUndefined()
    })
  })

  describe('Optional attributes', () => {
    it('passes through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        titleText: 'Application complete',
        text: 'Your reference number is HDJ2123F',
        classes: 'app-panel--custom',
      })

      // Assert
      expect(params.classes).toBe('app-panel--custom')
    })

    it('passes through attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        titleText: 'Application complete',
        text: 'Your reference number is HDJ2123F',
        attributes: {
          'data-module': 'custom-panel',
          'data-track': 'panel-shown',
        },
      })

      // Assert
      expect(params.attributes).toEqual({
        'data-module': 'custom-panel',
        'data-track': 'panel-shown',
      })
    })

    it('handles all options together', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        titleText: 'Application complete',
        headingLevel: 1,
        html: '<strong>Your reference number</strong><br>HDJ2123F',
        classes: 'app-panel--large',
        attributes: {
          'data-module': 'govuk-panel',
        },
      })

      // Assert
      expect(params.titleText).toBe('Application complete')
      expect(params.titleHtml).toBeUndefined()
      expect(params.headingLevel).toBe(1)
      expect(params.text).toBeUndefined()
      expect(params.html).toBe('<strong>Your reference number</strong><br>HDJ2123F')
      expect(params.classes).toBe('app-panel--large')
      expect(params.attributes).toEqual({
        'data-module': 'govuk-panel',
      })
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        titleText: 'Application complete',
        text: 'Your reference number is HDJ2123F',
      })

      // Assert
      expect(template).toBe('govuk/components/panel/template.njk')
    })

    it('wraps params in correct context structure', async () => {
      // Arrange & Act
      const { context } = (await helper.executeComponent({
        titleText: 'Application complete',
        text: 'Your reference number is HDJ2123F',
        headingLevel: 1,
      })) as { context: { params: any } }

      // Assert
      expect(context).toHaveProperty('params')
      expect(context.params).toHaveProperty('titleText', 'Application complete')
      expect(context.params).toHaveProperty('text', 'Your reference number is HDJ2123F')
      expect(context.params).toHaveProperty('headingLevel', 1)
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders a valid panel component with text', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        titleText: 'Application complete',
        text: 'Your reference number is HDJ2123F',
      })

      // Assert
      expect(html).toContain('govuk-panel')
      expect(html).toContain('govuk-panel__title')
      expect(html).toContain('Application complete')
      expect(html).toContain('govuk-panel__body')
      expect(html).toContain('Your reference number is HDJ2123F')
    })

    it('renders with HTML content', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        titleText: 'Application complete',
        html: '<strong>Your reference number</strong><br>HDJ2123F',
      })

      // Assert
      expect(html).toContain('govuk-panel')
      expect(html).toContain('Application complete')
      expect(html).toContain('<strong>Your reference number</strong>')
      expect(html).toContain('HDJ2123F')
    })

    it('renders with custom title HTML', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        titleHtml: '<span class="govuk-visually-hidden">Success:</span> Complete',
        text: 'Your reference number is HDJ2123F',
      })

      // Assert
      expect(html).toContain('govuk-panel')
      expect(html).toContain('<span class="govuk-visually-hidden">Success:</span> Complete')
      expect(html).toContain('Your reference number is HDJ2123F')
    })

    it('renders with custom classes', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        titleText: 'Application complete',
        text: 'Your reference number is HDJ2123F',
        classes: 'app-panel--large',
      })

      // Assert
      expect(html).toContain('govuk-panel')
      expect(html).toContain('app-panel--large')
    })

    it('renders with only title', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        titleText: 'Application complete',
      })

      // Assert
      expect(html).toContain('govuk-panel')
      expect(html).toContain('govuk-panel__title')
      expect(html).toContain('Application complete')
    })

    it('renders with custom heading level', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        titleText: 'Application complete',
        text: 'Your reference number is HDJ2123F',
        headingLevel: 2,
      })

      // Assert
      expect(html).toContain('govuk-panel')
      expect(html).toContain('<h2')
      expect(html).toContain('Application complete')
    })
  })
})
