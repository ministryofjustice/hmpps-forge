import { BlockDefinition, EvaluatedBlock, ResolvableBlockProps } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import { renderGovukBlocksToHtml } from '../../utils/govukParamNormalisers'

/**
 * Configuration for a table header cell.
 * Used in the `head` array to define column headers.
 */
export interface TableHeadCell {
  /** Plain text content for the header cell. If `html` is provided, this will be ignored. */
  text?: string

  /** HTML content for the header cell. Takes precedence over `text`. */
  html?: string

  /** Specify format of the cell. Use "numeric" for right-aligned numeric data. */
  format?: string

  /** Additional CSS classes for the header cell. */
  classes?: string

  /** Number of columns this cell should span. */
  colspan?: number

  /** Number of rows this cell should span. */
  rowspan?: number

  /** Custom HTML attributes for the header cell element. */
  attributes?: Record<string, any>
}

/**
 * Configuration for a table body cell.
 * Used in row arrays to define cell content.
 */
export interface TableCell {
  /** Plain text content for the cell. If `html` or `blocks` is provided, this will be ignored. */
  text?: string

  /** HTML content for the cell. Takes precedence over `text`; ignored when `blocks` is provided. */
  html?: string

  /** Child blocks to render for the cell. Takes precedence over `text` and `html`. */
  blocks?: BlockDefinition[]

  /** Specify format of the cell. Use "numeric" for right-aligned numeric data. */
  format?: string

  /** Additional CSS classes for the cell. */
  classes?: string

  /** Number of columns this cell should span. */
  colspan?: number

  /** Number of rows this cell should span. */
  rowspan?: number

  /** Custom HTML attributes for the cell element. */
  attributes?: Record<string, any>
}

/**
 * A row in the table, consisting of an array of cells.
 */
export type TableRow = TableCell[]

/**
 * GOV.UK Table component.
 *
 * Displays data in a structured table format.
 * Supports headers, captions, numeric formatting, and row/column spans.
 *
 * @see https://design-system.service.gov.uk/components/table/
 * @example
 * ```typescript
 * GovUKTable({
 *   caption: 'Monthly savings',
 *   captionClasses: 'govuk-table__caption--m',
 *   head: [
 *     { text: 'Month' },
 *     { text: 'Amount', format: 'numeric' },
 *   ],
 *   rows: [
 *     [{ text: 'January' }, { text: '£85', format: 'numeric' }],
 *     [{ text: 'February' }, { text: '£165', format: 'numeric' }],
 *   ],
 * })
 * ```
 */
export type GovUKTable = ResolvableBlockProps<{
  /** The rows within the table. Each row is an array of cells. Supports dynamic expressions. */
  rows: TableRow[]

  /** Table header cells. Renders a `<thead>` with a single header row. */
  head?: TableHeadCell[]

  /** Caption text displayed above the table. Useful for accessibility. */
  caption?: string

  /** CSS classes for the caption. Use GOV.UK typography classes like "govuk-table__caption--m". */
  captionClasses?: string

  /** If true, the first cell in each row will be rendered as a header (`<th>`) with row scope. */
  firstCellIsHeader?: boolean

  /** Additional CSS classes for the table element. */
  classes?: string

  /** Custom HTML attributes for the table element. */
  attributes?: Record<string, any>
}>

type EvaluatedTableRow = EvaluatedBlock<GovUKTable>['rows'][number]
type EvaluatedTableCell = EvaluatedTableRow[number]

function normaliseTableCell(cell: EvaluatedTableCell) {
  const { blocks, ...cellParams } = cell
  const blocksHtml = renderGovukBlocksToHtml(blocks)

  if (blocksHtml === undefined) {
    return cellParams
  }

  return {
    ...cellParams,
    text: undefined,
    html: blocksHtml,
  }
}

/**
 * GOV.UK Table component.
 *
 * Displays data in a structured table format.
 * Supports headers, captions, numeric formatting, and row/column spans.
 *
 * @see https://design-system.service.gov.uk/components/table/
 * @example
 * ```typescript
 * GovUKTable({
 *   caption: 'Monthly savings',
 *   captionClasses: 'govuk-table__caption--m',
 *   head: [
 *     { text: 'Month' },
 *     { text: 'Amount', format: 'numeric' },
 *   ],
 *   rows: [
 *     [{ text: 'January' }, { text: '£85', format: 'numeric' }],
 *     [{ text: 'February' }, { text: '£165', format: 'numeric' }],
 *   ],
 * })
 * ```
 */
export const GovUKTable = nunjucksComponent<GovUKTable>('govukTable', {
  render: (props, nunjucksEnv) => {
    const params: Record<string, any> = {
      rows: props.rows.map(row => row.map(normaliseTableCell)),
      head: props.head,
      caption: props.caption,
      captionClasses: props.captionClasses,
      firstCellIsHeader: props.firstCellIsHeader,
      classes: props.classes,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('govuk/components/table/template.njk', { params })
  },
})
