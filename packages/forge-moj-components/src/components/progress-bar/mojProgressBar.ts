import {
  BlockDefinition,
  ResolvableString,
  ResolvableBoolean,
  ResolvableObject,
} from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'

/**
 * Label configuration for a progress bar item.
 */
export interface MOJProgressBarItemLabel {
  /** Label text (required if html not set) */
  text?: ResolvableString

  /** Label HTML content (required if text not set) */
  html?: ResolvableString

  /** Additional CSS classes for the label element */
  classes?: ResolvableString
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
  id?: ResolvableString

  /**
   * Label for the progress item - can be a simple string or object with additional options.
   *
   * @example 'Personal details'
   * @example { text: 'Personal details', classes: 'custom-label' }
   */
  label: ResolvableString | MOJProgressBarItemLabel | ResolvableObject<MOJProgressBarItemLabel>

  /**
   * Whether this item represents the current/active step.
   * Sets `aria-current="step"` for accessibility.
   *
   * @example true // Current step
   */
  active?: ResolvableBoolean

  /**
   * Whether this step has been completed.
   * Displays a completed icon indicator.
   *
   * @example true // Step is complete
   */
  complete?: ResolvableBoolean

  /** Additional CSS classes for the item element */
  classes?: ResolvableString

  /** Additional HTML attributes for the item element */
  attributes?: Record<string, ResolvableString>

  /** Conditional visibility for this progress item */
  visibleWhen?: ResolvableBoolean
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
export interface MOJProgressBar extends BlockDefinition {
  /**
   * Unique identifier for the progress bar.
   * Defaults to "progress" if not provided.
   *
   * @example 'application-progress'
   */
  id?: ResolvableString

  /**
   * Accessible label for the progress bar (aria-label).
   * Describes the purpose of the progress indicator.
   *
   * @example 'Application progress'
   * @example 'Registration steps'
   */
  label?: ResolvableString

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
  classes?: ResolvableString

  /**
   * Additional HTML attributes for the progress bar container.
   *
   * @example { 'data-module': 'progress-tracker' }
   */
  attributes?: Record<string, ResolvableString>
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
  render: (props, nunjucksEnv) => {
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
