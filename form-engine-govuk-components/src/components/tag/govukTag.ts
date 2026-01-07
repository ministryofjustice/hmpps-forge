import type nunjucks from 'nunjucks'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalString,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

/**
 * Props for the GovUKTag component.
 *
 * Use this to display a status indicator, phase banner label, or other short
 * piece of information that needs to stand out from surrounding content.
 *
 * Different colours can be applied using the `classes` property with modifier
 * classes like `govuk-tag--grey`, `govuk-tag--green`, `govuk-tag--turquoise`,
 * `govuk-tag--blue`, `govuk-tag--light-blue`, `govuk-tag--purple`, `govuk-tag--pink`,
 * `govuk-tag--red`, `govuk-tag--orange`, or `govuk-tag--yellow`.
 *
 * @see https://design-system.service.gov.uk/components/tag/
 * @example
 * ```typescript
 * GovUKTag({
 *   text: 'Completed',
 *   classes: 'govuk-tag--green',
 * })
 * ```
 */
export interface GovUKTagProps extends BasicBlockProps {
  /**
   * Plain text content for the tag.
   * Required unless `html` is provided.
   * If `html` is provided, this option will be ignored.
   */
  text?: ConditionalString

  /**
   * HTML content for the tag.
   * Takes precedence over `text` if both are provided.
   * Use this when you need to include HTML elements within the tag.
   */
  html?: ConditionalString

  /**
   * Additional CSS classes to add to the tag.
   * Use modifier classes to change the tag colour:
   * - `govuk-tag--grey` - Grey tag for inactive or default states
   * - `govuk-tag--green` - Green tag for success or completed states
   * - `govuk-tag--turquoise` - Turquoise tag
   * - `govuk-tag--blue` - Blue tag (default colour if no modifier)
   * - `govuk-tag--light-blue` - Light blue tag
   * - `govuk-tag--purple` - Purple tag
   * - `govuk-tag--pink` - Pink tag
   * - `govuk-tag--red` - Red tag for errors or urgent states
   * - `govuk-tag--orange` - Orange tag for warnings
   * - `govuk-tag--yellow` - Yellow tag for pending or attention states
   */
  classes?: ConditionalString

  /**
   * HTML attributes (for example data attributes) to add to the tag.
   * Useful for adding custom data attributes or ARIA attributes.
   */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Tag component interface.
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKTagProps` type or the `GovUKTag()` wrapper function instead.
 */
export interface GovUKTag extends BlockDefinition, GovUKTagProps {
  /** Component variant identifier */
  variant: 'govukTag'
}

/**
 * Renders the GOV.UK Tag component using the official Nunjucks template.
 */
async function tagRenderer(block: EvaluatedBlock<GovUKTag>, nunjucksEnv: nunjucks.Environment): Promise<string> {
  const params: Record<string, any> = {
    text: block.html ? undefined : block.text,
    html: block.html,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('govuk/components/tag/template.njk', { params })
}

export const govukTag = buildNunjucksComponent<GovUKTag>('govukTag', tagRenderer)

/**
 * Creates a GOV.UK Tag block for displaying status indicators or labels.
 * Tags are compact, coloured labels used to show the status of something,
 * like a phase banner or task status.
 *
 * @see https://design-system.service.gov.uk/components/tag/
 * @example
 * ```typescript
 * // Default blue tag
 * GovUKTag({
 *   text: 'Active',
 * })
 *
 * // Green tag for completed status
 * GovUKTag({
 *   text: 'Completed',
 *   classes: 'govuk-tag--green',
 * })
 *
 * // Red tag for error status
 * GovUKTag({
 *   text: 'Failed',
 *   classes: 'govuk-tag--red',
 * })
 * ```
 */
export function GovUKTag(props: GovUKTagProps): GovUKTag {
  return blockBuilder<GovUKTag>({ ...props, variant: 'govukTag' })
}
