import type nunjucks from 'nunjucks'

import { buildNunjucksComponent } from '@form-engine-moj-components/internal/buildNunjucksComponent'
import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalString,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

/**
 * Color variants available for ticket panel sections.
 */
export type MOJTicketPanelColor = 'blue' | 'red' | 'yellow' | 'green' | 'purple' | 'orange'

/**
 * An item (section) within the ticket panel.
 */
export interface MOJTicketPanelItem {
  /**
   * Plain text content for the section.
   * Use either text or html, not both.
   *
   * @example 'Reference: ABC123'
   */
  text?: ConditionalString

  /**
   * HTML content for the section.
   * Use either text or html, not both.
   *
   * @example '<h2 class="govuk-heading-m">Application details</h2><p>Reference: ABC123</p>'
   */
  html?: ConditionalString

  /**
   * Additional CSS classes for the section.
   * Use color classes to style sections: moj-ticket-panel__content--blue, etc.
   *
   * @example 'moj-ticket-panel__content--blue'
   */
  classes?: ConditionalString

  /**
   * Additional HTML attributes for the section.
   *
   * @example { 'aria-label': 'Application summary' }
   */
  attributes?: Record<string, ConditionalString>
}

/**
 * Props for the MOJTicketPanel component.
 *
 * The ticket panel displays summary information in a styled panel format,
 * typically with sections for different data. Each section can be colored
 * differently to distinguish between types of information.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/ticket-panel
 * @example
 * ```typescript
 * MOJTicketPanel({
 *   items: [
 *     {
 *       html: '<h2 class="govuk-heading-m">Application submitted</h2><p>Reference: ABC123</p>',
 *       classes: 'moj-ticket-panel__content--green',
 *     },
 *     {
 *       text: 'You will receive a confirmation email within 24 hours.',
 *     },
 *   ],
 * })
 * ```
 */
export interface MOJTicketPanelProps extends BasicBlockProps {
  /**
   * Array of sections to display in the ticket panel.
   * Each item represents a content section with optional styling.
   *
   * @example
   * [
   *   { html: '<h2>Details</h2><p>Content here</p>', classes: 'moj-ticket-panel__content--blue' },
   *   { text: 'Additional information' }
   * ]
   */
  items: MOJTicketPanelItem[]

  /**
   * Additional CSS classes for the ticket panel container.
   *
   * @example 'app-ticket-panel--custom'
   */
  classes?: ConditionalString

  /**
   * Additional HTML attributes for the ticket panel container.
   *
   * @example { 'aria-label': 'Application summary' }
   */
  attributes?: Record<string, ConditionalString>
}

/**
 * MOJ Ticket Panel Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `MOJTicketPanelProps` type or the `MOJTicketPanel()` wrapper function instead.
 */
export interface MOJTicketPanel extends BlockDefinition, MOJTicketPanelProps {
  /** Component variant identifier */
  variant: 'mojTicketPanel'
}

/**
 * Renders an MOJ Ticket Panel component using Nunjucks template
 */
async function ticketPanelRenderer(
  block: EvaluatedBlock<MOJTicketPanel>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  const params = {
    items: block.items,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('moj/components/ticket-panel/template.njk', { params })
}

export const mojTicketPanel = buildNunjucksComponent<MOJTicketPanel>('mojTicketPanel', ticketPanelRenderer)

/**
 * Creates an MOJ Ticket Panel block for displaying summary information.
 *
 * The ticket panel displays summary information in a styled panel format,
 * typically with sections for different data. Each section can be colored
 * differently using modifier classes to distinguish between types of information.
 *
 * Available color classes for items:
 * - moj-ticket-panel__content--blue
 * - moj-ticket-panel__content--red
 * - moj-ticket-panel__content--yellow
 * - moj-ticket-panel__content--green
 * - moj-ticket-panel__content--purple
 * - moj-ticket-panel__content--orange
 *
 * @see https://design-patterns.service.justice.gov.uk/components/ticket-panel
 * @example
 * ```typescript
 * MOJTicketPanel({
 *   attributes: { 'aria-label': 'Application summary' },
 *   items: [
 *     {
 *       html: '<h2 class="govuk-heading-m govuk-!-margin-bottom-2">Application submitted</h2>' +
 *             '<p class="govuk-body">Your reference number is <strong>ABC123</strong></p>',
 *       classes: 'moj-ticket-panel__content--green',
 *     },
 *     {
 *       text: 'We will email you within 24 hours to confirm your application.',
 *     },
 *   ],
 * })
 * ```
 */
export function MOJTicketPanel(props: MOJTicketPanelProps): MOJTicketPanel {
  return blockBuilder<MOJTicketPanel>({ ...props, variant: 'mojTicketPanel' })
}
