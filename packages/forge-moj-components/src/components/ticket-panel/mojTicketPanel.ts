import { BlockDefinition, ComponentRenderProps } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
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
  text?: string

  /**
   * HTML content for the section.
   * Use either text or html, not both.
   *
   * @example '<h2 class="govuk-heading-m">Application details</h2><p>Reference: ABC123</p>'
   */
  html?: string

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
  classes?: string

  /**
   * Additional HTML attributes for the section.
   *
   * @example { 'aria-label': 'Application summary' }
   */
  attributes?: Record<string, string>

  /** Conditional visibility for this ticket panel item */
  visibleWhen?: boolean
}

/**
 * MOJ Ticket Panel component.
 * Displays summary information in a styled panel format.
 *
 * The panel is typically split into sections for different data. Each section can be
 * colored differently using modifier classes to distinguish between types of information.
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
export interface MOJTicketPanel {
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
  classes?: string

  /**
   * Additional HTML attributes for the ticket panel container.
   *
   * @example { 'aria-label': 'Application summary' }
   */
  attributes?: Record<string, string>
}

type RuntimeMOJTicketPanelItem = ComponentRenderProps<MOJTicketPanel>['items'][number]

function normaliseTicketPanelItem(item: RuntimeMOJTicketPanelItem) {
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

/**
 * MOJ Ticket Panel component.
 * Displays summary information in a styled panel format.
 *
 * The panel is typically split into sections for different data. Each section can be
 * colored differently using modifier classes to distinguish between types of information.
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
export const MOJTicketPanel = nunjucksComponent<MOJTicketPanel>('mojTicketPanel', {
  factory:
    ({ nunjucksEnv }) =>
    props => {
      const params = {
        items: props.items.filter(item => item.visibleWhen !== false).map(normaliseTicketPanelItem),
        classes: props.classes,
        attributes: props.attributes,
      }

      return nunjucksEnv.render('moj/components/ticket-panel/template.njk', { params })
    },
})
