import { TemplateWrapper } from '@form-engine/registry/components/templateWrapper'
import type { BasicBlockProps, BlockDefinition } from '@form-engine/form/types/structures.type'

export interface GovUKButtonGroupProps extends BasicBlockProps {
  /** The buttons/links to render inside the group. */
  buttons: BlockDefinition[]

  /** Additional CSS classes to append to the button group. */
  classes?: string

  /** HTML attributes to add to the wrapper element. */
  attributes?: Record<string, any>
}

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
export function GovUKButtonGroup(props: GovUKButtonGroupProps): TemplateWrapper {
  const { buttons, classes, ...blockProps } = props
  const groupClasses = classes ? `govuk-button-group ${classes}` : 'govuk-button-group'

  return TemplateWrapper({
    ...blockProps,
    template: `<div class="${groupClasses}">${buttons.map((_, i) => `{{slot:child${i}}}`).join('')}</div>`,
    slots: Object.fromEntries(buttons.map((button, i) => [`child${i}`, [button]])),
  })
}
