import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { govukBackLink } from './govukBackLink'

jest.mock('nunjucks')

describe('GOV.UK Back Link Component', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukBackLink)

  describe('Data transformation', () => {
    it('sets href correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        href: '/previous-page',
      })

      // Assert
      expect(params.href).toBe('/previous-page')
    })

    it('uses default text "Back" when neither text nor html provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        href: '/previous-page',
      })

      // Assert
      expect(params.href).toBe('/previous-page')
      expect(params.text).toBeUndefined()
      expect(params.html).toBeUndefined()
    })

    it('sets custom text content correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        href: '/dashboard',
        text: 'Return to dashboard',
      })

      // Assert
      expect(params.href).toBe('/dashboard')
      expect(params.text).toBe('Return to dashboard')
      expect(params.html).toBeUndefined()
    })

    it('uses html over text when both provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        href: '/previous-page',
        text: 'This is ignored',
        html: '<span class="custom-back">Go back</span>',
      })

      // Assert
      expect(params.text).toBeUndefined()
      expect(params.html).toBe('<span class="custom-back">Go back</span>')
    })

    it('passes through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        href: '/previous-page',
        classes: 'app-back-link--custom',
      })

      // Assert
      expect(params.classes).toBe('app-back-link--custom')
    })

    it('passes through attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        href: '/previous-page',
        attributes: {
          'data-module': 'custom-back-link',
          'data-track': 'back-link-clicked',
        },
      })

      // Assert
      expect(params.attributes).toEqual({
        'data-module': 'custom-back-link',
        'data-track': 'back-link-clicked',
      })
    })

    it('handles all options together', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        href: '/dashboard',
        html: '<span class="icon">←</span> Back to dashboard',
        classes: 'app-back-link--with-icon',
        attributes: {
          'data-navigation': 'breadcrumb',
        },
      })

      // Assert
      expect(params.href).toBe('/dashboard')
      expect(params.text).toBeUndefined()
      expect(params.html).toBe('<span class="icon">←</span> Back to dashboard')
      expect(params.classes).toBe('app-back-link--with-icon')
      expect(params.attributes).toEqual({
        'data-navigation': 'breadcrumb',
      })
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        href: '/previous-page',
      })

      // Assert
      expect(template).toBe('govuk/components/back-link/template.njk')
    })

    it('wraps params in correct context structure', async () => {
      // Arrange & Act
      const { context } = (await helper.executeComponent({
        href: '/dashboard',
        text: 'Return to dashboard',
      })) as { context: { params: any } }

      // Assert
      expect(context).toHaveProperty('params')
      expect(context.params).toHaveProperty('href', '/dashboard')
      expect(context.params).toHaveProperty('text', 'Return to dashboard')
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders a valid back link component with default text', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        href: '/previous-page',
      })

      // Assert
      expect(html).toContain('govuk-back-link')
      expect(html).toContain('href="/previous-page"')
      expect(html).toContain('Back')
    })

    it('renders with custom text', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        href: '/dashboard',
        text: 'Return to dashboard',
      })

      // Assert
      expect(html).toContain('govuk-back-link')
      expect(html).toContain('href="/dashboard"')
      expect(html).toContain('Return to dashboard')
    })

    it('renders with HTML content', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        href: '/previous-page',
        html: '<span class="custom-back">Go back</span>',
      })

      // Assert
      expect(html).toContain('govuk-back-link')
      expect(html).toContain('<span class="custom-back">Go back</span>')
    })

    it('renders with custom classes', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        href: '/previous-page',
        classes: 'app-back-link--large',
      })

      // Assert
      expect(html).toContain('govuk-back-link')
      expect(html).toContain('app-back-link--large')
    })
  })
})
