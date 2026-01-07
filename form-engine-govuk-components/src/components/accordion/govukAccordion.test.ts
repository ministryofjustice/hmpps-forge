import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { StructureType } from '@form-engine/form/types/enums'
import { govukAccordion } from './govukAccordion'

jest.mock('nunjucks')

describe('GOV.UK Accordion Component', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukAccordion)

  describe('Item data transformation', () => {
    it('sets single item with basic heading and content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        items: [
          {
            heading: { text: 'Writing well for the web' },
            content: { text: 'This is the content for the first section.' },
          },
        ],
      })

      // Assert
      expect(params.items).toHaveLength(1)
      expect(params.items[0].heading.text).toBe('Writing well for the web')
      expect(params.items[0].heading.html).toBeUndefined()
      expect(params.items[0].content.text).toBe('This is the content for the first section.')
      expect(params.items[0].content.html).toBeUndefined()
      expect(params.items[0].summary).toBeUndefined()
    })

    it('sets multiple items correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        items: [
          {
            heading: { text: 'Writing well for the web' },
            content: { text: 'Content 1' },
          },
          {
            heading: { text: 'Writing well for specialists' },
            content: { text: 'Content 2' },
          },
          {
            heading: { text: 'Know your audience' },
            content: { text: 'Content 3' },
          },
        ],
      })

      // Assert
      expect(params.items).toHaveLength(3)
      expect(params.items[0].heading.text).toBe('Writing well for the web')
      expect(params.items[0].content.text).toBe('Content 1')
      expect(params.items[1].heading.text).toBe('Writing well for specialists')
      expect(params.items[1].content.text).toBe('Content 2')
      expect(params.items[2].heading.text).toBe('Know your audience')
      expect(params.items[2].content.text).toBe('Content 3')
    })

    it('sets item with expanded state', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        items: [
          {
            heading: { text: 'Section 1' },
            content: { text: 'Content 1' },
            expanded: true,
          },
          {
            heading: { text: 'Section 2' },
            content: { text: 'Content 2' },
            expanded: false,
          },
        ],
      })

      // Assert
      expect(params.items[0].expanded).toBe(true)
      expect(params.items[1].expanded).toBe(false)
    })
  })

  describe('Heading options', () => {
    it('sets heading with text content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        items: [
          {
            heading: { text: 'Plain text heading' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.items[0].heading.text).toBe('Plain text heading')
      expect(params.items[0].heading.html).toBeUndefined()
    })

    it('sets heading with html content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        items: [
          {
            heading: { html: '<span>HTML</span> heading' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.items[0].heading.html).toBe('<span>HTML</span> heading')
      expect(params.items[0].heading.text).toBeUndefined()
    })

    it('uses html over text for heading', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        items: [
          {
            heading: { text: 'This is ignored', html: '<strong>HTML heading</strong>' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.items[0].heading.html).toBe('<strong>HTML heading</strong>')
      expect(params.items[0].heading.text).toBeUndefined()
    })
  })

  describe('Summary options', () => {
    it('sets summary with text content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        items: [
          {
            heading: { text: 'Section heading' },
            summary: { text: 'Summary text line' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.items[0].summary).toBeDefined()
      expect(params.items[0].summary?.text).toBe('Summary text line')
      expect(params.items[0].summary?.html).toBeUndefined()
    })

    it('sets summary with html content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        items: [
          {
            heading: { text: 'Section heading' },
            summary: { html: '<em>HTML summary</em>' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.items[0].summary?.html).toBe('<em>HTML summary</em>')
      expect(params.items[0].summary?.text).toBeUndefined()
    })

    it('uses html over text for summary', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        items: [
          {
            heading: { text: 'Section heading' },
            summary: { text: 'This is ignored', html: '<strong>HTML summary</strong>' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.items[0].summary?.html).toBe('<strong>HTML summary</strong>')
      expect(params.items[0].summary?.text).toBeUndefined()
    })

    it('handles item without summary', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        items: [
          {
            heading: { text: 'Section heading' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.items[0].summary).toBeUndefined()
    })
  })

  describe('Content options', () => {
    it('sets content with text', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        items: [
          {
            heading: { text: 'Heading' },
            content: { text: 'Plain text content' },
          },
        ],
      })

      // Assert
      expect(params.items[0].content.text).toBe('Plain text content')
      expect(params.items[0].content.html).toBeUndefined()
    })

    it('sets content with html', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        items: [
          {
            heading: { text: 'Heading' },
            content: { html: '<p>HTML content</p>' },
          },
        ],
      })

      // Assert
      expect(params.items[0].content.html).toBe('<p>HTML content</p>')
      expect(params.items[0].content.text).toBeUndefined()
    })

    it('uses html over text for content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        items: [
          {
            heading: { text: 'Heading' },
            content: { text: 'This is ignored', html: '<p>HTML content</p>' },
          },
        ],
      })

      // Assert
      expect(params.items[0].content.html).toBe('<p>HTML content</p>')
      expect(params.items[0].content.text).toBeUndefined()
    })

    it('renders child blocks as HTML content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        items: [
          {
            heading: { text: 'Section with blocks' },
            content: {
              blocks: [
                {
                  block: { type: StructureType.BLOCK, variant: 'html' },
                  html: '<p>First block</p>',
                },
                {
                  block: { type: StructureType.BLOCK, variant: 'govukInsetText' },
                  html: '<div class="govuk-inset-text">Important info</div>',
                },
              ],
            },
          },
        ],
      } as any)

      // Assert
      expect(params.items[0].content.html).toBe('<p>First block</p><div class="govuk-inset-text">Important info</div>')
      expect(params.items[0].content.text).toBeUndefined()
    })

    it('child blocks take precedence over text and html', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        items: [
          {
            heading: { text: 'Heading' },
            content: {
              text: 'This is ignored',
              html: '<p>This is also ignored</p>',
              blocks: [
                {
                  block: { type: StructureType.BLOCK, variant: 'html' },
                  html: '<p>Child block content</p>',
                },
              ],
            },
          },
        ],
      } as any)

      // Assert
      expect(params.items[0].content.html).toBe('<p>Child block content</p>')
      expect(params.items[0].content.text).toBeUndefined()
    })

    it('handles empty blocks array', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        items: [
          {
            heading: { text: 'Heading' },
            content: {
              text: 'Fallback text',
              blocks: [],
            },
          },
        ],
      } as any)

      // Assert
      expect(params.items[0].content.text).toBe('Fallback text')
      expect(params.items[0].content.html).toBeUndefined()
    })
  })

  describe('Accordion options', () => {
    it('sets required id', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-unique-id',
        items: [
          {
            heading: { text: 'Heading' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.id).toBe('accordion-unique-id')
    })

    it('sets headingLevel', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        headingLevel: 3,
        items: [
          {
            heading: { text: 'Heading' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.headingLevel).toBe(3)
    })

    it('sets rememberExpanded to true', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        rememberExpanded: true,
        items: [
          {
            heading: { text: 'Heading' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.rememberExpanded).toBe(true)
    })

    it('sets rememberExpanded to false', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        rememberExpanded: false,
        items: [
          {
            heading: { text: 'Heading' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.rememberExpanded).toBe(false)
    })

    it('sets custom hideAllSectionsText', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        hideAllSectionsText: 'Collapse all',
        items: [
          {
            heading: { text: 'Heading' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.hideAllSectionsText).toBe('Collapse all')
    })

    it('sets custom showAllSectionsText', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        showAllSectionsText: 'Expand all',
        items: [
          {
            heading: { text: 'Heading' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.showAllSectionsText).toBe('Expand all')
    })

    it('sets custom hideSectionText', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        hideSectionText: 'Collapse',
        items: [
          {
            heading: { text: 'Heading' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.hideSectionText).toBe('Collapse')
    })

    it('sets custom showSectionText', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        showSectionText: 'Expand',
        items: [
          {
            heading: { text: 'Heading' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.showSectionText).toBe('Expand')
    })

    it('sets custom hideSectionAriaLabelText', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        hideSectionAriaLabelText: 'Collapse this section',
        items: [
          {
            heading: { text: 'Heading' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.hideSectionAriaLabelText).toBe('Collapse this section')
    })

    it('sets custom showSectionAriaLabelText', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        showSectionAriaLabelText: 'Expand this section',
        items: [
          {
            heading: { text: 'Heading' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.showSectionAriaLabelText).toBe('Expand this section')
    })

    it('passes through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        classes: 'app-accordion--custom',
        items: [
          {
            heading: { text: 'Heading' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.classes).toBe('app-accordion--custom')
    })

    it('passes through attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-default',
        attributes: {
          'data-module': 'custom-accordion',
          'data-track': 'accordion-interaction',
        },
        items: [
          {
            heading: { text: 'Heading' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.attributes).toEqual({
        'data-module': 'custom-accordion',
        'data-track': 'accordion-interaction',
      })
    })

    it('handles all options together', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'accordion-all-options',
        headingLevel: 3,
        rememberExpanded: true,
        hideAllSectionsText: 'Collapse all',
        showAllSectionsText: 'Expand all',
        hideSectionText: 'Collapse',
        showSectionText: 'Expand',
        hideSectionAriaLabelText: 'Collapse this section',
        showSectionAriaLabelText: 'Expand this section',
        classes: 'app-accordion',
        attributes: {
          'data-module': 'accordion',
        },
        items: [
          {
            heading: { text: 'Heading' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.id).toBe('accordion-all-options')
      expect(params.headingLevel).toBe(3)
      expect(params.rememberExpanded).toBe(true)
      expect(params.hideAllSectionsText).toBe('Collapse all')
      expect(params.showAllSectionsText).toBe('Expand all')
      expect(params.hideSectionText).toBe('Collapse')
      expect(params.showSectionText).toBe('Expand')
      expect(params.hideSectionAriaLabelText).toBe('Collapse this section')
      expect(params.showSectionAriaLabelText).toBe('Expand this section')
      expect(params.classes).toBe('app-accordion')
      expect(params.attributes).toEqual({
        'data-module': 'accordion',
      })
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        id: 'accordion-default',
        items: [
          {
            heading: { text: 'Heading' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(template).toBe('govuk/components/accordion/template.njk')
    })

    it('wraps params in correct context structure', async () => {
      // Arrange & Act
      const { context } = (await helper.executeComponent({
        id: 'accordion-default',
        headingLevel: 3,
        items: [
          {
            heading: { text: 'Section heading' },
            content: { text: 'Section content' },
          },
        ],
      })) as { context: { params: any } }

      // Assert
      expect(context).toHaveProperty('params')
      expect(context.params.id).toBe('accordion-default')
      expect(context.params.headingLevel).toBe(3)
      expect(context.params.items).toHaveLength(1)
      expect(context.params.items[0].heading.text).toBe('Section heading')
      expect(context.params.items[0].content.text).toBe('Section content')
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders accordion with basic sections', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        id: 'accordion-default',
        items: [
          {
            heading: { text: 'Writing well for the web' },
            content: { text: 'This is the content for the first section.' },
          },
          {
            heading: { text: 'Writing well for specialists' },
            content: { text: 'This is the content for the second section.' },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-accordion')
      expect(html).toContain('id="accordion-default"')
      expect(html).toContain('Writing well for the web')
      expect(html).toContain('This is the content for the first section.')
      expect(html).toContain('Writing well for specialists')
      expect(html).toContain('This is the content for the second section.')
    })

    it('renders accordion with summary lines', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        id: 'accordion-with-summary',
        items: [
          {
            heading: { text: 'Understanding agile project management' },
            summary: { text: 'Guidance for digital teams' },
            content: { text: 'Agile project management content here.' },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-accordion')
      expect(html).toContain('Understanding agile project management')
      expect(html).toContain('Guidance for digital teams')
      expect(html).toContain('Agile project management content here.')
    })

    it('renders accordion with HTML content', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        id: 'accordion-html',
        items: [
          {
            heading: { html: '<strong>Important</strong> section' },
            content: { html: '<p class="govuk-body">HTML content here</p>' },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-accordion')
      expect(html).toContain('<strong>Important</strong> section')
      expect(html).toContain('<p class="govuk-body">HTML content here</p>')
    })

    it('renders accordion with expanded section', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        id: 'accordion-expanded',
        items: [
          {
            heading: { text: 'Expanded section' },
            content: { text: 'This section is open by default.' },
            expanded: true,
          },
          {
            heading: { text: 'Collapsed section' },
            content: { text: 'This section is closed by default.' },
            expanded: false,
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-accordion')
      expect(html).toContain('Expanded section')
      expect(html).toContain('Collapsed section')
    })

    it('renders accordion with custom heading level', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        id: 'accordion-heading-level',
        headingLevel: 3,
        items: [
          {
            heading: { text: 'Section heading' },
            content: { text: 'Section content' },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-accordion')
      expect(html).toContain('Section heading')
    })

    it('renders accordion with custom classes', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        id: 'accordion-custom',
        classes: 'app-accordion--custom',
        items: [
          {
            heading: { text: 'Section' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-accordion')
      expect(html).toContain('app-accordion--custom')
    })

    it('renders accordion with custom attributes', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        id: 'accordion-attrs',
        attributes: {
          'data-module': 'custom-accordion',
        },
        items: [
          {
            heading: { text: 'Section' },
            content: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-accordion')
      expect(html).toContain('data-module="custom-accordion"')
    })
  })
})
