import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { govukTable } from './govukTable'

jest.mock('nunjucks')

describe('GOV.UK Table Component', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukTable)

  describe('Row data transformation', () => {
    it('sets basic row with single cell', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'January' }]],
      })

      // Assert
      expect(params.rows).toHaveLength(1)
      expect(params.rows[0]).toHaveLength(1)
      expect(params.rows[0][0]).toEqual({ text: 'January' })
    })

    it('sets basic row with multiple cells', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'January' }, { text: '£85' }, { text: '£95' }]],
      })

      // Assert
      expect(params.rows).toHaveLength(1)
      expect(params.rows[0]).toHaveLength(3)
      expect(params.rows[0][0]).toEqual({ text: 'January' })
      expect(params.rows[0][1]).toEqual({ text: '£85' })
      expect(params.rows[0][2]).toEqual({ text: '£95' })
    })

    it('sets multiple rows with cells', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          [{ text: 'January' }, { text: '£85' }],
          [{ text: 'February' }, { text: '£165' }],
          [{ text: 'March' }, { text: '£230' }],
        ],
      })

      // Assert
      expect(params.rows).toHaveLength(3)
      expect(params.rows[0]).toEqual([{ text: 'January' }, { text: '£85' }])
      expect(params.rows[1]).toEqual([{ text: 'February' }, { text: '£165' }])
      expect(params.rows[2]).toEqual([{ text: 'March' }, { text: '£230' }])
    })

    it('sets cell with html content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ html: '<strong>January</strong>' }, { text: '£85' }]],
      })

      // Assert
      expect(params.rows[0][0]).toEqual({ html: '<strong>January</strong>' })
    })

    it('sets cells with both text and html', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'This is ignored', html: '<em>February</em>' }, { text: '£165' }]],
      })

      // Assert
      expect(params.rows[0][0]).toEqual({ text: 'This is ignored', html: '<em>February</em>' })
    })
  })

  describe('Header row', () => {
    it('sets basic head cells', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'January' }, { text: '£85' }]],
        head: [{ text: 'Month' }, { text: 'Amount' }],
      })

      // Assert
      expect(params.head).toHaveLength(2)
      expect(params.head[0]).toEqual({ text: 'Month' })
      expect(params.head[1]).toEqual({ text: 'Amount' })
    })

    it('sets head with numeric format', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'January' }, { text: '£85' }]],
        head: [{ text: 'Month' }, { text: 'Amount', format: 'numeric' }],
      })

      // Assert
      expect(params.head[1]).toEqual({ text: 'Amount', format: 'numeric' })
    })

    it('sets head with classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'January' }, { text: '£85' }]],
        head: [{ text: 'Month', classes: 'app-table__header--custom' }, { text: 'Amount' }],
      })

      // Assert
      expect(params.head[0]).toEqual({ text: 'Month', classes: 'app-table__header--custom' })
    })

    it('sets head with html content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'January' }, { text: '£85' }]],
        head: [{ html: '<strong>Month</strong>' }, { text: 'Amount' }],
      })

      // Assert
      expect(params.head[0]).toEqual({ html: '<strong>Month</strong>' })
    })

    it('sets head with colspan', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'January' }, { text: '£85' }]],
        head: [{ text: 'Month', colspan: 2 }],
      })

      // Assert
      expect(params.head[0]).toEqual({ text: 'Month', colspan: 2 })
    })

    it('sets head with rowspan', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'January' }, { text: '£85' }]],
        head: [{ text: 'Month', rowspan: 2 }, { text: 'Amount' }],
      })

      // Assert
      expect(params.head[0]).toEqual({ text: 'Month', rowspan: 2 })
    })

    it('sets head with attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'January' }, { text: '£85' }]],
        head: [
          {
            text: 'Month',
            attributes: {
              'data-sort': 'month',
            },
          },
          { text: 'Amount' },
        ],
      })

      // Assert
      expect(params.head[0]).toEqual({
        text: 'Month',
        attributes: {
          'data-sort': 'month',
        },
      })
    })
  })

  describe('Cell options', () => {
    it('sets cell with numeric format', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'January' }, { text: '£85', format: 'numeric' }]],
      })

      // Assert
      expect(params.rows[0][1]).toEqual({ text: '£85', format: 'numeric' })
    })

    it('sets cell with colspan', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'Total', colspan: 2 }, { text: '£250' }]],
      })

      // Assert
      expect(params.rows[0][0]).toEqual({ text: 'Total', colspan: 2 })
    })

    it('sets cell with rowspan', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'Q1', rowspan: 3 }, { text: 'January' }, { text: '£85' }]],
      })

      // Assert
      expect(params.rows[0][0]).toEqual({ text: 'Q1', rowspan: 3 })
    })

    it('sets cell with classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'January' }, { text: '£85', classes: 'app-table__cell--highlighted' }]],
      })

      // Assert
      expect(params.rows[0][1]).toEqual({ text: '£85', classes: 'app-table__cell--highlighted' })
    })

    it('sets cell with attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          [
            { text: 'January' },
            {
              text: '£85',
              attributes: {
                'data-value': '85',
              },
            },
          ],
        ],
      })

      // Assert
      expect(params.rows[0][1]).toEqual({
        text: '£85',
        attributes: {
          'data-value': '85',
        },
      })
    })

    it('sets cell with multiple options', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          [
            { text: 'January' },
            {
              text: '£85',
              format: 'numeric',
              classes: 'app-table__cell--total',
              attributes: {
                'data-value': '85',
              },
            },
          ],
        ],
      })

      // Assert
      expect(params.rows[0][1]).toEqual({
        text: '£85',
        format: 'numeric',
        classes: 'app-table__cell--total',
        attributes: {
          'data-value': '85',
        },
      })
    })
  })

  describe('Caption', () => {
    it('sets caption text', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'January' }, { text: '£85' }]],
        caption: 'Monthly savings',
      })

      // Assert
      expect(params.caption).toBe('Monthly savings')
    })

    it('sets captionClasses', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'January' }, { text: '£85' }]],
        caption: 'Monthly savings',
        captionClasses: 'govuk-table__caption--m',
      })

      // Assert
      expect(params.caption).toBe('Monthly savings')
      expect(params.captionClasses).toBe('govuk-table__caption--m')
    })

    it('sets captionClasses without caption', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'January' }, { text: '£85' }]],
        captionClasses: 'govuk-table__caption--l',
      })

      // Assert
      expect(params.caption).toBeUndefined()
      expect(params.captionClasses).toBe('govuk-table__caption--l')
    })
  })

  describe('First cell is header', () => {
    it('sets firstCellIsHeader to true', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          [{ text: 'January' }, { text: '£85' }],
          [{ text: 'February' }, { text: '£165' }],
        ],
        firstCellIsHeader: true,
      })

      // Assert
      expect(params.firstCellIsHeader).toBe(true)
    })

    it('sets firstCellIsHeader to false', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          [{ text: 'January' }, { text: '£85' }],
          [{ text: 'February' }, { text: '£165' }],
        ],
        firstCellIsHeader: false,
      })

      // Assert
      expect(params.firstCellIsHeader).toBe(false)
    })

    it('leaves firstCellIsHeader undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          [{ text: 'January' }, { text: '£85' }],
          [{ text: 'February' }, { text: '£165' }],
        ],
      })

      // Assert
      expect(params.firstCellIsHeader).toBeUndefined()
    })
  })

  describe('Optional attributes', () => {
    it('passes through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'January' }, { text: '£85' }]],
        classes: 'app-table--custom',
      })

      // Assert
      expect(params.classes).toBe('app-table--custom')
    })

    it('passes through attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [[{ text: 'January' }, { text: '£85' }]],
        attributes: {
          'data-module': 'sortable-table',
          'data-track': 'table-interaction',
        },
      })

      // Assert
      expect(params.attributes).toEqual({
        'data-module': 'sortable-table',
        'data-track': 'table-interaction',
      })
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        rows: [[{ text: 'January' }, { text: '£85' }]],
      })

      // Assert
      expect(template).toBe('govuk/components/table/template.njk')
    })

    it('wraps params in correct context structure', async () => {
      // Arrange & Act
      const { context } = (await helper.executeComponent({
        caption: 'Monthly savings',
        head: [{ text: 'Month' }, { text: 'Amount' }],
        rows: [
          [{ text: 'January' }, { text: '£85' }],
          [{ text: 'February' }, { text: '£165' }],
        ],
      })) as { context: { params: any } }

      // Assert
      expect(context).toHaveProperty('params')
      expect(context.params.caption).toBe('Monthly savings')
      expect(context.params.head).toHaveLength(2)
      expect(context.params.rows).toHaveLength(2)
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders table with basic rows and head', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        head: [{ text: 'Month' }, { text: 'Amount' }],
        rows: [
          [{ text: 'January' }, { text: '£85' }],
          [{ text: 'February' }, { text: '£165' }],
        ],
      })

      // Assert
      expect(html).toContain('govuk-table')
      expect(html).toContain('Month')
      expect(html).toContain('Amount')
      expect(html).toContain('January')
      expect(html).toContain('£85')
      expect(html).toContain('February')
      expect(html).toContain('£165')
    })

    it('renders table with caption', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        caption: 'Monthly savings',
        captionClasses: 'govuk-table__caption--m',
        head: [{ text: 'Month' }, { text: 'Amount' }],
        rows: [[{ text: 'January' }, { text: '£85' }]],
      })

      // Assert
      expect(html).toContain('govuk-table')
      expect(html).toContain('Monthly savings')
      expect(html).toContain('govuk-table__caption--m')
    })

    it('renders table with numeric format', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        head: [{ text: 'Month' }, { text: 'Amount', format: 'numeric' }],
        rows: [[{ text: 'January' }, { text: '£85', format: 'numeric' }]],
      })

      // Assert
      expect(html).toContain('govuk-table')
      expect(html).toContain('£85')
    })

    it('renders table with firstCellIsHeader', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        rows: [
          [{ text: 'January' }, { text: '£85' }],
          [{ text: 'February' }, { text: '£165' }],
        ],
        firstCellIsHeader: true,
      })

      // Assert
      expect(html).toContain('govuk-table')
      expect(html).toContain('January')
      expect(html).toContain('February')
    })

    it('renders table with custom classes', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        rows: [[{ text: 'January' }, { text: '£85' }]],
        classes: 'app-table--custom',
      })

      // Assert
      expect(html).toContain('govuk-table')
      expect(html).toContain('app-table--custom')
    })

    it('renders table with colspan and rowspan', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        head: [{ text: 'Details', colspan: 2 }],
        rows: [[{ text: 'Q1', rowspan: 3 }, { text: 'January' }]],
      })

      // Assert
      expect(html).toContain('govuk-table')
      expect(html).toContain('Details')
      expect(html).toContain('Q1')
      expect(html).toContain('January')
    })

    it('renders table with HTML content in cells', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        head: [{ html: '<strong>Month</strong>' }, { text: 'Amount' }],
        rows: [[{ html: '<em>January</em>' }, { text: '£85' }]],
      })

      // Assert
      expect(html).toContain('govuk-table')
      expect(html).toContain('<strong>Month</strong>')
      expect(html).toContain('<em>January</em>')
    })
  })
})
