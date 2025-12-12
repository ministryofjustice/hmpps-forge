import type nunjucks from 'nunjucks'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import {
  BlockDefinition,
  ConditionalBoolean,
  ConditionalString,
  RenderedBlock,
} from '@form-engine/form/types/structures.type'
import { StructureType } from '@form-engine/form/types/enums'

/**
 * GOV.UK Details component for expandable/collapsible content.
 * Renders as a `<details>` element with summary and content sections.
 *
 * Supports three ways to provide content:
 * 1. `text` - Plain text content
 * 2. `html` - HTML string content
 * 3. `content` - Array of child blocks (rendered automatically)
 *
 * @example Simple text content
 * ```typescript
 * block<GovUKDetails>({
 *   variant: 'govukDetails',
 *   summaryText: 'Help with nationality',
 *   text: 'We need to know your nationality...',
 * })
 * ```
 *
 * @example HTML content
 * ```typescript
 * block<GovUKDetails>({
 *   variant: 'govukDetails',
 *   summaryText: 'View example code',
 *   html: '<pre><code>const x = 1;</code></pre>',
 * })
 * ```
 *
 * @example Child blocks content
 * ```typescript
 * block<GovUKDetails>({
 *   variant: 'govukDetails',
 *   summaryText: 'View complete example',
 *   content: [
 *     block<GovUKCodeBlock>({
 *       variant: 'govukCodeBlock',
 *       language: 'typescript',
 *       code: 'const x = 1;',
 *     }),
 *   ],
 * })
 * ```
 */
export interface GovUKDetails extends BlockDefinition {
  variant: 'govukDetails'

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
 * Runtime representation of the details component after evaluation.
 * Child blocks become RenderedBlock[] with pre-rendered HTML.
 */
export interface EvaluatedGovUKDetails {
  type: typeof StructureType.BLOCK
  variant: 'govukDetails'
  summaryText?: string
  summaryHtml?: string
  text?: string
  html?: string
  content?: RenderedBlock[]
  open?: boolean
  id?: string
  classes?: string
  attributes?: Record<string, string>
}

/**
 * Renders the GOV.UK Details component using the official Nunjucks template.
 */
async function detailsRenderer(block: EvaluatedGovUKDetails, nunjucksEnv: nunjucks.Environment): Promise<string> {
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
