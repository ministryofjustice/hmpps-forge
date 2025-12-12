import type nunjucks from 'nunjucks'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import { BlockDefinition, ConditionalString, EvaluatedBlock } from '@form-engine/form/types/structures.type'

/**
 * GOV.UK Warning Text component for displaying important warnings.
 * Renders with an exclamation mark icon and bold text styling.
 *
 * @example Plain text
 * ```typescript
 * block<GovUKWarningText>({
 *   variant: 'govukWarningText',
 *   text: 'You can be fined up to £5,000 if you do not register.',
 * })
 * ```
 *
 * @example HTML content
 * ```typescript
 * block<GovUKWarningText>({
 *   variant: 'govukWarningText',
 *   html: 'You <strong>must</strong> complete this section.',
 * })
 * ```
 *
 * @example Custom icon text
 * ```typescript
 * block<GovUKWarningText>({
 *   variant: 'govukWarningText',
 *   text: 'This action cannot be undone.',
 *   iconFallbackText: 'Important',
 * })
 * ```
 */
export interface GovUKWarningText extends BlockDefinition {
  variant: 'govukWarningText'

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
