import { nunjucksComponent } from '../../utils/nunjucksComponent'

/**
 * Label configuration for a progress bar item.
 */
export interface MOJProgressBarItemLabel {
  /** Label text (required if html not set) */
  text?: string

  /** Label HTML content (required if text not set) */
  html?: string

  /** Additional CSS classes for the label element */
  classes?: string
}

/**
 * Configuration for an individual progress bar item.
 */
export interface MOJProgressBarItem {
  /**
   * Unique identifier for the item.
   * Defaults to "progress-item-{index}" if not provided.
   *
   * @example 'step-1'
   */
  id?: string

  /**
   * Label for the progress item - can be a simple string or object with additional options.
   *
   * @example 'Personal details'
   * @example { text: 'Personal details', classes: 'custom-label' }
   */
  label: string | MOJProgressBarItemLabel

  /**
   * Whether this item represents the current/active step.
   * Sets `aria-current="step"` for accessibility.
   *
   * @example true // Current step
   */
  active?: boolean

  /**
   * Whether this step has been completed.
   * Displays a completed icon indicator.
   *
   * @example true // Step is complete
   */
  complete?: boolean

  /** Additional CSS classes for the item element */
  classes?: string

  /** Additional HTML attributes for the item element */
  attributes?: Record<string, string>

  /** Conditional visibility for this progress item */
  visibleWhen?: boolean
}

/**
 * MOJ Progress Bar component.
 *
 * The progress bar component shows users where they are in a linear process
 * with multiple steps. It displays completed steps, the current step, and
 * upcoming steps.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/progress-bar
 * @example
 * ```typescript
 * MOJProgressBar({
 *   label: 'Application progress',
 *   items: [
 *     { label: 'Personal details', complete: true },
 *     { label: 'Contact information', active: true },
 *     { label: 'Review and submit' },
 *   ],
 * })
 * ```
 */
export interface MOJProgressBar {
  /**
   * Unique identifier for the progress bar.
   * Defaults to "progress" if not provided.
   *
   * @example 'application-progress'
   */
  id?: string

  /**
   * Accessible label for the progress bar (aria-label).
   * Describes the purpose of the progress indicator.
   *
   * @example 'Application progress'
   * @example 'Registration steps'
   */
  label?: string

  /**
   * Array of progress items representing each step in the journey.
   * Items should be ordered from first to last step.
   *
   * @example
   * ```typescript
   * [
   *   { label: 'Personal details', complete: true },
   *   { label: 'Contact information', active: true },
   *   { label: 'Review and submit' },
   * ]
   * ```
   */
  items: MOJProgressBarItem[]

  /**
   * Additional CSS classes for the progress bar container.
   *
   * @example 'app-progress-bar--custom'
   */
  classes?: string

  /**
   * Additional HTML attributes for the progress bar container.
   *
   * @example { 'data-module': 'progress-tracker' }
   */
  attributes?: Record<string, string>
}

/**
 * MOJ Progress Bar component.
 *
 * The progress bar component shows users where they are in a linear process
 * with multiple steps. It displays completed steps, the current step, and
 * upcoming steps.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/progress-bar
 * @example
 * ```typescript
 * MOJProgressBar({
 *   label: 'Application progress',
 *   items: [
 *     { label: 'Personal details', complete: true },
 *     { label: 'Contact information', active: true },
 *     { label: 'Review and submit' },
 *   ],
 * })
 * ```
 */
export const MOJProgressBar = nunjucksComponent<MOJProgressBar>('mojProgressBar', {
  factory:
    ({ nunjucksEnv }) =>
    ({ props }) => {
      const params = {
        id: props.id,
        label: props.label,
        items: props.items
          .filter(item => item.visibleWhen !== false)
          .map(item => ({
            id: item.id,
            label: typeof item.label === 'object' ? item.label : { text: item.label },
            active: item.active,
            complete: item.complete,
            classes: item.classes,
            attributes: item.attributes,
          })),
        classes: props.classes,
        attributes: props.attributes,
      }

      return nunjucksEnv.render('moj/components/progress-bar/template.njk', { params })
    },
})
