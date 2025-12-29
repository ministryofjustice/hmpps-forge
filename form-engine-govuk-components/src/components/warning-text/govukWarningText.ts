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
 * Props for the GovUKWarningText component.
 *
 * Use this to display important warnings to users with an exclamation mark icon
 * and bold text styling following the GOV.UK Design System.
 *
 * @see https://design-system.service.gov.uk/components/warning-text/
 * @example
 * ```typescript
 * GovUKWarningText({
 *   text: 'You can be fined up to £5,000 if you do not register.',
 * })
 * ```
 */
export interface GovUKWarningTextProps extends BasicBlockProps {
  /** Plain text content for the warning. Required unless html is provided. */
  text?: ConditionalString

  /** HTML content for the warning. Takes precedence over text. */
  html?: ConditionalString

  /** Fallback text for the warning icon (for screen readers). Defaults to "Warning". */
  iconFallbackText?: ConditionalString

  /** Additional CSS classes for the warning text container */
  classes?: ConditionalString

  /** Custom HTML attributes for the warning text container */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Warning Text component interface.
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKWarningTextProps` type or the `GovUKWarningText()` wrapper function instead.
 */
export interface GovUKWarningText extends BlockDefinition, GovUKWarningTextProps {
  /** Component variant identifier */
  variant: 'govukWarningText'
}

/**
 * Renders the GOV.UK Warning Text component using the official Nunjucks template.
 */
async function warningTextRenderer(
  block: EvaluatedBlock<GovUKWarningText>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  const params: Record<string, any> = {
    text: block.html ? undefined : block.text,
    html: block.html,
    iconFallbackText: block.iconFallbackText,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('govuk/components/warning-text/template.njk', { params })
}

export const govukWarningText = buildNunjucksComponent<GovUKWarningText>('govukWarningText', warningTextRenderer)

/**
 * Creates a GOV.UK Warning Text block for displaying important warnings.
 * Renders with an exclamation mark icon and bold text styling.
 *
 * @see https://design-system.service.gov.uk/components/warning-text/
 * @example
 * ```typescript
 * GovUKWarningText({
 *   text: 'You can be fined up to £5,000 if you do not register.',
 * })
 * ```
 */
export function GovUKWarningText(props: GovUKWarningTextProps): GovUKWarningText {
  return blockBuilder<GovUKWarningText>({ ...props, variant: 'govukWarningText' })
}
