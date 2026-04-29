import { MojComponentTestHelper } from '../../test-utils/MojComponentTestHelper'
import { setupComponentTest } from '../../test-utils/setupComponentTest'
import { mojSideNavigation } from './mojSideNavigation'

vi.mock('nunjucks')

describe('mojSideNavigation', () => {
  setupComponentTest()

  const helper = new MojComponentTestHelper(mojSideNavigation)

  describe('Label transformation', () => {
    it('should pass through label unchanged', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        label: 'Side navigation',
        items: [{ text: 'Item 1', href: '#1' }],
      })

      // Assert
      expect(params.label).toBe('Side navigation')
    })

    it('should leave label undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ text: 'Item 1', href: '#1' }],
      })

      // Assert
      expect(params.label).toBeUndefined()
    })
  })

  describe('Items transformation (simple mode)', () => {
    it('should pass through items array unchanged', async () => {
      // Arrange
      const items = [
        { text: 'Item 1', href: '#1', active: true },
        { text: 'Item 2', href: '#2' },
        { text: 'Item 3', href: '#3' },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items).toEqual(items)
    })

    it('should pass through item with HTML content', async () => {
      // Arrange
      const items = [{ html: '<strong>Bold Item</strong>', href: '#1' }]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items).toEqual(items)
    })

    it('should pass through item attributes', async () => {
      // Arrange
      const items = [
        {
          text: 'Item 1',
          href: '#1',
          attributes: { 'data-testid': 'nav-item-1' },
        },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items).toEqual(items)
    })

    it('should handle item active state', async () => {
      // Arrange
      const items = [
        { text: 'Active Item', href: '#1', active: true },
        { text: 'Inactive Item', href: '#2', active: false },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items?.[0].active).toBe(true)
      expect(params.items?.[1].active).toBe(false)
    })

    it('should omit items when visibleWhen evaluates to false', async () => {
      // Arrange
      const items = [
        { text: 'Overview', href: '#overview' },
        { text: 'Admin', href: '#admin', visibleWhen: false },
        { text: 'Timeline', href: '#timeline', visibleWhen: true },
      ]

      // Act
      const params = await helper.getParams({ items })

      // Assert
      expect(params.items.map((item: { text: string }) => item.text)).toEqual(['Overview', 'Timeline'])
    })
  })

  describe('Sections transformation (sectioned mode)', () => {
    it('should pass through sections array unchanged', async () => {
      // Arrange
      const sections = [
        {
          heading: { text: 'Section 1' },
          items: [
            { text: 'Item 1.1', href: '#1-1', active: true },
            { text: 'Item 1.2', href: '#1-2' },
          ],
        },
        {
          heading: { text: 'Section 2' },
          items: [{ text: 'Item 2.1', href: '#2-1' }],
        },
      ]

      // Act
      const params = await helper.getParams({ sections })

      // Assert
      expect(params.sections).toEqual(sections)
    })

    it('should pass through heading with custom level', async () => {
      // Arrange
      const sections = [
        {
          heading: { text: 'Section 1', headingLevel: 3 },
          items: [{ text: 'Item 1', href: '#1' }],
        },
      ]

      // Act
      const params = await helper.getParams({ sections })

      // Assert
      expect(params.sections?.[0].heading.headingLevel).toBe(3)
    })

    it('should pass through heading with HTML content', async () => {
      // Arrange
      const sections = [
        {
          heading: { html: '<span>Section</span> 1' },
          items: [{ text: 'Item 1', href: '#1' }],
        },
      ]

      // Act
      const params = await helper.getParams({ sections })

      // Assert
      expect(params.sections?.[0].heading.html).toBe('<span>Section</span> 1')
    })

    it('should pass through heading classes', async () => {
      // Arrange
      const sections = [
        {
          heading: { text: 'Section 1', classes: 'custom-heading-class' },
          items: [{ text: 'Item 1', href: '#1' }],
        },
      ]

      // Act
      const params = await helper.getParams({ sections })

      // Assert
      expect(params.sections?.[0].heading.classes).toBe('custom-heading-class')
    })

    it('should pass through heading attributes', async () => {
      // Arrange
      const sections = [
        {
          heading: {
            text: 'Section 1',
            attributes: { 'data-testid': 'section-heading' },
          },
          items: [{ text: 'Item 1', href: '#1' }],
        },
      ]

      // Act
      const params = await helper.getParams({ sections })

      // Assert
      expect(params.sections?.[0].heading.attributes).toEqual({
        'data-testid': 'section-heading',
      })
    })

    it('should omit sections and section items when visibleWhen evaluates to false', async () => {
      // Arrange
      const sections = [
        {
          heading: { text: 'Visible section' },
          items: [
            { text: 'Overview', href: '#overview' },
            { text: 'Admin', href: '#admin', visibleWhen: false },
          ],
        },
        {
          heading: { text: 'Hidden section' },
          items: [{ text: 'Hidden item', href: '#hidden' }],
          visibleWhen: false,
        },
      ]

      // Act
      const params = await helper.getParams({ sections })

      // Assert
      expect(params.sections).toHaveLength(1)
      expect(params.sections[0].heading.text).toBe('Visible section')
      expect(params.sections[0].items.map((item: { text: string }) => item.text)).toEqual(['Overview'])
    })
  })

  describe('Additional options', () => {
    it('should pass through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [{ text: 'Item 1', href: '#1' }],
        classes: 'custom-nav-class',
      })

      // Assert
      expect(params.classes).toBe('custom-nav-class')
    })

    it('should pass through attributes', async () => {
      // Arrange
      const attributes = {
        'data-testid': 'side-nav',
        'aria-describedby': 'nav-description',
      }

      // Act
      const params = await helper.getParams({
        items: [{ text: 'Item 1', href: '#1' }],
        attributes,
      })

      // Assert
      expect(params.attributes).toEqual(attributes)
    })
  })

  describe('Template and context', () => {
    it('should call nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        items: [{ text: 'Item 1', href: '#1' }],
      })

      // Assert
      expect(template).toBe('moj/components/side-navigation/template.njk')
    })

    it('should wrap params in context object', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        items: [{ text: 'Item 1', href: '#1' }],
      })

      // Assert
      expect(context).toHaveProperty('params')
      expect((context as { params: Record<string, any> }).params).toHaveProperty('items')
    })

    it('should include all params in context for simple mode', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        label: 'Navigation',
        items: [{ text: 'Item', href: '#' }],
        classes: 'custom-class',
        attributes: { 'data-test': 'value' },
      })

      // Assert
      const params = (context as { params: Record<string, any> }).params
      expect(params).toHaveProperty('label', 'Navigation')
      expect(params).toHaveProperty('items')
      expect(params).toHaveProperty('classes', 'custom-class')
      expect(params).toHaveProperty('attributes')
    })

    it('should include sections in params for sectioned mode', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        sections: [
          {
            heading: { text: 'Section' },
            items: [{ text: 'Item', href: '#' }],
          },
        ],
      })

      // Assert
      const params = (context as { params: Record<string, any> }).params
      expect(params).toHaveProperty('sections')
      expect(params.sections).toHaveLength(1)
    })
  })
})
