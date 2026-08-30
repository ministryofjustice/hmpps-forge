import { nunjucksComponent } from '../../utils/nunjucksComponent'

/**
 * GOV.UK Tag component.
 *
 * Use this to display a status indicator, phase banner label, or other short
 * piece of information that needs to stand out from surrounding content. Tags are
 * compact, coloured labels used to show the status of something, like a phase
 * banner or task status.
 *
 * Different colours can be applied using the `classes` property with modifier
 * classes like `govuk-tag--grey`, `govuk-tag--green`, `govuk-tag--teal`,
 * `govuk-tag--blue`, `govuk-tag--purple`, `govuk-tag--magenta`,
 * `govuk-tag--red`, `govuk-tag--orange`, or `govuk-tag--yellow`.
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
export interface GovUKTag {
  /**
   * Plain text content for the tag.
   * Required unless `html` is provided.
   * If `html` is provided, this option will be ignored.
   */
  text?: string

  /**
   * HTML content for the tag.
   * Takes precedence over `text` if both are provided.
   * Use this when you need to include HTML elements within the tag.
   */
  html?: string

  /**
   * Additional CSS classes to add to the tag.
   * Use modifier classes to change the tag colour:
   * - `govuk-tag--grey` - Grey tag for inactive or default states
   * - `govuk-tag--green` - Green tag for success or completed states
   * - `govuk-tag--teal` - Teal tag
   * - `govuk-tag--blue` - Blue tag (default colour if no modifier)
   * - `govuk-tag--purple` - Purple tag
   * - `govuk-tag--magenta` - Magenta tag
   * - `govuk-tag--red` - Red tag for errors or urgent states
   * - `govuk-tag--orange` - Orange tag for warnings
   * - `govuk-tag--yellow` - Yellow tag for pending or attention states
   */
  classes?: string

  /**
   * HTML attributes (for example data attributes) to add to the tag.
   * Useful for adding custom data attributes or ARIA attributes.
   */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Tag component.
 *
 * Use this to display a status indicator, phase banner label, or other short
 * piece of information that needs to stand out from surrounding content. Tags are
 * compact, coloured labels used to show the status of something, like a phase
 * banner or task status.
 *
 * Different colours can be applied using the `classes` property with modifier
 * classes like `govuk-tag--grey`, `govuk-tag--green`, `govuk-tag--teal`,
 * `govuk-tag--blue`, `govuk-tag--purple`, `govuk-tag--magenta`,
 * `govuk-tag--red`, `govuk-tag--orange`, or `govuk-tag--yellow`.
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
export const GovUKTag = nunjucksComponent<GovUKTag>('govukTag', {
  factory:
    ({ nunjucksEnv }) =>
    ({ props }) => {
      const params: Record<string, any> = {
        text: props.html ? undefined : props.text,
        html: props.html,
        classes: props.classes,
        attributes: props.attributes,
      }

      return nunjucksEnv.render('govuk/components/tag/template.njk', { params })
    },
})
