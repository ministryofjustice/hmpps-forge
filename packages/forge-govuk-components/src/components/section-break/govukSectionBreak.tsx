import { jsxComponent } from '@ministryofjustice/hmpps-forge/jsx-components'

type SectionBreakSize = 'xl' | 'l' | 'm'

/**
 * GOV.UK section break (thematic `<hr>` between content sections).
 *
 * @see https://design-system.service.gov.uk/styles/section-break/
 * @example
 * ```typescript
 * GovUKSectionBreak({ size: 'l', visible: true })
 * GovUKSectionBreak({ size: 'xl' })
 * GovUKSectionBreak()
 * ```
 */
export interface GovUKSectionBreak {
  /** Size of the section break margin. Omit for default (smallest) spacing. */
  size?: SectionBreakSize

  /** Whether to show a visible horizontal rule. Defaults to false (spacing only). */
  visible?: boolean

  /** Additional CSS classes to append to the section break. */
  classes?: string

  /** HTML attributes to add to the hr element. */
  attributes?: Record<string, any>
}

/**
 * GOV.UK section break (thematic `<hr>` between content sections).
 *
 * @see https://design-system.service.gov.uk/styles/section-break/
 * @example
 * ```typescript
 * GovUKSectionBreak({ size: 'l', visible: true })
 * GovUKSectionBreak()
 * ```
 */
export const GovUKSectionBreak = jsxComponent<GovUKSectionBreak>('govukSectionBreak', {
  render: props => {
    const className = [
      'govuk-section-break',
      props.size && `govuk-section-break--${props.size}`,
      props.visible && 'govuk-section-break--visible',
      props.classes,
    ]
      .filter(Boolean)
      .join(' ')

    return <hr class={className} {...props.attributes} />
  },
})
