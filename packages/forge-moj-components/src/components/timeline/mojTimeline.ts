import { BlockDefinition, ComponentRenderProps } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import { normaliseMojTextHtmlContent } from '../../utils/mojParamNormalisers'

/**
 * Label configuration for a timeline item.
 * Displayed as the title/heading of the timeline event.
 */
export interface MOJTimelineItemLabel {
  /** Label text (required if html not set) */
  text?: string

  /** Label HTML content (required if text not set) */
  html?: string
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
  timestamp: string

  /**
   * Standard date format type (use instead of format).
   * Options: 'datetime', 'shortdatetime', 'date', 'shortdate', 'time'
   * @example 'datetime' // Full date and time
   * @example 'date' // Date only
   */
  type?: 'datetime' | 'shortdatetime' | 'date' | 'shortdate' | 'time'

  /**
   * Custom date format string (use instead of type).
   * Uses Moment.js format strings.
   * @see https://momentjs.com/docs/#/displaying/format/
   * @example 'DD/MM/YYYY'
   * @example 'dddd, MMMM Do YYYY, h:mm:ss a'
   */
  format?: string
}

/**
 * Byline configuration for a timeline item.
 * Displays who performed or is associated with the event.
 */
export interface MOJTimelineItemByline {
  /** Byline text (required if html not set) */
  text?: string

  /** Byline HTML content (required if text not set) */
  html?: string
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
  text?: string

  /**
   * HTML description of the event.
   * Use either text or html, not both.
   * @example '<p>Your application has been <strong>approved</strong>.</p>'
   */
  html?: string

  /**
   * Child blocks to render as the event description.
   * Takes precedence over text/html.
   */
  blocks?: BlockDefinition[]

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
  classes?: string

  /** Additional HTML attributes for this timeline item */
  attributes?: Record<string, string>

  /**
   * Conditional visibility for this timeline item. When the evaluated value is `false`,
   * the item is omitted from rendering. Defaults to showing the item.
   */
  visibleWhen?: boolean
}

/**
 * MOJ Timeline component.
 * Displays a chronological list of events.
 *
 * The timeline is used to show a history of events or actions,
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
export interface MOJTimeline {
  /**
   * Array of timeline items to display.
   * Items are displayed in the order provided (typically most recent first).
   */
  items: MOJTimelineItem[]

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
  classes?: string

  /**
   * Additional HTML attributes for the timeline container.
   * @example { 'data-module': 'app-timeline' }
   */
  attributes?: Record<string, string>
}

type RuntimeMOJTimelineItem = ComponentRenderProps<MOJTimeline>['items'][number]

function normaliseTimelineItem(item: RuntimeMOJTimelineItem) {
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
 * MOJ Timeline component.
 * Displays a chronological list of events.
 *
 * The timeline is used to show a history of events or actions,
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
export const MOJTimeline = nunjucksComponent<MOJTimeline>('mojTimeline', {
  factory:
    ({ nunjucksEnv }) =>
    ({ props }) => {
      const params = {
        items: props.items.filter(item => item.visibleWhen !== false).map(normaliseTimelineItem),
        headingLevel: props.headingLevel,
        classes: props.classes,
        attributes: props.attributes,
      }

      return nunjucksEnv.render('moj/components/timeline/template.njk', { params })
    },
})
