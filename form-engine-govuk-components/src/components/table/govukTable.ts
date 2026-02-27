import type nunjucks from 'nunjucks'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalArray,
  ConditionalString,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

/**
 * Configuration for a table header cell.
 * Used in the `head` array to define column headers.
 */
export interface TableHeadCell {
  /** Plain text content for the header cell. If `html` is provided, this will be ignored. */
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
 * Configuration for a table body cell.
 * Used in row arrays to define cell content.
 */
export interface TableCell {
  /** Plain text content for the cell. If `html` is provided, this will be ignored. */
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
 * A row in the table, consisting of an array of cells.
 */
export type TableRow = TableCell[]

/**
 * Props for the GovUKTable component.
 * Displays data in a structured table format following the GOV.UK Design System.
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
export interface GovUKTableProps extends BasicBlockProps {
  /** The rows within the table. Each row is an array of cells. Supports dynamic expressions. */
  rows: ConditionalArray<TableRow>

  /** Table header cells. Renders a `<thead>` with a single header row. */
  head?: TableHeadCell[]

  /** Caption text displayed above the table. Useful for accessibility. */
  caption?: ConditionalString

  /** CSS classes for the caption. Use GOV.UK typography classes like "govuk-table__caption--m". */
  captionClasses?: ConditionalString

  /** If true, the first cell in each row will be rendered as a header (`<th>`) with row scope. */
  firstCellIsHeader?: boolean

  /** Additional CSS classes for the table element. */
  classes?: ConditionalString

  /** Custom HTML attributes for the table element. */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Table component interface.
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKTableProps` type or the `GovUKTable()` wrapper function instead.
 */
export interface GovUKTable extends BlockDefinition, GovUKTableProps {
  /** Component variant identifier */
  variant: 'govukTable'
}

/**
 * Renders the GOV.UK Table component using the official Nunjucks template.
 */
async function tableRenderer(block: EvaluatedBlock<GovUKTable>, nunjucksEnv: nunjucks.Environment): Promise<string> {
  const params: Record<string, any> = {
    rows: block.rows,
    head: block.head,
    caption: block.caption,
    captionClasses: block.captionClasses,
    firstCellIsHeader: block.firstCellIsHeader,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('govuk/components/table/template.njk', { params })
}

export const govukTable = buildNunjucksComponent<GovUKTable>('govukTable', tableRenderer)

/**
 * Creates a GOV.UK Table for displaying structured data.
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
export function GovUKTable(props: GovUKTableProps): GovUKTable {
  return blockBuilder<GovUKTable>({ ...props, variant: 'govukTable' })
}
