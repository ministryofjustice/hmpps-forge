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
 * Props for the GovUKInsetText component.
 *
 * Use this to differentiate a block of text from the surrounding content,
 * for example quotes, examples, or additional information.
 *
 * @see https://design-system.service.gov.uk/components/inset-text/
 * @example
 * ```typescript
 * GovUKInsetText({
 *   text: 'It can take up to 8 weeks to register a lasting power of attorney if there are no mistakes in the application.',
 * })
 * ```
 */
export interface GovUKInsetTextProps extends BasicBlockProps {
  /**
   * Plain text content for the inset text.
   * Required unless `html` is provided.
   * If `html` is provided, this option will be ignored.
   */
  text?: ConditionalString

  /**
   * HTML content for the inset text.
   * Takes precedence over `text` if both are provided.
   * Use this when you need to include links or other HTML elements.
   */
  html?: ConditionalString

  /**
   * ID attribute to add to the inset text container.
   * Useful for linking to this specific section or for testing.
   */
  id?: ConditionalString

  /**
   * Additional CSS classes to add to the inset text container.
   * Use this to apply custom styling or spacing classes.
   */
  classes?: ConditionalString

  /**
   * HTML attributes (for example data attributes) to add to the inset text container.
   * Useful for adding custom data attributes or ARIA attributes.
   */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Inset Text component interface.
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKInsetTextProps` type or the `GovUKInsetText()` wrapper function instead.
 */
export interface GovUKInsetText extends BlockDefinition, GovUKInsetTextProps {
  /** Component variant identifier */
  variant: 'govukInsetText'
}

/**
 * Renders the GOV.UK Inset Text component using the official Nunjucks template.
 */
async function insetTextRenderer(
  block: EvaluatedBlock<GovUKInsetText>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  const params: Record<string, any> = {
    text: block.html ? undefined : block.text,
    html: block.html,
    id: block.id,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('govuk/components/inset-text/template.njk', { params })
}

export const govukInsetText = buildNunjucksComponent<GovUKInsetText>('govukInsetText', insetTextRenderer)

/**
 * Creates a GOV.UK Inset Text block for differentiating content from the surrounding text.
 * Useful for quotes, examples, or additional information that needs visual distinction.
 *
 * @see https://design-system.service.gov.uk/components/inset-text/
 * @example
 * ```typescript
 * GovUKInsetText({
 *   text: 'It can take up to 8 weeks to register a lasting power of attorney if there are no mistakes in the application.',
 * })
 * ```
 */
export function GovUKInsetText(props: GovUKInsetTextProps): GovUKInsetText {
  return blockBuilder<GovUKInsetText>({ ...props, variant: 'govukInsetText' })
}
