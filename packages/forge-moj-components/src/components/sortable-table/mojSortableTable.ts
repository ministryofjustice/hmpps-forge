import { BlockDefinition, ResolvableString } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'

/**
 * Configuration for a sortable table header cell.
 */
export interface SortableTableHeadCell {
  /** Plain text content for the header cell. */
  text?: ResolvableString

  /** HTML content for the header cell. Takes precedence over `text`. */
  html?: ResolvableString

  /** Specify format of the cell. Use "numeric" for right-aligned numeric data. */
  format?: ResolvableString

  /** Additional CSS classes for the header cell. */
  classes?: ResolvableString

  /** Number of columns this cell should span. */
  colspan?: number

  /** Number of rows this cell should span. */
  rowspan?: number

  /** Custom HTML attributes for the header cell element. */
  attributes?: Record<string, any>
}

/**
 * Configuration for a sortable table body cell.
 */
export interface SortableTableCell {
  /** Plain text content for the cell. */
  text?: ResolvableString

  /** HTML content for the cell. Takes precedence over `text`. */
  html?: ResolvableString

  /** Specify format of the cell. Use "numeric" for right-aligned numeric data. */
  format?: ResolvableString

  /** Additional CSS classes for the cell. */
  classes?: ResolvableString

  /** Number of columns this cell should span. */
  colspan?: number

  /** Number of rows this cell should span. */
  rowspan?: number

  /** Custom HTML attributes for the cell element. */
  attributes?: Record<string, any>
}

/**
 * A row in the sortable table, consisting of an array of cells.
 */
export type SortableTableRow = SortableTableCell[]

/**
 * MOJ Sortable Table component.
 * A table with clickable column headers for sorting.
 *
 * This is a thin wrapper around the GOV.UK Table that adds the
 * `data-module="moj-sortable-table"` attribute to enable the MOJ JavaScript enhancement.
 *
 * For sorting to work, header cells should contain `<button>` elements.
 * The JavaScript will handle click events and sort the table rows accordingly.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/sortable-table/
 * @example
 * ```typescript
 * MOJSortableTable({
 *   head: [
 *     { html: '<button>Name</button>' },
 *     { html: '<button>Date</button>' },
 *     { html: '<button>Status</button>' },
 *   ],
 *   rows: [
 *     [{ text: 'John Smith' }, { text: '2024-01-15' }, { text: 'Active' }],
 *     [{ text: 'Jane Doe' }, { text: '2024-02-20' }, { text: 'Pending' }],
 *   ],
 * })
 * ```
 */
export interface MOJSortableTable extends BlockDefinition {
  /** The rows within the table. Each row is an array of cells. Required. */
  rows: SortableTableRow[]

  /** Table header cells. Renders a `<thead>` with a single header row. */
  head?: SortableTableHeadCell[]

  /** Caption text displayed above the table. Useful for accessibility. */
  caption?: ResolvableString

  /** CSS classes for the caption. */
  captionClasses?: ResolvableString

  /** If true, the first cell in each row will be rendered as a header (`<th>`) with row scope. */
  firstCellIsHeader?: boolean

  /** Additional CSS classes for the table element. */
  classes?: ResolvableString

  /** Custom HTML attributes for the table element. */
  attributes?: Record<string, any>
}

/**
 * MOJ Sortable Table component.
 * A table with clickable column headers for sorting.
 *
 * This is a thin wrapper around the GOV.UK Table that adds the
 * `data-module="moj-sortable-table"` attribute to enable the MOJ JavaScript enhancement.
 *
 * For sorting to work, header cells should contain `<button>` elements.
 * The JavaScript will handle click events and sort the table rows accordingly.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/sortable-table/
 * @example
 * ```typescript
 * MOJSortableTable({
 *   head: [
 *     { html: '<button>Name</button>' },
 *     { html: '<button>Date</button>' },
 *     { html: '<button>Status</button>' },
 *   ],
 *   rows: [
 *     [{ text: 'John Smith' }, { text: '2024-01-15' }, { text: 'Active' }],
 *     [{ text: 'Jane Doe' }, { text: '2024-02-20' }, { text: 'Pending' }],
 *   ],
 * })
 * ```
 */
export const MOJSortableTable = nunjucksComponent<MOJSortableTable>('mojSortableTable', {
  render: (props, nunjucksEnv) => {
    const params: Record<string, any> = {
      rows: props.rows,
      head: props.head,
      caption: props.caption,
      captionClasses: props.captionClasses,
      firstCellIsHeader: props.firstCellIsHeader,
      classes: props.classes,
      attributes: {
        ...props.attributes,
        'data-module': 'moj-sortable-table',
      },
    }

    return nunjucksEnv.render('govuk/components/table/template.njk', { params })
  },
})
