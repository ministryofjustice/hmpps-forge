import { BlockDefinition, ComponentRenderProps } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import { normaliseMojTextHtmlContent } from '../../utils/mojParamNormalisers'

/**
 * Message type indicating whether the message was sent or received.
 * - 'sent': Blue message aligned to the right (outgoing message)
 * - 'received': Grey message aligned to the left (incoming message)
 */
export type MOJMessageType = 'sent' | 'received'

/**
 * Message item configuration.
 * Represents a single message in the thread.
 */
export interface MOJMessageItem {
  /**
   * Unique ID for the message.
   * Used to generate element IDs for targeting specific messages.
   * @example 1
   * @example 'msg-001'
   */
  id?: string | number

  /**
   * Plain text content of the message.
   * Use either text or html, not both.
   * @example 'Hello, how can I help you today?'
   */
  text?: string

  /**
   * HTML content of the message.
   * Use either text or html, not both.
   * @example '<p>Please see the <strong>attached document</strong>.</p>'
   */
  html?: string

  /**
   * Child blocks to render as the message content.
   * Takes precedence over text/html.
   */
  blocks?: BlockDefinition[]

  /**
   * Message type indicating direction.
   * - 'sent': Outgoing message (blue, right-aligned)
   * - 'received': Incoming message (grey, left-aligned)
   */
  type: MOJMessageType

  /**
   * The sender of the message.
   * Displayed in the message metadata.
   * @example 'John Smith'
   * @example 'Support Agent'
   */
  sender: string

  /**
   * Timestamp of when the message was sent.
   * Must be a valid datetime string. Messages are grouped by date.
   * @example '2019-06-14T14:01:00.000Z'
   * @example '2023-12-25T09:30:00.000Z'
   */
  timestamp: string

  /** Conditional visibility for this message */
  visibleWhen?: boolean
}

/**
 * MOJ Messages component.
 *
 * The messages component displays a conversation thread between two or more
 * parties. Messages are visually differentiated:
 * - Sent messages (type: 'sent'): Blue background, aligned right
 * - Received messages (type: 'received'): Grey background, aligned left
 *
 * Messages are automatically grouped by date, with date headers shown
 * when the date changes between messages.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/messages
 * @example
 * ```typescript
 * MOJMessages({
 *   items: [
 *     {
 *       id: 1,
 *       text: 'Lorem ipsum dolor sit amet.',
 *       type: 'sent',
 *       sender: 'Person A',
 *       timestamp: '2018-10-16T10:50:00.000Z',
 *     },
 *     {
 *       id: 2,
 *       text: 'Nullam vestibulum lorem vulputate.',
 *       type: 'received',
 *       sender: 'Person B',
 *       timestamp: '2018-10-17T10:51:00.000Z',
 *     },
 *     {
 *       id: 3,
 *       html: '<p>Message with <strong>HTML</strong> content.</p>',
 *       type: 'sent',
 *       sender: 'Person A',
 *       timestamp: '2018-10-19T10:53:00.000Z',
 *     },
 *   ],
 *   label: 'Case correspondence',
 * })
 * ```
 */
export interface MOJMessages {
  /**
   * Array of message items to display.
   * Messages are displayed in the order provided, grouped by date.
   */
  items: MOJMessageItem[]

  /**
   * ID for the messages container element.
   * Defaults to 'messages' if not specified.
   * @example 'case-messages'
   */
  id?: string

  /**
   * Accessible label for the messages container.
   * Applied as aria-label attribute.
   * @example 'Case correspondence'
   */
  label?: string

  /**
   * Additional CSS classes for the messages container.
   * @example 'app-messages--compact'
   */
  classes?: string

  /**
   * Additional HTML attributes for the messages container.
   * @example { 'data-module': 'app-messages' }
   */
  attributes?: Record<string, string>
}

type RuntimeMOJMessageItem = ComponentRenderProps<MOJMessages>['items'][number]

function normaliseMessageItem(item: RuntimeMOJMessageItem) {
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
 * MOJ Messages component.
 *
 * The messages component displays a conversation thread between two or more
 * parties. Messages are visually differentiated:
 * - Sent messages (type: 'sent'): Blue background, aligned right
 * - Received messages (type: 'received'): Grey background, aligned left
 *
 * Messages are automatically grouped by date, with date headers shown
 * when the date changes between messages.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/messages
 * @example
 * ```typescript
 * MOJMessages({
 *   items: [
 *     {
 *       id: 1,
 *       text: 'Lorem ipsum dolor sit amet.',
 *       type: 'sent',
 *       sender: 'Person A',
 *       timestamp: '2018-10-16T10:50:00.000Z',
 *     },
 *     {
 *       id: 2,
 *       text: 'Nullam vestibulum lorem vulputate.',
 *       type: 'received',
 *       sender: 'Person B',
 *       timestamp: '2018-10-17T10:51:00.000Z',
 *     },
 *     {
 *       id: 3,
 *       html: '<p>Message with <strong>HTML</strong> content.</p>',
 *       type: 'sent',
 *       sender: 'Person A',
 *       timestamp: '2018-10-19T10:53:00.000Z',
 *     },
 *   ],
 *   label: 'Case correspondence',
 * })
 * ```
 */
export const MOJMessages = nunjucksComponent<MOJMessages>('mojMessages', {
  factory:
    ({ nunjucksEnv }) =>
    props => {
      const params = {
        items: props.items.filter(item => item.visibleWhen !== false).map(normaliseMessageItem),
        id: props.id,
        label: props.label,
        classes: props.classes,
        attributes: props.attributes,
      }

      return nunjucksEnv.render('moj/components/messages/template.njk', { params })
    },
})
