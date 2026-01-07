import type nunjucks from 'nunjucks'

import { buildNunjucksComponent } from '@form-engine-moj-components/internal/buildNunjucksComponent'
import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalString,
  ConditionalArray,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

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
  text?: ConditionalString

  /**
   * HTML content of the message.
   * Use either text or html, not both.
   * @example '<p>Please see the <strong>attached document</strong>.</p>'
   */
  html?: ConditionalString

  /**
   * Message type indicating direction.
   * - 'sent': Outgoing message (blue, right-aligned)
   * - 'received': Incoming message (grey, left-aligned)
   */
  type: MOJMessageType | ConditionalString

  /**
   * The sender of the message.
   * Displayed in the message metadata.
   * @example 'John Smith'
   * @example 'Support Agent'
   */
  sender: ConditionalString

  /**
   * Timestamp of when the message was sent.
   * Must be a valid datetime string. Messages are grouped by date.
   * @example '2019-06-14T14:01:00.000Z'
   * @example '2023-12-25T09:30:00.000Z'
   */
  timestamp: ConditionalString
}

/**
 * Props for the MOJMessages component.
 *
 * The messages component displays a thread of messages with sender info,
 * content, and timestamps. Messages are visually differentiated between
 * sent (blue, right-aligned) and received (grey, left-aligned).
 *
 * @see https://design-patterns.service.justice.gov.uk/components/messages
 * @example
 * ```typescript
 * MOJMessages({
 *   items: [
 *     {
 *       id: 1,
 *       text: 'Hello, how can I help you today?',
 *       type: 'received',
 *       sender: 'Support Agent',
 *       timestamp: '2019-06-14T10:00:00.000Z',
 *     },
 *     {
 *       id: 2,
 *       text: 'I need help with my application.',
 *       type: 'sent',
 *       sender: 'John Smith',
 *       timestamp: '2019-06-14T10:05:00.000Z',
 *     },
 *   ],
 * })
 * ```
 */
export interface MOJMessagesProps extends BasicBlockProps {
  /**
   * Array of message items to display.
   * Messages are displayed in the order provided, grouped by date.
   */
  items: ConditionalArray<MOJMessageItem>

  /**
   * ID for the messages container element.
   * Defaults to 'messages' if not specified.
   * @example 'case-messages'
   */
  id?: ConditionalString

  /**
   * Accessible label for the messages container.
   * Applied as aria-label attribute.
   * @example 'Case correspondence'
   */
  label?: ConditionalString

  /**
   * Additional CSS classes for the messages container.
   * @example 'app-messages--compact'
   */
  classes?: ConditionalString

  /**
   * Additional HTML attributes for the messages container.
   * @example { 'data-module': 'app-messages' }
   */
  attributes?: Record<string, ConditionalString>
}

/**
 * MOJ Messages Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `MOJMessagesProps` type or the `MOJMessages()` wrapper function instead.
 */
export interface MOJMessages extends BlockDefinition, MOJMessagesProps {
  /** Component variant identifier */
  variant: 'mojMessages'
}

/**
 * Renders an MOJ Messages component using Nunjucks template
 */
async function messagesRenderer(
  block: EvaluatedBlock<MOJMessages>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  const params = {
    items: block.items,
    id: block.id,
    label: block.label,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('moj/components/messages/template.njk', { params })
}

export const mojMessages = buildNunjucksComponent<MOJMessages>('mojMessages', messagesRenderer)

/**
 * Creates an MOJ Messages block for displaying a thread of messages.
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
export function MOJMessages(props: MOJMessagesProps): MOJMessages {
  return blockBuilder<MOJMessages>({ ...props, variant: 'mojMessages' })
}
