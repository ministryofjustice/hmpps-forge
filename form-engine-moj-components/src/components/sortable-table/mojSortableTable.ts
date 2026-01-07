import type nunjucks from 'nunjucks'
import { buildNunjucksComponent } from '@form-engine-moj-components/internal/buildNunjucksComponent'
import {
  BlockDefinition,
  BasicBlockProps,
  ConditionalString,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

/**
 * Configuration for a sortable table header cell.
 */
export interface SortableTableHeadCell {
  /** Plain text content for the header cell. */
  text?: ConditionalString

  /** HTML content for the header cell. Takes precedence over `text`. */
  html?: ConditionalString

  /** Specify format of the cell. Use "numeric" for right-aligned numeric data. */
  format?: ConditionalString

  /** Additional CSS classes for the header cell. */
  classes?: ConditionalString

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
  text?: ConditionalString

  /** HTML content for the cell. Takes precedence over `text`. */
  html?: ConditionalString

  /** Specify format of the cell. Use "numeric" for right-aligned numeric data. */
  format?: ConditionalString

  /** Additional CSS classes for the cell. */
  classes?: ConditionalString

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
 * Props for the MOJSortableTable component.
 *
 * A thin wrapper around the GOV.UK Table that adds the `data-module="moj-sortable-table"`
 * attribute to enable the MOJ sortable table JavaScript enhancement.
 *
 * The JavaScript will make column headers clickable, allowing users to sort
 * the table by that column. Headers should use `<button>` elements for accessibility.
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
export interface MOJSortableTableProps extends BasicBlockProps {
  /** The rows within the table. Each row is an array of cells. Required. */
  rows: SortableTableRow[]

  /** Table header cells. Renders a `<thead>` with a single header row. */
  head?: SortableTableHeadCell[]

  /** Caption text displayed above the table. Useful for accessibility. */
  caption?: ConditionalString

  /** CSS classes for the caption. */
  captionClasses?: ConditionalString

  /** If true, the first cell in each row will be rendered as a header (`<th>`) with row scope. */
  firstCellIsHeader?: boolean

  /** Additional CSS classes for the table element. */
  classes?: ConditionalString

  /** Custom HTML attributes for the table element. */
  attributes?: Record<string, any>
}

/**
 * MOJ Sortable Table component interface.
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `MOJSortableTableProps` type or the `MOJSortableTable()` wrapper function instead.
 */
export interface MOJSortableTable extends BlockDefinition, MOJSortableTableProps {
  /** Component variant identifier */
  variant: 'mojSortableTable'
}

/**
 * Renders the MOJ Sortable Table component using the GOV.UK Table template
 * with the moj-sortable-table data-module attribute.
 */
async function sortableTableRenderer(
  block: EvaluatedBlock<MOJSortableTable>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  const params: Record<string, any> = {
    rows: block.rows,
    head: block.head,
    caption: block.caption,
    captionClasses: block.captionClasses,
    firstCellIsHeader: block.firstCellIsHeader,
    classes: block.classes,
    attributes: {
      ...block.attributes,
      'data-module': 'moj-sortable-table',
    },
  }

  return nunjucksEnv.render('govuk/components/table/template.njk', { params })
}

export const mojSortableTable = buildNunjucksComponent<MOJSortableTable>('mojSortableTable', sortableTableRenderer)

/**
 * Creates an MOJ Sortable Table with clickable column headers for sorting.
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
export function MOJSortableTable(props: MOJSortableTableProps): MOJSortableTable {
  return blockBuilder<MOJSortableTable>({ ...props, variant: 'mojSortableTable' })
}
