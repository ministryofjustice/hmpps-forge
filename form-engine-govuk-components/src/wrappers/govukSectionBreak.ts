import { HtmlBlock } from '@form-engine/registry/components/html'
import type { BasicBlockProps } from '@form-engine/form/types/structures.type'

type SectionBreakSize = 'xl' | 'l' | 'm'

export interface GovUKSectionBreakProps extends BasicBlockProps {
  /** Size of the section break margin. Omit for default (smallest) spacing. */
  size?: SectionBreakSize

  /** Whether to show a visible horizontal rule. Defaults to false (spacing only). */
  visible?: boolean

  /** Additional CSS classes to append to the section break. */
  classes?: string

  /** HTML attributes to add to the wrapper element. */
  attributes?: Record<string, any>
}

/**
 * Creates a GOV.UK section break (thematic `<hr>` between content sections).
 *
 * @see https://design-system.service.gov.uk/styles/section-break/
 * @example
 * ```typescript
 * GovUKSectionBreak({ size: 'l', visible: true })
 * GovUKSectionBreak({ size: 'xl' })
 * GovUKSectionBreak()
 * ```
 */
export function GovUKSectionBreak(props?: GovUKSectionBreakProps): HtmlBlock {
  const { size, visible, classes, ...blockProps } = props ?? {}

  const classNames = [
    'govuk-section-break',
    size && `govuk-section-break--${size}`,
    visible && 'govuk-section-break--visible',
    classes,
  ]
    .filter(Boolean)
    .join(' ')

  return HtmlBlock({
    ...blockProps,
    tag: 'hr',
    classes: classNames,
  })
}
