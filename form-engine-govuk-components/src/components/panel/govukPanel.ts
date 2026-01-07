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
 * Props for the GovUKPanel component.
 *
 * Use this to display a confirmation panel, typically shown on confirmation pages
 * at the end of a transaction. The panel has a turquoise background with white text.
 *
 * @see https://design-system.service.gov.uk/components/panel/
 * @example
 * ```typescript
 * GovUKPanel({
 *   titleText: 'Application complete',
 *   text: 'Your reference number is HDJ2123F',
 * })
 * ```
 */
export interface GovUKPanelProps extends BasicBlockProps {
  /**
   * Plain text to use within the panel title.
   * Required unless `titleHtml` is provided.
   * If `titleHtml` is provided, this option will be ignored.
   */
  titleText?: ConditionalString

  /**
   * HTML to use within the panel title.
   * Takes precedence over `titleText`.
   * If `titleHtml` is provided, the `titleText` option will be ignored.
   */
  titleHtml?: ConditionalString

  /**
   * Heading level for the panel title, from 1 to 6.
   * Defaults to 1 (h1).
   */
  headingLevel?: number

  /**
   * Plain text content for the panel body.
   * Required unless `html` is provided.
   * If `html` is provided, this option will be ignored.
   */
  text?: ConditionalString

  /**
   * HTML content for the panel body.
   * Takes precedence over `text`.
   * If `html` is provided, the `text` option will be ignored.
   */
  html?: ConditionalString

  /**
   * Additional CSS classes for the panel container.
   */
  classes?: ConditionalString

  /**
   * Custom HTML attributes (for example data attributes) to add to the panel container.
   */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Panel component interface.
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKPanelProps` type or the `GovUKPanel()` wrapper function instead.
 */
export interface GovUKPanel extends BlockDefinition, GovUKPanelProps {
  /** Component variant identifier */
  variant: 'govukPanel'
}

/**
 * Renders the GOV.UK Panel component using the official Nunjucks template.
 */
async function panelRenderer(block: EvaluatedBlock<GovUKPanel>, nunjucksEnv: nunjucks.Environment): Promise<string> {
  const params: Record<string, any> = {
    titleText: block.titleHtml ? undefined : block.titleText,
    titleHtml: block.titleHtml,
    headingLevel: block.headingLevel,
    text: block.html ? undefined : block.text,
    html: block.html,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('govuk/components/panel/template.njk', { params })
}

export const govukPanel = buildNunjucksComponent<GovUKPanel>('govukPanel', panelRenderer)

/**
 * Creates a GOV.UK Panel block for displaying confirmation messages.
 * Typically used on confirmation pages at the end of a transaction.
 * Renders with a turquoise background and white text.
 *
 * @see https://design-system.service.gov.uk/components/panel/
 * @example
 * ```typescript
 * GovUKPanel({
 *   titleText: 'Application complete',
 *   text: 'Your reference number is HDJ2123F',
 * })
 * ```
 */
export function GovUKPanel(props: GovUKPanelProps): GovUKPanel {
  return blockBuilder<GovUKPanel>({ ...props, variant: 'govukPanel' })
}
