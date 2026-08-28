import { BlockDefinition, ResolvableBlockProps } from '@ministryofjustice/hmpps-forge/core/components'
import { jsxComponent, raw } from '@ministryofjustice/hmpps-forge/jsx-components'

/**
 * Wraps child blocks in a GOV.UK button group layout.
 *
 * @see https://design-system.service.gov.uk/components/button/#grouping-buttons
 * @example
 * ```typescript
 * GovUKButtonGroup({
 *   buttons: [
 *     GovUKButton({ text: 'Save and continue' }),
 *     GovUKButton({ text: 'Cancel', classes: 'govuk-button--secondary' }),
 *   ],
 * })
 * ```
 */
export type GovUKButtonGroup = ResolvableBlockProps<{
  /** The buttons/links to render inside the group. */
  buttons: BlockDefinition[]

  /** Additional CSS classes to append to the button group. */
  classes?: string

  /** HTML attributes to add to the wrapper element. */
  attributes?: Record<string, any>
}>

/**
 * Wraps child blocks in a GOV.UK button group layout.
 *
 * @see https://design-system.service.gov.uk/components/button/#grouping-buttons
 * @example
 * ```typescript
 * GovUKButtonGroup({
 *   buttons: [GovUKButton({ text: 'Save and continue' })],
 * })
 * ```
 */
export const GovUKButtonGroup = jsxComponent<GovUKButtonGroup>('govukButtonGroup', {
  render: props => {
    const className = props.classes ? `govuk-button-group ${props.classes}` : 'govuk-button-group'

    return (
      <div class={className} {...props.attributes}>
        {props.buttons.map(button => raw(button.html))}
      </div>
    )
  },
})
