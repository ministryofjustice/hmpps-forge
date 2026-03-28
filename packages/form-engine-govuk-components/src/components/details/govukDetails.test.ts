import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { StructureType } from '@form-engine/form/types/enums'
import { govukDetails } from './govukDetails'

jest.mock('nunjucks')

describe('GOV.UK Details Component', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukDetails)

  describe('Data transformation', () => {
    it('sets basic values correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        summaryText: 'Help with nationality',
        text: 'We need to know your nationality so we can process your application.',
      })

      // Assert
      expect(params.summaryText).toBe('Help with nationality')
      expect(params.text).toBe('We need to know your nationality so we can process your application.')
      expect(params.summaryHtml).toBeUndefined()
      expect(params.html).toBeUndefined()
    })

    it('uses summaryHtml over summaryText', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        summaryText: 'This is ignored',
        summaryHtml: '<strong>Help</strong> with nationality',
        text: 'Content here',
      })

      // Assert
      expect(params.summaryText).toBeUndefined()
      expect(params.summaryHtml).toBe('<strong>Help</strong> with nationality')
    })

    it('uses html over text for content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        summaryText: 'View details',
        text: 'This is ignored',
        html: '<p class="govuk-body">HTML content here</p>',
      })

      // Assert
      expect(params.text).toBeUndefined()
      expect(params.html).toBe('<p class="govuk-body">HTML content here</p>')
    })

    it('passes through optional attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        summaryText: 'More information',
        text: 'Content',
        id: 'details-1',
        open: true,
        classes: 'app-details',
        attributes: {
          'data-module': 'custom-details',
        },
      })

      // Assert
      expect(params.id).toBe('details-1')
      expect(params.open).toBe(true)
      expect(params.classes).toBe('app-details')
      expect(params.attributes).toEqual({
        'data-module': 'custom-details',
      })
    })
  })

  describe('Child blocks content', () => {
    it('renders child blocks as HTML content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        summaryText: 'View example',
        content: [
          {
            block: { type: StructureType.BLOCK, variant: 'html' },
            html: '<p>First block</p>',
          },
          {
            block: { type: StructureType.BLOCK, variant: 'govukCodeBlock' },
            html: '<pre><code>const x = 1;</code></pre>',
          },
        ],
      } as any)

      // Assert
      expect(params.html).toBe('<p>First block</p><pre><code>const x = 1;</code></pre>')
      expect(params.text).toBeUndefined()
    })

    it('child blocks take precedence over text/html', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        summaryText: 'View example',
        text: 'This is ignored',
        html: '<p>This is also ignored</p>',
        content: [
          {
            block: { type: StructureType.BLOCK, variant: 'html' },
            html: '<p>Child block content</p>',
          },
        ],
      } as any)

      // Assert
      expect(params.html).toBe('<p>Child block content</p>')
      expect(params.text).toBeUndefined()
    })

    it('handles empty content array', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        summaryText: 'View details',
        text: 'Fallback text',
        content: [],
      } as any)

      // Assert
      expect(params.text).toBe('Fallback text')
      expect(params.html).toBeUndefined()
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        summaryText: 'Test',
        text: 'Content',
      })

      // Assert
      expect(template).toBe('govuk/components/details/template.njk')
    })

    it('wraps params in correct context structure', async () => {
      // Arrange & Act
      const { context } = (await helper.executeComponent({
        summaryText: 'Help text',
        text: 'Detailed content',
        open: true,
      })) as { context: { params: any } }

      // Assert
      expect(context).toHaveProperty('params')
      expect(context.params).toHaveProperty('summaryText', 'Help text')
      expect(context.params).toHaveProperty('text', 'Detailed content')
      expect(context.params).toHaveProperty('open', true)
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders a valid details component with text', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        summaryText: 'Help with nationality',
        text: 'We need to know your nationality.',
        id: 'nationality-details',
      })

      // Assert
      expect(html).toContain('govuk-details')
      expect(html).toContain('Help with nationality')
      expect(html).toContain('We need to know your nationality.')
      expect(html).toContain('id="nationality-details"')
    })

    it('renders a details component with open state', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        summaryText: 'View details',
        text: 'Expanded content',
        open: true,
      })

      // Assert
      expect(html).toContain('govuk-details')
      expect(html).toContain('open')
    })

    it('renders a details component with HTML content', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        summaryText: 'View code example',
        html: '<pre><code>const x = 1;</code></pre>',
      })

      // Assert
      expect(html).toContain('govuk-details')
      expect(html).toContain('View code example')
      expect(html).toContain('<pre><code>const x = 1;</code></pre>')
    })
  })
})
