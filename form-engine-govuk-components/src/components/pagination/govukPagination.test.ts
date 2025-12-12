import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { govukPagination } from './govukPagination'

jest.mock('nunjucks')

describe('GOV.UK Pagination Component', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukPagination)

  describe('Previous/Next navigation', () => {
    it('sets previous link correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        previous: {
          href: '/previous-page',
        },
      })

      // Assert
      expect(params.previous).toEqual({
        href: '/previous-page',
      })
    })

    it('sets next link correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        next: {
          href: '/next-page',
        },
      })

      // Assert
      expect(params.next).toEqual({
        href: '/next-page',
      })
    })

    it('sets previous link with labelText', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        previous: {
          href: '/introduction',
          labelText: 'Introduction',
        },
      })

      // Assert
      expect(params.previous).toEqual({
        href: '/introduction',
        labelText: 'Introduction',
      })
    })

    it('sets next link with labelText', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        next: {
          href: '/getting-started',
          labelText: 'Getting Started',
        },
      })

      // Assert
      expect(params.next).toEqual({
        href: '/getting-started',
        labelText: 'Getting Started',
      })
    })

    it('sets both previous and next links', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        previous: {
          href: '/page-1',
          labelText: 'Page One',
        },
        next: {
          href: '/page-3',
          labelText: 'Page Three',
        },
      })

      // Assert
      expect(params.previous).toEqual({
        href: '/page-1',
        labelText: 'Page One',
      })
      expect(params.next).toEqual({
        href: '/page-3',
        labelText: 'Page Three',
      })
    })

    it('sets custom text for links', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        previous: {
          href: '/back',
          text: 'Go back',
        },
        next: {
          href: '/forward',
          text: 'Continue',
        },
      })

      // Assert
      expect(params.previous?.text).toBe('Go back')
      expect(params.next?.text).toBe('Continue')
    })
  })

  describe('Numbered pagination', () => {
    it('sets pagination items correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          { number: '1', href: '/page/1' },
          { number: '2', href: '/page/2', current: true },
          { number: '3', href: '/page/3' },
        ],
      })

      // Assert
      expect(params.items).toHaveLength(3)
      expect(params.items[0]).toEqual({ number: '1', href: '/page/1' })
      expect(params.items[1]).toEqual({ number: '2', href: '/page/2', current: true })
      expect(params.items[2]).toEqual({ number: '3', href: '/page/3' })
    })

    it('handles ellipsis items', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ number: '1', href: '/page/1' }, { ellipsis: true }, { number: '10', href: '/page/10' }],
      })

      // Assert
      expect(params.items).toHaveLength(3)
      expect(params.items[1]).toEqual({ ellipsis: true })
    })
  })

  describe('Optional attributes', () => {
    it('passes through landmarkLabel', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        next: { href: '/next' },
        landmarkLabel: 'Results pagination',
      })

      // Assert
      expect(params.landmarkLabel).toBe('Results pagination')
    })

    it('passes through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        next: { href: '/next' },
        classes: 'app-pagination--custom',
      })

      // Assert
      expect(params.classes).toBe('app-pagination--custom')
    })

    it('passes through attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        next: { href: '/next' },
        attributes: {
          'data-module': 'custom-pagination',
        },
      })

      // Assert
      expect(params.attributes).toEqual({
        'data-module': 'custom-pagination',
      })
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        next: { href: '/next-page' },
      })

      // Assert
      expect(template).toBe('govuk/components/pagination/template.njk')
    })

    it('wraps params in correct context structure', async () => {
      // Arrange & Act
      const { context } = (await helper.executeComponent({
        previous: { href: '/prev', labelText: 'Previous Section' },
        next: { href: '/next', labelText: 'Next Section' },
      })) as { context: { params: any } }

      // Assert
      expect(context).toHaveProperty('params')
      expect(context.params.previous).toEqual({ href: '/prev', labelText: 'Previous Section' })
      expect(context.params.next).toEqual({ href: '/next', labelText: 'Next Section' })
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders pagination with previous and next links', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        previous: {
          href: '/introduction',
          labelText: 'Introduction',
        },
        next: {
          href: '/getting-started',
          labelText: 'Getting Started',
        },
      })

      // Assert
      expect(html).toContain('govuk-pagination')
      expect(html).toContain('/introduction')
      expect(html).toContain('Introduction')
      expect(html).toContain('/getting-started')
      expect(html).toContain('Getting Started')
    })

    it('renders pagination with only next link', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        next: {
          href: '/next-page',
          labelText: 'Next Page Title',
        },
      })

      // Assert
      expect(html).toContain('govuk-pagination')
      expect(html).toContain('/next-page')
      expect(html).toContain('Next Page Title')
    })

    it('renders pagination with only previous link', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        previous: {
          href: '/prev-page',
          labelText: 'Previous Page Title',
        },
      })

      // Assert
      expect(html).toContain('govuk-pagination')
      expect(html).toContain('/prev-page')
      expect(html).toContain('Previous Page Title')
    })

    it('renders numbered pagination', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        items: [
          { number: '1', href: '/page/1' },
          { number: '2', href: '/page/2', current: true },
          { number: '3', href: '/page/3' },
        ],
      })

      // Assert
      expect(html).toContain('govuk-pagination')
      expect(html).toContain('/page/1')
      expect(html).toContain('/page/2')
      expect(html).toContain('/page/3')
    })
  })
})
