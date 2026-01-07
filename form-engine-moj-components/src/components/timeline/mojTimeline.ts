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
 * Label configuration for a timeline item.
 * Displayed as the title/heading of the timeline event.
 */
export interface MOJTimelineItemLabel {
  /** Label text (required if html not set) */
  text?: ConditionalString

  /** Label HTML content (required if text not set) */
  html?: ConditionalString
}

/**
 * Datetime configuration for a timeline item.
 * Controls how the timestamp is formatted and displayed.
 */
export interface MOJTimelineItemDatetime {
  /**
   * A valid datetime string to be formatted.
   * @example '2019-06-14T14:01:00.000Z'
   */
  timestamp: ConditionalString

  /**
   * Standard date format type (use instead of format).
   * Options: 'datetime', 'shortdatetime', 'date', 'shortdate', 'time'
   * @example 'datetime' // Full date and time
   * @example 'date' // Date only
   */
  type?: 'datetime' | 'shortdatetime' | 'date' | 'shortdate' | 'time' | ConditionalString

  /**
   * Custom date format string (use instead of type).
   * Uses Moment.js format strings.
   * @see https://momentjs.com/docs/#/displaying/format/
   * @example 'DD/MM/YYYY'
   * @example 'dddd, MMMM Do YYYY, h:mm:ss a'
   */
  format?: ConditionalString
}

/**
 * Byline configuration for a timeline item.
 * Displays who performed or is associated with the event.
 */
export interface MOJTimelineItemByline {
  /** Byline text (required if html not set) */
  text?: ConditionalString

  /** Byline HTML content (required if text not set) */
  html?: ConditionalString
}

/**
 * Timeline item configuration.
 * Represents a single event in the timeline.
 */
export interface MOJTimelineItem {
  /**
   * The label/title of the timeline event.
   * @example { text: 'Application submitted' }
   */
  label: MOJTimelineItemLabel

  /**
   * Plain text description of the event.
   * Use either text or html, not both.
   * @example 'Your application has been received.'
   */
  text?: ConditionalString

  /**
   * HTML description of the event.
   * Use either text or html, not both.
   * @example '<p>Your application has been <strong>approved</strong>.</p>'
   */
  html?: ConditionalString

  /**
   * Date and time of the event.
   * @example { timestamp: '2019-06-14T14:01:00.000Z', type: 'datetime' }
   */
  datetime?: MOJTimelineItemDatetime

  /**
   * Who performed or is associated with the event.
   * @example { text: 'Joe Bloggs' }
   */
  byline?: MOJTimelineItemByline

  /** Additional CSS classes for this timeline item */
  classes?: ConditionalString

  /** Additional HTML attributes for this timeline item */
  attributes?: Record<string, ConditionalString>
}

/**
 * Props for the MOJTimeline component.
 *
 * The timeline component displays a chronological list of events.
 * Each item has a label, optional description, timestamp, and byline.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/timeline
 * @example
 * ```typescript
 * MOJTimeline({
 *   items: [
 *     {
 *       label: { text: 'Application submitted' },
 *       text: 'Your application has been received.',
 *       datetime: { timestamp: '2019-06-14T14:01:00.000Z', type: 'datetime' },
 *       byline: { text: 'Joe Bloggs' },
 *     },
 *     {
 *       label: { text: 'Application started' },
 *       text: 'You began your application.',
 *       datetime: { timestamp: '2019-06-01T09:00:00.000Z', type: 'datetime' },
 *       byline: { text: 'Joe Bloggs' },
 *     },
 *   ],
 * })
 * ```
 */
export interface MOJTimelineProps extends BasicBlockProps {
  /**
   * Array of timeline items to display.
   * Items are displayed in the order provided (typically most recent first).
   */
  items: ConditionalArray<MOJTimelineItem>

  /**
   * Heading level for timeline item labels.
   * Default: 2
   * @example 3 // Use h3 for item labels
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6

  /**
   * Additional CSS classes for the timeline container.
   * @example 'app-timeline--custom'
   */
  classes?: ConditionalString

  /**
   * Additional HTML attributes for the timeline container.
   * @example { 'data-module': 'app-timeline' }
   */
  attributes?: Record<string, ConditionalString>
}

/**
 * MOJ Timeline Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `MOJTimelineProps` type or the `MOJTimeline()` wrapper function instead.
 */
export interface MOJTimeline extends BlockDefinition, MOJTimelineProps {
  /** Component variant identifier */
  variant: 'mojTimeline'
}

/**
 * Renders an MOJ Timeline component using Nunjucks template
 */
async function timelineRenderer(
  block: EvaluatedBlock<MOJTimeline>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  const params = {
    items: block.items,
    headingLevel: block.headingLevel,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('moj/components/timeline/template.njk', { params })
}

export const mojTimeline = buildNunjucksComponent<MOJTimeline>('mojTimeline', timelineRenderer)

/**
 * Creates an MOJ Timeline block for displaying chronological events.
 *
 * The timeline component is used to show a history of events or actions,
 * typically displayed with the most recent event first. Each event includes
 * a label, optional description, timestamp, and byline (who did it).
 *
 * @see https://design-patterns.service.justice.gov.uk/components/timeline
 * @example
 * ```typescript
 * MOJTimeline({
 *   items: [
 *     {
 *       label: { text: 'Application approved' },
 *       text: 'Your application has been approved.',
 *       datetime: { timestamp: '2019-06-14T14:01:00.000Z', type: 'datetime' },
 *       byline: { text: 'Caseworker 1' },
 *     },
 *     {
 *       label: { text: 'Application submitted' },
 *       html: '<p>Documents uploaded: <strong>3 files</strong></p>',
 *       datetime: { timestamp: '2019-06-01T09:00:00.000Z', type: 'datetime' },
 *       byline: { text: 'Joe Bloggs' },
 *     },
 *   ],
 *   headingLevel: 3,
 * })
 * ```
 */
export function MOJTimeline(props: MOJTimelineProps): MOJTimeline {
  return blockBuilder<MOJTimeline>({ ...props, variant: 'mojTimeline' })
}
