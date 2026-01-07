import { MojComponentTestHelper } from '@form-engine-moj-components/test-utils/MojComponentTestHelper'
import { setupComponentTest } from '@form-engine-moj-components/test-utils/setupComponentTest'
import { mojSortableTable } from './mojSortableTable'

jest.mock('nunjucks')

describe('mojSortableTable', () => {
  setupComponentTest()

  const helper = new MojComponentTestHelper(mojSortableTable)

  describe('Rows transformation', () => {
    it('should pass through rows unchanged', async () => {
      // Arrange
      const rows = [
        [{ text: 'John Smith' }, { text: '2024-01-15' }, { text: 'Active' }],
        [{ text: 'Jane Doe' }, { text: '2024-02-20' }, { text: 'Pending' }],
      ]

      // Act
      const params = await helper.getParams({ rows })

      // Assert
      expect(params.rows).toEqual(rows)
    })

    it('should pass through rows with HTML cells', async () => {
      // Arrange
      const rows = [
        [{ html: '<strong>John Smith</strong>' }, { text: '2024-01-15' }],
        [{ html: '<em>Jane Doe</em>' }, { text: '2024-02-20' }],
      ]

      // Act
      const params = await helper.getParams({ rows })

      // Assert
      expect(params.rows).toEqual(rows)
    })

    it('should pass through rows with cell attributes', async () => {
      // Arrange
      const rows = [
        [
          { text: 'John Smith', attributes: { 'data-id': 'user-1' } },
          { text: '2024-01-15', format: 'numeric' },
        ],
      ]

      // Act
      const params = await helper.getParams({ rows })

      // Assert
      expect(params.rows).toEqual(rows)
    })

    it('should pass through rows with colspan and rowspan', async () => {
      // Arrange
      const rows = [[{ text: 'Spanning cell', colspan: 3, rowspan: 2 }]]

      // Act
      const params = await helper.getParams({ rows })

      // Assert
      expect(params.rows).toEqual(rows)
    })
  })

  describe('Head transformation', () => {
    it('should pass through head cells unchanged', async () => {
      // Arrange
      const head = [{ text: 'Name' }, { text: 'Date' }, { text: 'Status' }]

      // Act
      const params = await helper.getParams({
        rows: [],
        head,
      })

      // Assert
      expect(params.head).toEqual(head)
    })

    it('should pass through head cells with HTML buttons for sorting', async () => {
      // Arrange
      const head = [
        { html: '<button>Name</button>' },
        { html: '<button>Date</button>' },
        { html: '<button>Status</button>' },
      ]

      // Act
      const params = await helper.getParams({
        rows: [],
        head,
      })

      // Assert
      expect(params.head).toEqual(head)
    })

    it('should pass through head cells with format and classes', async () => {
      // Arrange
      const head = [
        { text: 'Name', classes: 'govuk-table__header--custom' },
        { text: 'Amount', format: 'numeric' },
      ]

      // Act
      const params = await helper.getParams({
        rows: [],
        head,
      })

      // Assert
      expect(params.head).toEqual(head)
    })

    it('should pass through head cells with colspan and rowspan', async () => {
      // Arrange
      const head = [{ text: 'Combined Header', colspan: 2 }]

      // Act
      const params = await helper.getParams({
        rows: [],
        head,
      })

      // Assert
      expect(params.head).toEqual(head)
    })

    it('should leave head undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'Data' }]],
      })

      // Assert
      expect(params.head).toBeUndefined()
    })
  })

  describe('Caption transformation', () => {
    it('should pass through caption text', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [],
        caption: 'User List',
      })

      // Assert
      expect(params.caption).toBe('User List')
    })

    it('should pass through captionClasses', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [],
        caption: 'User List',
        captionClasses: 'govuk-table__caption--l',
      })

      // Assert
      expect(params.captionClasses).toBe('govuk-table__caption--l')
    })

    it('should leave caption undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'Data' }]],
      })

      // Assert
      expect(params.caption).toBeUndefined()
    })

    it('should leave captionClasses undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'Data' }]],
        caption: 'User List',
      })

      // Assert
      expect(params.captionClasses).toBeUndefined()
    })
  })

  describe('firstCellIsHeader transformation', () => {
    it('should pass through firstCellIsHeader when true', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [],
        firstCellIsHeader: true,
      })

      // Assert
      expect(params.firstCellIsHeader).toBe(true)
    })

    it('should pass through firstCellIsHeader when false', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [],
        firstCellIsHeader: false,
      })

      // Assert
      expect(params.firstCellIsHeader).toBe(false)
    })

    it('should leave firstCellIsHeader undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'Data' }]],
      })

      // Assert
      expect(params.firstCellIsHeader).toBeUndefined()
    })
  })

  describe('Data module attribute', () => {
    it('should add data-module attribute with moj-sortable-table value', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'Data' }]],
      })

      // Assert
      expect(params.attributes).toHaveProperty('data-module', 'moj-sortable-table')
    })

    it('should merge user attributes with data-module attribute', async () => {
      // Arrange
      const attributes = {
        'data-testid': 'my-table',
        'data-tracking': 'table-viewed',
      }

      // Act
      const params = await helper.getParams({
        rows: [[{ text: 'Data' }]],
        attributes,
      })

      // Assert
      expect(params.attributes).toEqual({
        'data-testid': 'my-table',
        'data-tracking': 'table-viewed',
        'data-module': 'moj-sortable-table',
      })
    })

    it('should override user-provided data-module attribute', async () => {
      // Arrange
      const attributes = {
        'data-module': 'custom-module',
        'data-other': 'value',
      }

      // Act
      const params = await helper.getParams({
        rows: [[{ text: 'Data' }]],
        attributes,
      })

      // Assert
      expect(params.attributes).toEqual({
        'data-other': 'value',
        'data-module': 'moj-sortable-table',
      })
    })
  })

  describe('Optional attributes', () => {
    it('should pass through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [],
        classes: 'custom-table-class',
      })

      // Assert
      expect(params.classes).toBe('custom-table-class')
    })

    it('should leave classes undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'Data' }]],
      })

      // Assert
      expect(params.classes).toBeUndefined()
    })

    it('should pass through attributes when provided', async () => {
      // Arrange
      const attributes = {
        'data-testid': 'sortable-table',
        'aria-label': 'Sortable user list',
      }

      // Act
      const params = await helper.getParams({
        rows: [],
        attributes,
      })

      // Assert
      expect(params.attributes).toMatchObject(attributes)
    })
  })

  describe('Template and context', () => {
    it('should use GOV.UK table template', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        rows: [[{ text: 'Data' }]],
      })

      // Assert
      expect(template).toBe('govuk/components/table/template.njk')
    })

    it('should wrap params in context object', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        rows: [[{ text: 'Data' }]],
      })

      // Assert
      expect(context).toHaveProperty('params')
      expect((context as { params: Record<string, any> }).params).toHaveProperty('rows')
    })

    it('should include all params in context', async () => {
      // Arrange
      const head = [{ html: '<button>Name</button>' }, { html: '<button>Status</button>' }]
      const rows = [
        [{ text: 'John Smith' }, { text: 'Active' }],
        [{ text: 'Jane Doe' }, { text: 'Pending' }],
      ]

      // Act
      const { context } = await helper.executeComponent({
        head,
        rows,
        caption: 'User List',
        captionClasses: 'govuk-table__caption--l',
        firstCellIsHeader: true,
        classes: 'custom-table',
        attributes: { 'data-test': 'value' },
      })

      // Assert
      const params = (context as { params: Record<string, any> }).params
      expect(params).toHaveProperty('head', head)
      expect(params).toHaveProperty('rows', rows)
      expect(params).toHaveProperty('caption', 'User List')
      expect(params).toHaveProperty('captionClasses', 'govuk-table__caption--l')
      expect(params).toHaveProperty('firstCellIsHeader', true)
      expect(params).toHaveProperty('classes', 'custom-table')
      expect(params).toHaveProperty('attributes')
      expect(params.attributes).toHaveProperty('data-module', 'moj-sortable-table')
    })
  })
})
