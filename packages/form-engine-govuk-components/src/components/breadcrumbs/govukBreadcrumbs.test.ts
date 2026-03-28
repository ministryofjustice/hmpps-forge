import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { govukBreadcrumbs } from './govukBreadcrumbs'

jest.mock('nunjucks')

describe('GOV.UK Breadcrumbs Component', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukBreadcrumbs)

  describe('Item data transformation', () => {
    it('sets single item correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ text: 'Home' }],
      })

      // Assert
      expect(params.items).toHaveLength(1)
      expect(params.items[0]).toEqual({ text: 'Home' })
    })

    it('sets multiple items correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          { text: 'Home', href: '/' },
          { text: 'Passports, travel and living abroad', href: '/browse/abroad' },
          { text: 'Travel abroad' },
        ],
      })

      // Assert
      expect(params.items).toHaveLength(3)
      expect(params.items[0]).toEqual({ text: 'Home', href: '/' })
      expect(params.items[1]).toEqual({ text: 'Passports, travel and living abroad', href: '/browse/abroad' })
      expect(params.items[2]).toEqual({ text: 'Travel abroad' })
    })

    it('sets item with href', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ text: 'Home', href: '/' }],
      })

      // Assert
      expect(params.items[0]).toEqual({ text: 'Home', href: '/' })
    })

    it('sets item without href for current page', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ text: 'Home', href: '/' }, { text: 'Current Page' }],
      })

      // Assert
      expect(params.items[1]).toEqual({ text: 'Current Page' })
      expect(params.items[1].href).toBeUndefined()
    })
  })

  describe('Item content', () => {
    it('sets text content correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ text: 'Plain text breadcrumb' }],
      })

      // Assert
      expect(params.items[0].text).toBe('Plain text breadcrumb')
      expect(params.items[0].html).toBeUndefined()
    })

    it('uses html content when provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ html: '<strong>Home</strong>' }],
      })

      // Assert
      expect(params.items[0].html).toBe('<strong>Home</strong>')
    })

    it('uses html over text when both provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ text: 'This is ignored', html: '<strong>This is used</strong>' }],
      })

      // Assert
      expect(params.items[0].html).toBe('<strong>This is used</strong>')
      expect(params.items[0].text).toBe('This is ignored')
    })

    it('sets item attributes correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            text: 'Home',
            href: '/',
            attributes: {
              'data-tracking': 'breadcrumb-home',
            },
          },
        ],
      })

      // Assert
      expect(params.items[0].attributes).toEqual({
        'data-tracking': 'breadcrumb-home',
      })
    })

    it('handles multiple items with different content types', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ text: 'Home', href: '/' }, { html: '<em>Documents</em>', href: '/documents' }, { text: 'Current' }],
      })

      // Assert
      expect(params.items[0]).toEqual({ text: 'Home', href: '/' })
      expect(params.items[1]).toEqual({ html: '<em>Documents</em>', href: '/documents' })
      expect(params.items[2]).toEqual({ text: 'Current' })
    })
  })

  describe('Breadcrumbs options', () => {
    it('sets collapseOnMobile when true', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ text: 'Home', href: '/' }, { text: 'Section', href: '/section' }, { text: 'Page' }],
        collapseOnMobile: true,
      })

      // Assert
      expect(params.collapseOnMobile).toBe(true)
    })

    it('does not set collapseOnMobile when false', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ text: 'Home', href: '/' }, { text: 'Page' }],
        collapseOnMobile: false,
      })

      // Assert
      expect(params.collapseOnMobile).toBe(false)
    })

    it('does not set collapseOnMobile when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ text: 'Home', href: '/' }, { text: 'Page' }],
      })

      // Assert
      expect(params.collapseOnMobile).toBeUndefined()
    })

    it('sets labelText for accessibility', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ text: 'Home', href: '/' }],
        labelText: 'Custom breadcrumb navigation',
      })

      // Assert
      expect(params.labelText).toBe('Custom breadcrumb navigation')
    })

    it('does not set labelText when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ text: 'Home', href: '/' }],
      })

      // Assert
      expect(params.labelText).toBeUndefined()
    })
  })

  describe('Optional attributes', () => {
    it('passes through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ text: 'Home' }],
        classes: 'app-breadcrumbs--custom',
      })

      // Assert
      expect(params.classes).toBe('app-breadcrumbs--custom')
    })

    it('passes through attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ text: 'Home' }],
        attributes: {
          'data-module': 'custom-breadcrumbs',
          'data-track': 'breadcrumb-navigation',
        },
      })

      // Assert
      expect(params.attributes).toEqual({
        'data-module': 'custom-breadcrumbs',
        'data-track': 'breadcrumb-navigation',
      })
    })

    it('handles all options together', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          { text: 'Home', href: '/' },
          { html: '<strong>Section</strong>', href: '/section' },
          { text: 'Current Page' },
        ],
        collapseOnMobile: true,
        labelText: 'Site navigation',
        classes: 'app-breadcrumbs--large',
        attributes: {
          'data-module': 'app-breadcrumbs',
        },
      })

      // Assert
      expect(params.items).toHaveLength(3)
      expect(params.collapseOnMobile).toBe(true)
      expect(params.labelText).toBe('Site navigation')
      expect(params.classes).toBe('app-breadcrumbs--large')
      expect(params.attributes).toEqual({
        'data-module': 'app-breadcrumbs',
      })
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        items: [{ text: 'Home', href: '/' }],
      })

      // Assert
      expect(template).toBe('govuk/components/breadcrumbs/template.njk')
    })

    it('wraps params in correct context structure', async () => {
      // Arrange & Act
      const { context } = (await helper.executeComponent({
        items: [{ text: 'Home', href: '/' }, { text: 'Current' }],
        labelText: 'Navigation',
      })) as { context: { params: any } }

      // Assert
      expect(context).toHaveProperty('params')
      expect(context.params.items).toHaveLength(2)
      expect(context.params.labelText).toBe('Navigation')
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders breadcrumbs with multiple items', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        items: [
          { text: 'Home', href: '/' },
          { text: 'Passports, travel and living abroad', href: '/browse/abroad' },
          { text: 'Travel abroad' },
        ],
      })

      // Assert
      expect(html).toContain('govuk-breadcrumbs')
      expect(html).toContain('Home')
      expect(html).toContain('Passports, travel and living abroad')
      expect(html).toContain('Travel abroad')
      expect(html).toContain('/')
      expect(html).toContain('/browse/abroad')
    })

    it('renders breadcrumbs with collapseOnMobile', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        items: [
          { text: 'Home', href: '/' },
          { text: 'Section', href: '/section' },
          { text: 'Subsection', href: '/subsection' },
          { text: 'Current' },
        ],
        collapseOnMobile: true,
      })

      // Assert
      expect(html).toContain('govuk-breadcrumbs')
      expect(html).toContain('govuk-breadcrumbs--collapse-on-mobile')
    })

    it('renders breadcrumbs with custom label text', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        items: [{ text: 'Home', href: '/' }, { text: 'Current' }],
        labelText: 'Site navigation breadcrumb',
      })

      // Assert
      expect(html).toContain('govuk-breadcrumbs')
      expect(html).toContain('Site navigation breadcrumb')
    })

    it('renders breadcrumbs with HTML content', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        items: [{ html: '<strong>Home</strong>', href: '/' }, { text: 'Current Page' }],
      })

      // Assert
      expect(html).toContain('govuk-breadcrumbs')
      expect(html).toContain('<strong>Home</strong>')
      expect(html).toContain('Current Page')
    })

    it('renders breadcrumbs with custom classes', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        items: [{ text: 'Home', href: '/' }],
        classes: 'app-breadcrumbs--custom',
      })

      // Assert
      expect(html).toContain('govuk-breadcrumbs')
      expect(html).toContain('app-breadcrumbs--custom')
    })
  })
})
