import { MojComponentTestHelper } from '@form-engine-moj-components/test-utils/MojComponentTestHelper'
import { setupComponentTest } from '@form-engine-moj-components/test-utils/setupComponentTest'
import { mojMultiSelect } from './mojMultiSelect'

jest.mock('nunjucks')

describe('mojMultiSelect', () => {
  setupComponentTest()

  const helper = new MojComponentTestHelper(mojMultiSelect)

  describe('Data transformation', () => {
    it('should pass through rows', async () => {
      // Arrange
      const rows = [
        [{ html: '<input type="checkbox" name="selected" value="1">' }, { text: 'John Smith' }, { text: 'Active' }],
        [{ html: '<input type="checkbox" name="selected" value="2">' }, { text: 'Jane Doe' }, { text: 'Inactive' }],
      ]

      // Act
      const params = await helper.getParams({ rows })

      // Assert
      expect(params.rows).toEqual(rows)
    })

    it('should pass through head', async () => {
      // Arrange
      const head = [{ html: '<input type="checkbox" id="select-all">' }, { text: 'Name' }, { text: 'Status' }]
      const rows = [[{ text: 'data' }]]

      // Act
      const params = await helper.getParams({ rows, head })

      // Assert
      expect(params.head).toEqual(head)
    })

    it('should pass through caption', async () => {
      // Arrange
      const rows = [[{ text: 'data' }]]

      // Act
      const params = await helper.getParams({
        rows,
        caption: 'User selection table',
      })

      // Assert
      expect(params.caption).toBe('User selection table')
    })

    it('should pass through captionClasses', async () => {
      // Arrange
      const rows = [[{ text: 'data' }]]

      // Act
      const params = await helper.getParams({
        rows,
        caption: 'Table caption',
        captionClasses: 'govuk-table__caption--m',
      })

      // Assert
      expect(params.captionClasses).toBe('govuk-table__caption--m')
    })

    it('should pass through firstCellIsHeader', async () => {
      // Arrange
      const rows = [[{ text: 'data' }]]

      // Act
      const params = await helper.getParams({
        rows,
        firstCellIsHeader: true,
      })

      // Assert
      expect(params.firstCellIsHeader).toBe(true)
    })

    it('should leave optional properties undefined when not provided', async () => {
      // Arrange
      const rows = [[{ text: 'data' }]]

      // Act
      const params = await helper.getParams({ rows })

      // Assert
      expect(params.head).toBeUndefined()
      expect(params.caption).toBeUndefined()
      expect(params.captionClasses).toBeUndefined()
      expect(params.firstCellIsHeader).toBeUndefined()
    })
  })

  describe('Data module attribute', () => {
    it('should add data-module attribute with value moj-multi-select', async () => {
      // Arrange
      const rows = [[{ text: 'data' }]]

      // Act
      const params = await helper.getParams({ rows })

      // Assert
      expect(params.attributes).toHaveProperty('data-module', 'moj-multi-select')
    })

    it('should merge user-provided attributes with data-module', async () => {
      // Arrange
      const rows = [[{ text: 'data' }]]
      const attributes = {
        'data-testid': 'my-multi-select',
        'data-tracking': 'selection-table',
      }

      // Act
      const params = await helper.getParams({ rows, attributes })

      // Assert
      expect(params.attributes).toEqual({
        'data-testid': 'my-multi-select',
        'data-tracking': 'selection-table',
        'data-module': 'moj-multi-select',
      })
    })

    it('should override user-provided data-module with moj-multi-select', async () => {
      // Arrange
      const rows = [[{ text: 'data' }]]
      const attributes = {
        'data-module': 'custom-module',
        'data-other': 'value',
      }

      // Act
      const params = await helper.getParams({ rows, attributes })

      // Assert
      expect(params.attributes).toEqual({
        'data-module': 'moj-multi-select',
        'data-other': 'value',
      })
    })

    it('should add data-module when no attributes provided', async () => {
      // Arrange
      const rows = [[{ text: 'data' }]]

      // Act
      const params = await helper.getParams({ rows })

      // Assert
      expect(params.attributes).toEqual({
        'data-module': 'moj-multi-select',
      })
    })
  })

  describe('Optional attributes', () => {
    it('should pass through classes', async () => {
      // Arrange
      const rows = [[{ text: 'data' }]]

      // Act
      const params = await helper.getParams({
        rows,
        classes: 'custom-table-class',
      })

      // Assert
      expect(params.classes).toBe('custom-table-class')
    })

    it('should pass through multiple custom attributes', async () => {
      // Arrange
      const rows = [[{ text: 'data' }]]
      const attributes = {
        'data-testid': 'my-table',
        'data-custom': 'value',
        'aria-label': 'Selection table',
      }

      // Act
      const params = await helper.getParams({ rows, attributes })

      // Assert
      expect(params.attributes).toMatchObject(attributes)
    })
  })

  describe('Template and context', () => {
    it('should call nunjucks with GOV.UK table template path', async () => {
      // Arrange
      const rows = [[{ text: 'data' }]]

      // Act
      const { template } = await helper.executeComponent({ rows })

      // Assert
      expect(template).toBe('govuk/components/table/template.njk')
    })

    it('should wrap params in context object', async () => {
      // Arrange
      const rows = [[{ text: 'data' }]]

      // Act
      const { context } = await helper.executeComponent({ rows })

      // Assert
      expect(context).toHaveProperty('params')
      expect((context as { params: Record<string, any> }).params).toHaveProperty('rows')
    })

    it('should include all params in context', async () => {
      // Arrange
      const rows = [[{ html: '<input type="checkbox" name="selected" value="1">' }, { text: 'John Smith' }]]
      const head = [{ html: '<input type="checkbox" id="select-all">' }, { text: 'Name' }]

      // Act
      const { context } = await helper.executeComponent({
        rows,
        head,
        caption: 'Users',
        captionClasses: 'govuk-table__caption--l',
        firstCellIsHeader: false,
        classes: 'custom-class',
        attributes: { 'data-test': 'value' },
      })

      // Assert
      const params = (context as { params: Record<string, any> }).params
      expect(params).toHaveProperty('rows', rows)
      expect(params).toHaveProperty('head', head)
      expect(params).toHaveProperty('caption', 'Users')
      expect(params).toHaveProperty('captionClasses', 'govuk-table__caption--l')
      expect(params).toHaveProperty('firstCellIsHeader', false)
      expect(params).toHaveProperty('classes', 'custom-class')
      expect(params).toHaveProperty('attributes')
      expect(params.attributes).toHaveProperty('data-module', 'moj-multi-select')
    })
  })

  describe('Complex cell configurations', () => {
    it('should handle cells with colspan and rowspan', async () => {
      // Arrange
      const rows = [
        [
          { text: 'Cell 1', colspan: 2 },
          { text: 'Cell 2', rowspan: 2 },
        ],
      ]

      // Act
      const params = await helper.getParams({ rows })

      // Assert
      expect(params.rows).toEqual(rows)
      expect(params.rows[0][0]).toHaveProperty('colspan', 2)
      expect(params.rows[0][1]).toHaveProperty('rowspan', 2)
    })

    it('should handle cells with format and classes', async () => {
      // Arrange
      const rows = [
        [{ text: '100', format: 'numeric', classes: 'govuk-table__cell--numeric' }, { text: 'Regular cell' }],
      ]

      // Act
      const params = await helper.getParams({ rows })

      // Assert
      expect(params.rows[0][0]).toHaveProperty('format', 'numeric')
      expect(params.rows[0][0]).toHaveProperty('classes', 'govuk-table__cell--numeric')
    })

    it('should handle cells with custom attributes', async () => {
      // Arrange
      const rows = [
        [
          {
            text: 'Cell',
            attributes: { 'data-cell-id': '123', 'data-sort': 'asc' },
          },
        ],
      ]

      // Act
      const params = await helper.getParams({ rows })

      // Assert
      expect(params.rows[0][0].attributes).toEqual({
        'data-cell-id': '123',
        'data-sort': 'asc',
      })
    })

    it('should handle head cells with all options', async () => {
      // Arrange
      const head = [
        {
          html: '<input type="checkbox" id="select-all">',
          classes: 'govuk-table__header--checkbox',
          attributes: { scope: 'col' },
        },
        {
          text: 'Name',
          format: 'text',
          colspan: 2,
          attributes: { scope: 'col' },
        },
      ]
      const rows = [[{ text: 'data' }]]

      // Act
      const params = await helper.getParams({ rows, head })

      // Assert
      expect(params.head).toEqual(head)
    })
  })

  describe('HTML and text content in cells', () => {
    it('should handle HTML content in cells', async () => {
      // Arrange
      const rows = [[{ html: '<strong>Bold text</strong>' }, { html: '<a href="#">Link</a>' }]]

      // Act
      const params = await helper.getParams({ rows })

      // Assert
      expect(params.rows[0][0]).toHaveProperty('html', '<strong>Bold text</strong>')
      expect(params.rows[0][1]).toHaveProperty('html', '<a href="#">Link</a>')
    })

    it('should handle text content in cells', async () => {
      // Arrange
      const rows = [[{ text: 'Plain text 1' }, { text: 'Plain text 2' }]]

      // Act
      const params = await helper.getParams({ rows })

      // Assert
      expect(params.rows[0][0]).toHaveProperty('text', 'Plain text 1')
      expect(params.rows[0][1]).toHaveProperty('text', 'Plain text 2')
    })

    it('should handle mixed HTML and text in different cells', async () => {
      // Arrange
      const rows = [
        [
          { html: '<input type="checkbox" name="selected" value="1">' },
          { text: 'John Smith' },
          { html: '<span class="govuk-tag">Active</span>' },
        ],
      ]

      // Act
      const params = await helper.getParams({ rows })

      // Assert
      expect(params.rows[0][0]).toHaveProperty('html')
      expect(params.rows[0][1]).toHaveProperty('text', 'John Smith')
      expect(params.rows[0][2]).toHaveProperty('html')
    })
  })
})
