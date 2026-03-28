import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { govukWarningText } from './govukWarningText'

jest.mock('nunjucks')

describe('GOV.UK Warning Text Component', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukWarningText)

  describe('Data transformation', () => {
    it('sets text content correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'You can be fined up to £5,000 if you do not register.',
      })

      // Assert
      expect(params.text).toBe('You can be fined up to £5,000 if you do not register.')
      expect(params.html).toBeUndefined()
    })

    it('uses html over text when both provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'This is ignored',
        html: '<strong>You must</strong> complete this section.',
      })

      // Assert
      expect(params.text).toBeUndefined()
      expect(params.html).toBe('<strong>You must</strong> complete this section.')
    })

    it('passes through iconFallbackText', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'This action cannot be undone.',
        iconFallbackText: 'Important',
      })

      // Assert
      expect(params.text).toBe('This action cannot be undone.')
      expect(params.iconFallbackText).toBe('Important')
    })

    it('passes through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Warning message',
        classes: 'app-warning-text--custom',
      })

      // Assert
      expect(params.classes).toBe('app-warning-text--custom')
    })

    it('passes through attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Warning message',
        attributes: {
          'data-module': 'custom-warning',
          'data-track': 'warning-shown',
        },
      })

      // Assert
      expect(params.attributes).toEqual({
        'data-module': 'custom-warning',
        'data-track': 'warning-shown',
      })
    })

    it('handles all options together', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        html: '<strong>Critical:</strong> This cannot be reversed.',
        iconFallbackText: 'Critical warning',
        classes: 'app-warning-text--critical',
        attributes: {
          'data-severity': 'critical',
        },
      })

      // Assert
      expect(params.text).toBeUndefined()
      expect(params.html).toBe('<strong>Critical:</strong> This cannot be reversed.')
      expect(params.iconFallbackText).toBe('Critical warning')
      expect(params.classes).toBe('app-warning-text--critical')
      expect(params.attributes).toEqual({
        'data-severity': 'critical',
      })
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        text: 'Test warning',
      })

      // Assert
      expect(template).toBe('govuk/components/warning-text/template.njk')
    })

    it('wraps params in correct context structure', async () => {
      // Arrange & Act
      const { context } = (await helper.executeComponent({
        text: 'You must complete this form.',
        iconFallbackText: 'Warning',
      })) as { context: { params: any } }

      // Assert
      expect(context).toHaveProperty('params')
      expect(context.params).toHaveProperty('text', 'You must complete this form.')
      expect(context.params).toHaveProperty('iconFallbackText', 'Warning')
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders a valid warning text component with text', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        text: 'You can be fined up to £5,000 if you do not register.',
      })

      // Assert
      expect(html).toContain('govuk-warning-text')
      expect(html).toContain('You can be fined up to £5,000 if you do not register.')
    })

    it('renders with custom icon fallback text', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        text: 'This action cannot be undone.',
        iconFallbackText: 'Important',
      })

      // Assert
      expect(html).toContain('govuk-warning-text')
      expect(html).toContain('Important')
      expect(html).toContain('This action cannot be undone.')
    })

    it('renders with HTML content', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        html: '<strong>You must</strong> complete this section before continuing.',
      })

      // Assert
      expect(html).toContain('govuk-warning-text')
      expect(html).toContain('<strong>You must</strong> complete this section before continuing.')
    })

    it('renders with custom classes', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        text: 'Warning message',
        classes: 'app-warning-text--large',
      })

      // Assert
      expect(html).toContain('govuk-warning-text')
      expect(html).toContain('app-warning-text--large')
    })
  })
})
