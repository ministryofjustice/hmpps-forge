import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { StructureType } from '@form-engine/form/types/enums'
import { govukTabs } from './govukTabs'

jest.mock('nunjucks')

describe('GOV.UK Tabs Component', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukTabs)

  describe('Item data transformation', () => {
    it('sets single item with basic id, label, and panel text', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'tabs-default',
        items: [
          {
            id: 'past-day',
            label: 'Past day',
            panel: { text: 'Content for past day tab' },
          },
        ],
      })

      // Assert
      expect(params.items).toHaveLength(1)
      expect(params.items[0].id).toBe('past-day')
      expect(params.items[0].label).toBe('Past day')
      expect(params.items[0].panel.text).toBe('Content for past day tab')
      expect(params.items[0].panel.html).toBeUndefined()
    })

    it('sets multiple items correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'tabs-default',
        items: [
          {
            id: 'past-day',
            label: 'Past day',
            panel: { text: 'Day content' },
          },
          {
            id: 'past-week',
            label: 'Past week',
            panel: { text: 'Week content' },
          },
          {
            id: 'past-month',
            label: 'Past month',
            panel: { text: 'Month content' },
          },
        ],
      })

      // Assert
      expect(params.items).toHaveLength(3)
      expect(params.items[0].id).toBe('past-day')
      expect(params.items[0].label).toBe('Past day')
      expect(params.items[0].panel.text).toBe('Day content')
      expect(params.items[1].id).toBe('past-week')
      expect(params.items[1].label).toBe('Past week')
      expect(params.items[1].panel.text).toBe('Week content')
      expect(params.items[2].id).toBe('past-month')
      expect(params.items[2].label).toBe('Past month')
      expect(params.items[2].panel.text).toBe('Month content')
    })

    it('sets item with custom attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'tabs-default',
        items: [
          {
            id: 'tab-1',
            label: 'Tab 1',
            panel: { text: 'Content' },
            attributes: {
              'data-track': 'tab-clicked',
            },
          },
        ],
      })

      // Assert
      expect(params.items[0].attributes).toEqual({
        'data-track': 'tab-clicked',
      })
    })
  })

  describe('Panel content', () => {
    it('sets panel with text content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'tabs-default',
        items: [
          {
            id: 'tab-1',
            label: 'Tab 1',
            panel: { text: 'Plain text content in panel' },
          },
        ],
      })

      // Assert
      expect(params.items[0].panel.text).toBe('Plain text content in panel')
      expect(params.items[0].panel.html).toBeUndefined()
    })

    it('sets panel with html content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'tabs-default',
        items: [
          {
            id: 'tab-1',
            label: 'Tab 1',
            panel: { html: '<p class="govuk-body">HTML content in panel</p>' },
          },
        ],
      })

      // Assert
      expect(params.items[0].panel.html).toBe('<p class="govuk-body">HTML content in panel</p>')
      expect(params.items[0].panel.text).toBeUndefined()
    })

    it('uses html over text for panel content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'tabs-default',
        items: [
          {
            id: 'tab-1',
            label: 'Tab 1',
            panel: {
              text: 'This is ignored',
              html: '<p>HTML content takes precedence</p>',
            },
          },
        ],
      })

      // Assert
      expect(params.items[0].panel.html).toBe('<p>HTML content takes precedence</p>')
      expect(params.items[0].panel.text).toBeUndefined()
    })

    it('renders child blocks as HTML content in panel', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'tabs-default',
        items: [
          {
            id: 'tab-1',
            label: 'Tab with blocks',
            panel: {
              blocks: [
                {
                  block: { type: StructureType.BLOCK, variant: 'html' },
                  html: '<p>First block in panel</p>',
                },
                {
                  block: { type: StructureType.BLOCK, variant: 'govukInsetText' },
                  html: '<div class="govuk-inset-text">Important panel info</div>',
                },
              ],
            },
          },
        ],
      } as any)

      // Assert
      expect(params.items[0].panel.html).toBe(
        '<p>First block in panel</p><div class="govuk-inset-text">Important panel info</div>',
      )
      expect(params.items[0].panel.text).toBeUndefined()
    })

    it('child blocks take precedence over text and html in panel', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'tabs-default',
        items: [
          {
            id: 'tab-1',
            label: 'Tab 1',
            panel: {
              text: 'This is ignored',
              html: '<p>This is also ignored</p>',
              blocks: [
                {
                  block: { type: StructureType.BLOCK, variant: 'html' },
                  html: '<p>Child block content wins</p>',
                },
              ],
            },
          },
        ],
      } as any)

      // Assert
      expect(params.items[0].panel.html).toBe('<p>Child block content wins</p>')
      expect(params.items[0].panel.text).toBeUndefined()
    })

    it('handles empty blocks array in panel', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'tabs-default',
        items: [
          {
            id: 'tab-1',
            label: 'Tab 1',
            panel: {
              text: 'Fallback text',
              blocks: [],
            },
          },
        ],
      } as any)

      // Assert
      expect(params.items[0].panel.text).toBe('Fallback text')
      expect(params.items[0].panel.html).toBeUndefined()
    })

    it('sets panel with custom attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'tabs-default',
        items: [
          {
            id: 'tab-1',
            label: 'Tab 1',
            panel: {
              text: 'Content',
              attributes: {
                'data-module': 'custom-panel',
              },
            },
          },
        ],
      })

      // Assert
      expect(params.items[0].panel.attributes).toEqual({
        'data-module': 'custom-panel',
      })
    })
  })

  describe('Tabs options', () => {
    it('sets required id', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'tabs-unique-id',
        items: [
          {
            id: 'tab-1',
            label: 'Tab 1',
            panel: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.id).toBe('tabs-unique-id')
    })

    it('sets optional title for mobile table of contents', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'tabs-default',
        title: 'Navigation sections',
        items: [
          {
            id: 'tab-1',
            label: 'Tab 1',
            panel: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.title).toBe('Navigation sections')
    })

    it('handles tabs without title', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'tabs-default',
        items: [
          {
            id: 'tab-1',
            label: 'Tab 1',
            panel: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.title).toBeUndefined()
    })
  })

  describe('Optional attributes', () => {
    it('passes through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'tabs-default',
        classes: 'app-tabs--custom',
        items: [
          {
            id: 'tab-1',
            label: 'Tab 1',
            panel: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.classes).toBe('app-tabs--custom')
    })

    it('passes through attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'tabs-default',
        attributes: {
          'data-module': 'custom-tabs',
          'data-track': 'tabs-interaction',
        },
        items: [
          {
            id: 'tab-1',
            label: 'Tab 1',
            panel: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(params.attributes).toEqual({
        'data-module': 'custom-tabs',
        'data-track': 'tabs-interaction',
      })
    })

    it('handles all options together', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'tabs-all-options',
        title: 'All sections',
        classes: 'app-tabs',
        attributes: {
          'data-module': 'tabs',
        },
        items: [
          {
            id: 'tab-1',
            label: 'Tab 1',
            panel: { text: 'Content 1' },
            attributes: {
              'data-index': '0',
            },
          },
          {
            id: 'tab-2',
            label: 'Tab 2',
            panel: {
              html: '<p>Content 2</p>',
              attributes: {
                'data-panel': 'custom',
              },
            },
          },
        ],
      })

      // Assert
      expect(params.id).toBe('tabs-all-options')
      expect(params.title).toBe('All sections')
      expect(params.classes).toBe('app-tabs')
      expect(params.attributes).toEqual({
        'data-module': 'tabs',
      })
      expect(params.items).toHaveLength(2)
      expect(params.items[0].attributes).toEqual({
        'data-index': '0',
      })
      expect(params.items[1].panel.attributes).toEqual({
        'data-panel': 'custom',
      })
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        id: 'tabs-default',
        items: [
          {
            id: 'tab-1',
            label: 'Tab 1',
            panel: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(template).toBe('govuk/components/tabs/template.njk')
    })

    it('wraps params in correct context structure', async () => {
      // Arrange & Act
      const { context } = (await helper.executeComponent({
        id: 'tabs-default',
        title: 'Section navigation',
        items: [
          {
            id: 'past-day',
            label: 'Past day',
            panel: { text: 'Day content' },
          },
          {
            id: 'past-week',
            label: 'Past week',
            panel: { text: 'Week content' },
          },
        ],
      })) as { context: { params: any } }

      // Assert
      expect(context).toHaveProperty('params')
      expect(context.params.id).toBe('tabs-default')
      expect(context.params.title).toBe('Section navigation')
      expect(context.params.items).toHaveLength(2)
      expect(context.params.items[0].id).toBe('past-day')
      expect(context.params.items[0].label).toBe('Past day')
      expect(context.params.items[0].panel.text).toBe('Day content')
      expect(context.params.items[1].id).toBe('past-week')
      expect(context.params.items[1].label).toBe('Past week')
      expect(context.params.items[1].panel.text).toBe('Week content')
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders tabs with basic items', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        id: 'tabs-default',
        items: [
          {
            id: 'past-day',
            label: 'Past day',
            panel: { text: 'Content for past day' },
          },
          {
            id: 'past-week',
            label: 'Past week',
            panel: { text: 'Content for past week' },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-tabs')
      expect(html).toContain('id="tabs-default"')
      expect(html).toContain('Past day')
      expect(html).toContain('Content for past day')
      expect(html).toContain('Past week')
      expect(html).toContain('Content for past week')
    })

    it('renders tabs with custom title', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        id: 'tabs-with-title',
        title: 'Time periods',
        items: [
          {
            id: 'past-day',
            label: 'Past day',
            panel: { text: 'Day content' },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-tabs')
      expect(html).toContain('Time periods')
    })

    it('renders tabs with HTML content in panels', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        id: 'tabs-html',
        items: [
          {
            id: 'tab-1',
            label: 'First tab',
            panel: { html: '<p class="govuk-body">HTML content here</p>' },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-tabs')
      expect(html).toContain('First tab')
      expect(html).toContain('<p class="govuk-body">HTML content here</p>')
    })

    it('renders tabs with custom classes', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        id: 'tabs-custom',
        classes: 'app-tabs--custom',
        items: [
          {
            id: 'tab-1',
            label: 'Tab',
            panel: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-tabs')
      expect(html).toContain('app-tabs--custom')
    })

    it('renders tabs with custom attributes', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        id: 'tabs-attrs',
        attributes: {
          'data-module': 'custom-tabs',
        },
        items: [
          {
            id: 'tab-1',
            label: 'Tab',
            panel: { text: 'Content' },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-tabs')
      expect(html).toContain('data-module="custom-tabs"')
    })

    it('renders multiple tabs with different content types', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        id: 'tabs-mixed',
        items: [
          {
            id: 'text-tab',
            label: 'Plain text',
            panel: { text: 'Simple text content' },
          },
          {
            id: 'html-tab',
            label: 'HTML content',
            panel: { html: '<strong>Bold HTML content</strong>' },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-tabs')
      expect(html).toContain('Plain text')
      expect(html).toContain('Simple text content')
      expect(html).toContain('HTML content')
      expect(html).toContain('<strong>Bold HTML content</strong>')
    })
  })
})
