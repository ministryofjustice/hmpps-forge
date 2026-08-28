import { BlockDefinition, EvaluatedBlock, ResolvableBlockProps } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import { normaliseGovukTextHtmlContent } from '../../utils/govukParamNormalisers'

/**
 * Action item for summary list rows or card headers.
 * Renders as a link with optional visually hidden text for accessibility.
 */
export interface SummaryListActionItem {
  /** The value of the link's `href` attribute. Required. */
  href: string

  /** Plain text content for the action link. Required unless html is provided. */
  text?: string

  /** HTML content for the action link. Takes precedence over text. */
  html?: string

  /**
   * Additional accessible text appended to the action link.
   * Useful for providing context when the action text alone is not descriptive enough.
   * For example, "Change" might need "name" appended to become "Change name".
   */
  visuallyHiddenText?: string

  /** Additional CSS classes for the action link. */
  classes?: string

  /** Custom HTML attributes for the action link element. */
  attributes?: Record<string, any>
}

/**
 * Actions configuration for summary list rows or card headers.
 * Contains an array of action items and optional wrapper classes.
 */
export interface SummaryListActions {
  /** The action link items to display. */
  items?: SummaryListActionItem[]

  /** Additional CSS classes for the actions wrapper element. */
  classes?: string
}

/**
 * Key (label) for a summary list row.
 * Displays on the left side of the row as the reference/label.
 */
export interface SummaryListKey {
  /** Plain text content for the key. Required unless html is provided. */
  text?: string

  /** HTML content for the key. Takes precedence over text. */
  html?: string

  /** Additional CSS classes for the key wrapper. */
  classes?: string
}

/**
 * Value for a summary list row.
 * Displays on the right side of the row as the content/answer.
 */
export interface SummaryListValue {
  /** Plain text content for the value. Required unless html is provided. */
  text?: string

  /** HTML content for the value. Takes precedence over text. */
  html?: string

  /** Child blocks to render for the value. Takes precedence over text/html. */
  blocks?: BlockDefinition[]

  /** Additional CSS classes for the value wrapper. */
  classes?: string
}

/**
 * A row in the summary list, containing a key-value pair and optional actions.
 */
export interface SummaryListRow {
  /** The reference content (key/label) for this row. Required. */
  key: SummaryListKey

  /** The value content for this row. */
  value?: SummaryListValue

  /** Optional action links for this row (e.g., "Change", "Remove"). */
  actions?: SummaryListActions

  /** Additional CSS classes for the row div element. */
  classes?: string

  /**
   * Conditional visibility for this row. When the evaluated value is `false`,
   * the row is omitted from rendering. Defaults to showing the row.
   *
   * @example Answer('contactMethod').match(Condition.Equals('email'))
   */
  visibleWhen?: boolean
}

/**
 * Title configuration for a summary card header.
 */
export interface SummaryCardTitle {
  /** Plain text content for the card title. Takes precedence if html is not provided. */
  text?: string

  /** HTML content for the card title. Takes precedence over text. */
  html?: string

  /** Heading level for the title, from 1 to 6. Defaults to 2. */
  headingLevel?: number

  /** Additional CSS classes for the title wrapper. */
  classes?: string
}

/**
 * Summary card configuration to wrap the summary list.
 * When provided, the summary list is wrapped in a card with a header.
 */
export interface SummaryCard {
  /** Title displayed in the card header. */
  title?: SummaryCardTitle

  /** Action links displayed in the card header. */
  actions?: SummaryListActions

  /** Additional CSS classes for the card container. */
  classes?: string

  /** Custom HTML attributes for the card container. */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Summary List component.
 *
 * Displays a list of key-value pairs, commonly used to summarise information
 * such as form answers in a "check your answers" page.
 *
 * @see https://design-system.service.gov.uk/components/summary-list/
 * @example
 * ```typescript
 * GovUKSummaryList({
 *   rows: [
 *     {
 *       key: { text: 'Name' },
 *       value: { text: 'John Smith' },
 *       actions: {
 *         items: [
 *           { href: '/change-name', text: 'Change', visuallyHiddenText: 'name' },
 *         ],
 *       },
 *     },
 *   ],
 * })
 * ```
 *
 * @example With summary card wrapper
 * ```typescript
 * GovUKSummaryList({
 *   card: {
 *     title: { text: 'Personal details' },
 *     actions: {
 *       items: [
 *         { href: '/delete', text: 'Delete', visuallyHiddenText: 'personal details' },
 *       ],
 *     },
 *   },
 *   rows: [
 *     { key: { text: 'Name' }, value: { text: 'John Smith' } },
 *     { key: { text: 'Email' }, value: { text: 'john@example.com' } },
 *   ],
 * })
 * ```
 */
export type GovUKSummaryList = ResolvableBlockProps<{
  /** The rows within the summary list. Each row contains a key-value pair. Required. */
  rows: SummaryListRow[]

  /**
   * Optional card configuration to wrap the summary list.
   * If provided, the summary list will be displayed inside a summary card
   * with an optional title and header actions.
   */
  card?: SummaryCard

  /** Additional CSS classes for the summary list dl element. */
  classes?: string

  /** Custom HTML attributes for the summary list dl element. */
  attributes?: Record<string, any>
}>

type EvaluatedSummaryListRow = EvaluatedBlock<GovUKSummaryList>['rows'][number]

function normaliseSummaryListRow(row: EvaluatedSummaryListRow) {
  return {
    ...row,
    value: normaliseSummaryListValue(row.value),
  }
}

function normaliseSummaryListValue(value: EvaluatedSummaryListRow['value'] | undefined) {
  if (!value) {
    return undefined
  }

  const { blocks, ...valueParams } = value
  const content = normaliseGovukTextHtmlContent({
    text: value.text,
    html: value.html,
    blocks,
  })

  return {
    ...valueParams,
    ...content,
  }
}

/**
 * GOV.UK Summary List component.
 *
 * Displays a list of key-value pairs, commonly used to summarise information
 * such as form answers in a "check your answers" page.
 *
 * @see https://design-system.service.gov.uk/components/summary-list/
 * @example
 * ```typescript
 * GovUKSummaryList({
 *   rows: [
 *     {
 *       key: { text: 'Name' },
 *       value: { text: 'John Smith' },
 *       actions: {
 *         items: [
 *           { href: '/change-name', text: 'Change', visuallyHiddenText: 'name' },
 *         ],
 *       },
 *     },
 *   ],
 * })
 * ```
 *
 * @example With summary card wrapper
 * ```typescript
 * GovUKSummaryList({
 *   card: {
 *     title: { text: 'Personal details' },
 *     actions: {
 *       items: [
 *         { href: '/delete', text: 'Delete', visuallyHiddenText: 'personal details' },
 *       ],
 *     },
 *   },
 *   rows: [
 *     { key: { text: 'Name' }, value: { text: 'John Smith' } },
 *     { key: { text: 'Email' }, value: { text: 'john@example.com' } },
 *   ],
 * })
 * ```
 */
export const GovUKSummaryList = nunjucksComponent<GovUKSummaryList>('govukSummaryList', {
  render: (props, nunjucksEnv) => {
    const params: Record<string, any> = {
      rows: props.rows.filter(row => row.visibleWhen !== false).map(normaliseSummaryListRow),
      card: props.card,
      classes: props.classes,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('govuk/components/summary-list/template.njk', { params })
  },
})
