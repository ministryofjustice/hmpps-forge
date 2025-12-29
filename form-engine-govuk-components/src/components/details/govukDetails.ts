import type nunjucks from 'nunjucks'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalBoolean,
  ConditionalString,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

/**
 * Props for the GovUKDetails component.
 * An expandable/collapsible section following the GOV.UK Design System patterns.
 *
 * @see https://design-system.service.gov.uk/components/details/
 * @example
 * ```typescript
 * GovUKDetails({
 *   summaryText: 'Help with nationality',
 *   text: 'We need to know your nationality so we can work out which elections you can vote in.',
 * })
 * ```
 */
export interface GovUKDetailsProps extends BasicBlockProps {
  /** Text to display in the summary (clickable part). Required unless summaryHtml is provided. */
  summaryText?: ConditionalString

  /** HTML to display in the summary (clickable part). Takes precedence over summaryText. */
  summaryHtml?: ConditionalString

  /** Plain text content for the expandable section */
  text?: ConditionalString

  /** HTML content for the expandable section. Takes precedence over text. */
  html?: ConditionalString

  /** Child blocks to render in the expandable section. Takes precedence over text/html. */
  content?: BlockDefinition[]

  /** Whether the details should be expanded by default */
  open?: ConditionalBoolean

  /** ID attribute for the details element */
  id?: ConditionalString

  /** Additional CSS classes for the details element */
  classes?: ConditionalString

  /** Custom HTML attributes for the details element */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Details Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKDetailsProps` type or the `GovUKDetails()` wrapper function instead.
 */
export interface GovUKDetails extends BlockDefinition, GovUKDetailsProps {
  /** Component variant identifier */
  variant: 'govukDetails'
}

/**
 * Renders the GOV.UK Details component using the official Nunjucks template.
 */
async function detailsRenderer(
  block: EvaluatedBlock<GovUKDetails>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  // If content blocks are provided, render them and use as HTML
  let contentHtml: string | undefined

  if (block.content && block.content.length > 0) {
    contentHtml = block.content.map(b => b.html).join('')
  }

  const params: Record<string, any> = {
    summaryText: block.summaryHtml ? undefined : block.summaryText,
    summaryHtml: block.summaryHtml,
    text: contentHtml || block.html ? undefined : block.text,
    html: contentHtml || block.html,
    open: block.open,
    id: block.id,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('govuk/components/details/template.njk', { params })
}

export const govukDetails = buildNunjucksComponent<GovUKDetails>('govukDetails', detailsRenderer as any)

/**
 * Creates a GOV.UK Details expandable/collapsible section.
 * Renders as a `<details>` element with summary and content sections.
 *
 * @see https://design-system.service.gov.uk/components/details/
 * @example
 * ```typescript
 * GovUKDetails({
 *   summaryText: 'Help with nationality',
 *   text: 'We need to know your nationality so we can work out which elections you can vote in.',
 * })
 * ```
 */
export function GovUKDetails(props: GovUKDetailsProps): GovUKDetails {
  return blockBuilder<GovUKDetails>({ ...props, variant: 'govukDetails' })
}
