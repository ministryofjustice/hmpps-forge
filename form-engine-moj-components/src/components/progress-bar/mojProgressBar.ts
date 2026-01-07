import type nunjucks from 'nunjucks'

import { buildNunjucksComponent } from '@form-engine-moj-components/internal/buildNunjucksComponent'
import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalString,
  ConditionalBoolean,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

/**
 * Label configuration for a progress bar item.
 */
export interface MOJProgressBarItemLabel {
  /** Label text (required if html not set) */
  text?: ConditionalString

  /** Label HTML content (required if text not set) */
  html?: ConditionalString

  /** Additional CSS classes for the label element */
  classes?: ConditionalString
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
  id?: ConditionalString

  /**
   * Label for the progress item - can be a simple string or object with additional options.
   *
   * @example 'Personal details'
   * @example { text: 'Personal details', classes: 'custom-label' }
   */
  label: ConditionalString | MOJProgressBarItemLabel

  /**
   * Whether this item represents the current/active step.
   * Sets `aria-current="step"` for accessibility.
   *
   * @example true // Current step
   */
  active?: ConditionalBoolean

  /**
   * Whether this step has been completed.
   * Displays a completed icon indicator.
   *
   * @example true // Step is complete
   */
  complete?: ConditionalBoolean

  /** Additional CSS classes for the item element */
  classes?: ConditionalString

  /** Additional HTML attributes for the item element */
  attributes?: Record<string, ConditionalString>
}

/**
 * Props for the MOJProgressBar component.
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
export interface MOJProgressBarProps extends BasicBlockProps {
  /**
   * Unique identifier for the progress bar.
   * Defaults to "progress" if not provided.
   *
   * @example 'application-progress'
   */
  id?: ConditionalString

  /**
   * Accessible label for the progress bar (aria-label).
   * Describes the purpose of the progress indicator.
   *
   * @example 'Application progress'
   * @example 'Registration steps'
   */
  label?: ConditionalString

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
  classes?: ConditionalString

  /**
   * Additional HTML attributes for the progress bar container.
   *
   * @example { 'data-module': 'progress-tracker' }
   */
  attributes?: Record<string, ConditionalString>
}

/**
 * MOJ Progress Bar Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `MOJProgressBarProps` type or the `MOJProgressBar()` wrapper function instead.
 */
export interface MOJProgressBar extends BlockDefinition, MOJProgressBarProps {
  /** Component variant identifier */
  variant: 'mojProgressBar'
}

/**
 * Renders an MOJ Progress Bar component using Nunjucks template
 */
async function progressBarRenderer(
  block: EvaluatedBlock<MOJProgressBar>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  const params = {
    id: block.id,
    label: block.label,
    items: block.items.map(item => ({
      id: item.id,
      label: typeof item.label === 'object' ? item.label : { text: item.label },
      active: item.active,
      complete: item.complete,
      classes: item.classes,
      attributes: item.attributes,
    })),
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('moj/components/progress-bar/template.njk', { params })
}

export const mojProgressBar = buildNunjucksComponent<MOJProgressBar>('mojProgressBar', progressBarRenderer)

/**
 * Creates an MOJ Progress Bar block for displaying progress through a multi-step journey.
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
export function MOJProgressBar(props: MOJProgressBarProps): MOJProgressBar {
  return blockBuilder<MOJProgressBar>({ ...props, variant: 'mojProgressBar' })
}
