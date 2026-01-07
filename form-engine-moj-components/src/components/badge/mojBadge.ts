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
 * Available badge colour classes.
 * Use these to style the badge appearance.
 */
export type MOJBadgeColour =
  | 'moj-badge--purple'
  | 'moj-badge--light-purple'
  | 'moj-badge--bright-purple'
  | 'moj-badge--pink'
  | 'moj-badge--light-pink'
  | 'moj-badge--red'
  | 'moj-badge--orange'
  | 'moj-badge--brown'
  | 'moj-badge--yellow'
  | 'moj-badge--light-green'
  | 'moj-badge--green'
  | 'moj-badge--turquoise'
  | 'moj-badge--light-blue'
  | 'moj-badge--blue'
  | 'moj-badge--black'
  | 'moj-badge--dark-grey'
  | 'moj-badge--mid-grey'
  | 'moj-badge--light-grey'
  | 'moj-badge--white'

/**
 * Props for the MOJBadge component.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/badge
 * @example
 * ```typescript
 * MOJBadge({
 *   text: 'Urgent',
 *   classes: 'moj-badge--red',
 * })
 * ```
 */
export interface MOJBadgeProps extends BasicBlockProps {
  /**
   * Plain text content for the badge.
   * Use either text or html, not both.
   *
   * @example 'Complete'
   * @example 'In progress'
   */
  text?: ConditionalString

  /**
   * HTML content for the badge.
   * Use either text or html, not both.
   *
   * @example '<strong>Urgent</strong>'
   */
  html?: ConditionalString

  /**
   * CSS classes for the badge container.
   * Use moj-badge--{colour} classes to style the badge.
   *
   * @example 'moj-badge--blue'
   * @example 'moj-badge--red moj-badge--large'
   */
  classes?: MOJBadgeColour | ConditionalString

  /**
   * Accessible label for the badge.
   * Sets the aria-label attribute for screen readers.
   *
   * @example 'Status: Complete'
   */
  label?: ConditionalString

  /**
   * Additional HTML attributes for the badge container.
   *
   * @example { 'data-status': 'complete' }
   */
  attributes?: Record<string, ConditionalString>
}

/**
 * MOJ Badge Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `MOJBadgeProps` type or the `MOJBadge()` wrapper function instead.
 */
export interface MOJBadge extends BlockDefinition, MOJBadgeProps {
  /** Component variant identifier */
  variant: 'mojBadge'
}

/**
 * Renders an MOJ Badge component using Nunjucks template
 */
async function badgeRenderer(block: EvaluatedBlock<MOJBadge>, nunjucksEnv: nunjucks.Environment): Promise<string> {
  const params = {
    text: block.text,
    html: block.html,
    classes: block.classes,
    label: block.label,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('moj/components/badge/template.njk', { params })
}

export const mojBadge = buildNunjucksComponent<MOJBadge>('mojBadge', badgeRenderer)

/**
 * Creates an MOJ Badge block for displaying status indicators.
 *
 * The badge component is used to highlight small status or category labels.
 * It can be styled with different colours to indicate different states.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/badge
 * @example
 * ```typescript
 * MOJBadge({
 *   text: 'Urgent',
 *   classes: 'moj-badge--red',
 * })
 * ```
 *
 * @example
 * ```typescript
 * MOJBadge({
 *   text: 'Complete',
 *   classes: 'moj-badge--green',
 *   label: 'Status: Complete',
 * })
 * ```
 */
export function MOJBadge(props: MOJBadgeProps): MOJBadge {
  return blockBuilder<MOJBadge>({ ...props, variant: 'mojBadge' })
}
