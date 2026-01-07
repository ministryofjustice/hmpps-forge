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
 * Configuration for a table header cell.
 */
export interface MultiSelectHeadCell {
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
 * Configuration for a table body cell.
 */
export interface MultiSelectCell {
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
 * A row in the table, consisting of an array of cells.
 */
export type MultiSelectRow = MultiSelectCell[]

/**
 * Props for the MOJMultiSelect component.
 *
 * A thin wrapper around the GOV.UK Table that adds the `data-module="moj-multi-select"`
 * attribute to enable the MOJ multi-select JavaScript enhancement.
 *
 * Note: You must include checkbox inputs in your table cells for the multi-select
 * functionality to work. The first column should contain checkboxes, with a
 * "select all" checkbox in the header.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/multi-select/
 * @example
 * ```typescript
 * MOJMultiSelect({
 *   head: [
 *     { html: '<input type="checkbox" class="govuk-checkboxes__input" id="select-all">' },
 *     { text: 'Name' },
 *     { text: 'Status' },
 *   ],
 *   rows: [
 *     [
 *       { html: '<input type="checkbox" class="govuk-checkboxes__input" name="selected" value="1">' },
 *       { text: 'John Smith' },
 *       { text: 'Active' },
 *     ],
 *   ],
 * })
 * ```
 */
export interface MOJMultiSelectProps extends BasicBlockProps {
  /** The rows within the table. Each row is an array of cells. Required. */
  rows: MultiSelectRow[]

  /** Table header cells. Renders a `<thead>` with a single header row. */
  head?: MultiSelectHeadCell[]

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
 * MOJ Multi Select component interface.
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `MOJMultiSelectProps` type or the `MOJMultiSelect()` wrapper function instead.
 */
export interface MOJMultiSelect extends BlockDefinition, MOJMultiSelectProps {
  /** Component variant identifier */
  variant: 'mojMultiSelect'
}

/**
 * Renders the MOJ Multi Select component using the GOV.UK Table template
 * with the moj-multi-select data-module attribute.
 */
async function multiSelectRenderer(
  block: EvaluatedBlock<MOJMultiSelect>,
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
      'data-module': 'moj-multi-select',
    },
  }

  return nunjucksEnv.render('govuk/components/table/template.njk', { params })
}

export const mojMultiSelect = buildNunjucksComponent<MOJMultiSelect>('mojMultiSelect', multiSelectRenderer)

/**
 * Creates an MOJ Multi Select table with row selection functionality.
 *
 * This is a thin wrapper around the GOV.UK Table that adds the
 * `data-module="moj-multi-select"` attribute to enable the MOJ JavaScript enhancement.
 *
 * You must structure your table with checkbox inputs for the functionality to work:
 * - First column header should contain a "select all" checkbox
 * - First cell of each row should contain a checkbox with the row's value
 *
 * @see https://design-patterns.service.justice.gov.uk/components/multi-select/
 * @example
 * ```typescript
 * MOJMultiSelect({
 *   head: [
 *     { html: '<input type="checkbox" class="govuk-checkboxes__input" id="select-all">' },
 *     { text: 'Name' },
 *     { text: 'Status' },
 *   ],
 *   rows: [
 *     [
 *       { html: '<input type="checkbox" class="govuk-checkboxes__input" name="selected" value="1">' },
 *       { text: 'John Smith' },
 *       { text: 'Active' },
 *     ],
 *   ],
 * })
 * ```
 */
export function MOJMultiSelect(props: MOJMultiSelectProps): MOJMultiSelect {
  return blockBuilder<MOJMultiSelect>({ ...props, variant: 'mojMultiSelect' })
}
