import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { govukInsetText } from './govukInsetText'

jest.mock('nunjucks')

describe('GOV.UK Inset Text Component', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukInsetText)

  describe('Data transformation', () => {
    it('sets text content correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'It can take up to 8 weeks to register a lasting power of attorney if there are no mistakes in the application.',
      })

      // Assert
      expect(params.text).toBe(
        'It can take up to 8 weeks to register a lasting power of attorney if there are no mistakes in the application.',
      )
      expect(params.html).toBeUndefined()
    })

    it('uses html over text when both provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'This is ignored',
        html: '<strong>Important:</strong> This is the content that will be shown.',
      })

      // Assert
      expect(params.text).toBeUndefined()
      expect(params.html).toBe('<strong>Important:</strong> This is the content that will be shown.')
    })

    it('passes through id', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Information text',
        id: 'important-notice',
      })

      // Assert
      expect(params.text).toBe('Information text')
      expect(params.id).toBe('important-notice')
    })

    it('passes through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Information text',
        classes: 'app-inset-text--custom',
      })

      // Assert
      expect(params.classes).toBe('app-inset-text--custom')
    })

    it('passes through attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Information text',
        attributes: {
          'data-module': 'custom-inset',
          'data-track': 'inset-shown',
        },
      })

      // Assert
      expect(params.attributes).toEqual({
        'data-module': 'custom-inset',
        'data-track': 'inset-shown',
      })
    })

    it('handles all options together', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        html: '<strong>Note:</strong> This information is important.',
        id: 'critical-info',
        classes: 'app-inset-text--highlighted',
        attributes: {
          'data-importance': 'high',
        },
      })

      // Assert
      expect(params.text).toBeUndefined()
      expect(params.html).toBe('<strong>Note:</strong> This information is important.')
      expect(params.id).toBe('critical-info')
      expect(params.classes).toBe('app-inset-text--highlighted')
      expect(params.attributes).toEqual({
        'data-importance': 'high',
      })
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        text: 'Test inset text',
      })

      // Assert
      expect(template).toBe('govuk/components/inset-text/template.njk')
    })

    it('wraps params in correct context structure', async () => {
      // Arrange & Act
      const { context } = (await helper.executeComponent({
        text: 'It can take up to 8 weeks to process your application.',
        id: 'processing-time',
      })) as { context: { params: any } }

      // Assert
      expect(context).toHaveProperty('params')
      expect(context.params).toHaveProperty('text', 'It can take up to 8 weeks to process your application.')
      expect(context.params).toHaveProperty('id', 'processing-time')
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders a valid inset text component with text', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        text: 'It can take up to 8 weeks to register a lasting power of attorney if there are no mistakes in the application.',
      })

      // Assert
      expect(html).toContain('govuk-inset-text')
      expect(html).toContain(
        'It can take up to 8 weeks to register a lasting power of attorney if there are no mistakes in the application.',
      )
    })

    it('renders with HTML content', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        html: '<strong>Important:</strong> You must complete this section before continuing.',
      })

      // Assert
      expect(html).toContain('govuk-inset-text')
      expect(html).toContain('<strong>Important:</strong> You must complete this section before continuing.')
    })

    it('renders with custom id', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        text: 'Information text',
        id: 'important-notice',
      })

      // Assert
      expect(html).toContain('govuk-inset-text')
      expect(html).toContain('id="important-notice"')
    })

    it('renders with custom classes', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        text: 'Information text',
        classes: 'app-inset-text--large',
      })

      // Assert
      expect(html).toContain('govuk-inset-text')
      expect(html).toContain('app-inset-text--large')
    })
  })
})
