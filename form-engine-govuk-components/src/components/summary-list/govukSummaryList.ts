import type nunjucks from 'nunjucks'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalString,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

/**
 * Action item for summary list rows or card headers.
 * Renders as a link with optional visually hidden text for accessibility.
 */
export interface SummaryListActionItem {
  /** The value of the link's `href` attribute. Required. */
  href: ConditionalString

  /** Plain text content for the action link. Required unless html is provided. */
  text?: ConditionalString

  /** HTML content for the action link. Takes precedence over text. */
  html?: ConditionalString

  /**
   * Additional accessible text appended to the action link.
   * Useful for providing context when the action text alone is not descriptive enough.
   * For example, "Change" might need "name" appended to become "Change name".
   */
  visuallyHiddenText?: ConditionalString

  /** Additional CSS classes for the action link. */
  classes?: ConditionalString

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
  classes?: ConditionalString
}

/**
 * Key (label) for a summary list row.
 * Displays on the left side of the row as the reference/label.
 */
export interface SummaryListKey {
  /** Plain text content for the key. Required unless html is provided. */
  text?: ConditionalString

  /** HTML content for the key. Takes precedence over text. */
  html?: ConditionalString

  /** Additional CSS classes for the key wrapper. */
  classes?: ConditionalString
}

/**
 * Value for a summary list row.
 * Displays on the right side of the row as the content/answer.
 */
export interface SummaryListValue {
  /** Plain text content for the value. Required unless html is provided. */
  text?: ConditionalString

  /** HTML content for the value. Takes precedence over text. */
  html?: ConditionalString

  /** Additional CSS classes for the value wrapper. */
  classes?: ConditionalString
}

/**
 * A row in the summary list, containing a key-value pair and optional actions.
 */
export interface SummaryListRow {
  /** The reference content (key/label) for this row. Required. */
  key: SummaryListKey

  /** The value content for this row. Required. */
  value: SummaryListValue

  /** Optional action links for this row (e.g., "Change", "Remove"). */
  actions?: SummaryListActions

  /** Additional CSS classes for the row div element. */
  classes?: ConditionalString
}

/**
 * Title configuration for a summary card header.
 */
export interface SummaryCardTitle {
  /** Plain text content for the card title. Takes precedence if html is not provided. */
  text?: ConditionalString

  /** HTML content for the card title. Takes precedence over text. */
  html?: ConditionalString

  /** Heading level for the title, from 1 to 6. Defaults to 2. */
  headingLevel?: number

  /** Additional CSS classes for the title wrapper. */
  classes?: ConditionalString
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
  classes?: ConditionalString

  /** Custom HTML attributes for the card container. */
  attributes?: Record<string, any>
}

/**
 * Props for the GovUKSummaryList component.
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
 *     {
 *       key: { text: 'Date of birth' },
 *       value: { text: '5 January 1978' },
 *       actions: {
 *         items: [
 *           { href: '/change-dob', text: 'Change', visuallyHiddenText: 'date of birth' },
 *         ],
 *       },
 *     },
 *   ],
 * })
 * ```
 */
export interface GovUKSummaryListProps extends BasicBlockProps {
  /** The rows within the summary list. Each row contains a key-value pair. Required. */
  rows: SummaryListRow[]

  /**
   * Optional card configuration to wrap the summary list.
   * If provided, the summary list will be displayed inside a summary card
   * with an optional title and header actions.
   */
  card?: SummaryCard

  /** Additional CSS classes for the summary list dl element. */
  classes?: ConditionalString

  /** Custom HTML attributes for the summary list dl element. */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Summary List Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKSummaryListProps` type or the `GovUKSummaryList()` wrapper function instead.
 */
export interface GovUKSummaryList extends BlockDefinition, GovUKSummaryListProps {
  /** Component variant identifier */
  variant: 'govukSummaryList'
}

/**
 * Renders the GOV.UK Summary List component using the official Nunjucks template.
 */
async function summaryListRenderer(
  block: EvaluatedBlock<GovUKSummaryList>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  const params: Record<string, any> = {
    rows: block.rows,
    card: block.card,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('govuk/components/summary-list/template.njk', { params })
}

export const govukSummaryList = buildNunjucksComponent<GovUKSummaryList>('govukSummaryList', summaryListRenderer)

/**
 * Creates a GOV.UK Summary List for displaying key-value pairs.
 * Commonly used on "check your answers" pages to summarise form data.
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
export function GovUKSummaryList(props: GovUKSummaryListProps): GovUKSummaryList {
  return blockBuilder<GovUKSummaryList>({ ...props, variant: 'govukSummaryList' })
}
