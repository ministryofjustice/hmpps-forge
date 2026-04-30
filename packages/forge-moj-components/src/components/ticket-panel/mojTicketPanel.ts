import type nunjucks from 'nunjucks'

import {
  BasicBlockProps,
  BlockDefinition,
  ResolvableBoolean,
  ResolvableString,
  EvaluatedBlock,
} from '@ministryofjustice/hmpps-forge/core/components'
import { buildNunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'
import { block as buildBlock } from '@ministryofjustice/hmpps-forge/core/authoring'
import { normaliseMojTextHtmlContent } from '../../utils/mojParamNormalisers'

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
  text?: ResolvableString

  /**
   * HTML content for the section.
   * Use either text or html, not both.
   *
   * @example '<h2 class="govuk-heading-m">Application details</h2><p>Reference: ABC123</p>'
   */
  html?: ResolvableString

  /**
   * Child blocks to render in the section.
   * Takes precedence over text/html.
   */
  blocks?: BlockDefinition[]

  /**
   * Additional CSS classes for the section.
   * Use color classes to style sections: moj-ticket-panel__content--blue, etc.
   *
   * @example 'moj-ticket-panel__content--blue'
   */
  classes?: ResolvableString

  /**
   * Additional HTML attributes for the section.
   *
   * @example { 'aria-label': 'Application summary' }
   */
  attributes?: Record<string, ResolvableString>

  /** Conditional visibility for this ticket panel item */
  visibleWhen?: ResolvableBoolean
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
  classes?: ResolvableString

  /**
   * Additional HTML attributes for the ticket panel container.
   *
   * @example { 'aria-label': 'Application summary' }
   */
  attributes?: Record<string, ResolvableString>
}

/**
 * MOJ Ticket Panel Component
 *
 * Full interface including forge discriminator properties.
 * For most use cases, use `MOJTicketPanelProps` type or the `MOJTicketPanel()` wrapper function instead.
 */
export interface MOJTicketPanel extends BlockDefinition, MOJTicketPanelProps {
  /** Component variant identifier */
  variant: 'mojTicketPanel'
}

type EvaluatedMOJTicketPanelItem = EvaluatedBlock<MOJTicketPanel>['items'][number]

/**
 * Renders an MOJ Ticket Panel component using Nunjucks template
 */
function ticketPanelRenderer(block: EvaluatedBlock<MOJTicketPanel>, nunjucksEnv: nunjucks.Environment): string {
  const params = {
    items: block.items.filter(item => item.visibleWhen !== false).map(normaliseTicketPanelItem),
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('moj/components/ticket-panel/template.njk', { params })
}

function normaliseTicketPanelItem(item: EvaluatedMOJTicketPanelItem) {
  const { blocks, ...itemParams } = item
  const content = normaliseMojTextHtmlContent({
    text: item.text,
    html: item.html,
    blocks,
  })

  return {
    ...itemParams,
    ...content,
  }
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
  return buildBlock<MOJTicketPanel>({ ...props, variant: 'mojTicketPanel' })
}
