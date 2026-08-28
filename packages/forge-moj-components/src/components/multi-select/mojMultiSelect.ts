import { nunjucksComponent } from '../../utils/nunjucksComponent'

/**
 * Configuration for a table header cell.
 */
export interface MultiSelectHeadCell {
  /** Plain text content for the header cell. */
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
 */
export interface MultiSelectCell {
  /** Plain text content for the cell. */
  text?: string

  /** HTML content for the cell. Takes precedence over `text`. */
  html?: string

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
export type MultiSelectRow = MultiSelectCell[]

/**
 * MOJ Multi Select component.
 * A table with row selection functionality.
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
export interface MOJMultiSelect {
  /** The rows within the table. Each row is an array of cells. Required. */
  rows: MultiSelectRow[]

  /** Table header cells. Renders a `<thead>` with a single header row. */
  head?: MultiSelectHeadCell[]

  /** Caption text displayed above the table. Useful for accessibility. */
  caption?: string

  /** CSS classes for the caption. */
  captionClasses?: string

  /** If true, the first cell in each row will be rendered as a header (`<th>`) with row scope. */
  firstCellIsHeader?: boolean

  /** Additional CSS classes for the table element. */
  classes?: string

  /** Custom HTML attributes for the table element. */
  attributes?: Record<string, any>
}

/**
 * MOJ Multi Select component.
 * A table with row selection functionality.
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
export const MOJMultiSelect = nunjucksComponent<MOJMultiSelect>('mojMultiSelect', {
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
        'data-module': 'moj-multi-select',
      },
    }

    return nunjucksEnv.render('govuk/components/table/template.njk', { params })
  },
})
