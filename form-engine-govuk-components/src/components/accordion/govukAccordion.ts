import type nunjucks from 'nunjucks'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalBoolean,
  ConditionalString,
  EvaluatedBlock,
  RenderedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

/**
 * Heading configuration for an accordion section.
 * Displays as the clickable header that expands/collapses the section.
 */
export interface AccordionItemHeading {
  /** Plain text content for the heading. Required unless html is provided. */
  text?: ConditionalString

  /**
   * HTML content for the heading. Takes precedence over text.
   * Note: The header is inside a `<button>` element, so only phrasing content is allowed.
   */
  html?: ConditionalString
}

/**
 * Summary line configuration for an accordion section.
 * Optional additional text displayed alongside the heading.
 */
export interface AccordionItemSummary {
  /** Plain text content for the summary line. */
  text?: ConditionalString

  /**
   * HTML content for the summary line. Takes precedence over text.
   * Note: The summary line is inside a `<button>` element, so only phrasing content is allowed.
   */
  html?: ConditionalString
}

/**
 * Content configuration for an accordion section.
 * The content that is shown when the section is expanded.
 */
export interface AccordionItemContent {
  /** Plain text content for the section. Required unless html or blocks is provided. */
  text?: ConditionalString

  /** HTML content for the section. Takes precedence over text. */
  html?: ConditionalString

  /** Child blocks to render in the section. Takes precedence over text/html. */
  blocks?: BlockDefinition[]
}

/**
 * An individual section within the accordion.
 */
export interface AccordionItem {
  /** The heading of the accordion section. Required. */
  heading: AccordionItemHeading

  /** Optional summary line displayed alongside the heading. */
  summary?: AccordionItemSummary

  /** The content of the accordion section. Required. */
  content: AccordionItemContent

  /** Whether the section should be expanded when the page loads. Defaults to false. */
  expanded?: ConditionalBoolean
}

/**
 * Props for the GovUKAccordion component.
 * A vertically stacked set of expandable/collapsible sections following GOV.UK Design System patterns.
 *
 * @see https://design-system.service.gov.uk/components/accordion/
 * @example
 * ```typescript
 * GovUKAccordion({
 *   id: 'accordion-default',
 *   items: [
 *     {
 *       heading: { text: 'Writing well for the web' },
 *       content: { text: 'This is the content for the first section.' },
 *     },
 *     {
 *       heading: { text: 'Writing well for specialists' },
 *       summary: { text: 'Guidance for technical writers' },
 *       content: { text: 'This is the content for the second section.' },
 *     },
 *   ],
 * })
 * ```
 */
export interface GovUKAccordionProps extends BasicBlockProps {
  /**
   * Unique ID for the accordion.
   * Must be unique across the domain if `rememberExpanded` is true, as the expanded state
   * persists across page loads using session storage.
   */
  id: ConditionalString

  /** The sections within the accordion. Required. */
  items: AccordionItem[]

  /** Heading level for section headings, from 1 to 6. Defaults to 2. */
  headingLevel?: number

  /**
   * Whether the expanded/collapsed state should persist across page loads.
   * Uses session storage. Defaults to true.
   */
  rememberExpanded?: ConditionalBoolean

  /** Text for the "Hide all sections" button when all sections are expanded. */
  hideAllSectionsText?: ConditionalString

  /** Text for the "Show all sections" button when at least one section is collapsed. */
  showAllSectionsText?: ConditionalString

  /** Text for the "Hide" button within each expanded section. */
  hideSectionText?: ConditionalString

  /** Text for the "Show" button within each collapsed section. */
  showSectionText?: ConditionalString

  /** Accessible label text when section is expanded. Defaults to "Hide this section". */
  hideSectionAriaLabelText?: ConditionalString

  /** Accessible label text when section is collapsed. Defaults to "Show this section". */
  showSectionAriaLabelText?: ConditionalString

  /** Additional CSS classes for the accordion element. */
  classes?: ConditionalString

  /** Custom HTML attributes for the accordion element. */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Accordion Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKAccordionProps` type or the `GovUKAccordion()` wrapper function instead.
 */
export interface GovUKAccordion extends BlockDefinition, GovUKAccordionProps {
  /** Component variant identifier */
  variant: 'govukAccordion'
}

/**
 * Renders the GOV.UK Accordion component using the official Nunjucks template.
 */
async function accordionRenderer(
  block: EvaluatedBlock<GovUKAccordion>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  // Process items, handling child blocks in content
  const processedItems = block.items.map(item => {
    let contentHtml: string | undefined

    // If content blocks are provided, render them and use as HTML
    if (item.content.blocks && item.content.blocks.length > 0) {
      contentHtml = (item.content.blocks as RenderedBlock[]).map(b => b.html).join('')
    }

    return {
      heading: {
        text: item.heading.html ? undefined : item.heading.text,
        html: item.heading.html,
      },
      summary: item.summary
        ? {
            text: item.summary.html ? undefined : item.summary.text,
            html: item.summary.html,
          }
        : undefined,
      content: {
        text: contentHtml || item.content.html ? undefined : item.content.text,
        html: contentHtml || item.content.html,
      },
      expanded: item.expanded,
    }
  })

  const params: Record<string, any> = {
    id: block.id,
    items: processedItems,
    headingLevel: block.headingLevel,
    rememberExpanded: block.rememberExpanded,
    hideAllSectionsText: block.hideAllSectionsText,
    showAllSectionsText: block.showAllSectionsText,
    hideSectionText: block.hideSectionText,
    showSectionText: block.showSectionText,
    hideSectionAriaLabelText: block.hideSectionAriaLabelText,
    showSectionAriaLabelText: block.showSectionAriaLabelText,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('govuk/components/accordion/template.njk', { params })
}

export const govukAccordion = buildNunjucksComponent<GovUKAccordion>('govukAccordion', accordionRenderer)

/**
 * Creates a GOV.UK Accordion with expandable/collapsible sections.
 * Renders as a vertically stacked set of interactive headings that reveal or hide content.
 *
 * @see https://design-system.service.gov.uk/components/accordion/
 * @example
 * ```typescript
 * GovUKAccordion({
 *   id: 'accordion-default',
 *   items: [
 *     {
 *       heading: { text: 'Writing well for the web' },
 *       content: { text: 'This is the content for the first section.' },
 *     },
 *     {
 *       heading: { text: 'Writing well for specialists' },
 *       summary: { text: 'Guidance for technical writers' },
 *       content: { text: 'This is the content for the second section.' },
 *     },
 *   ],
 * })
 * ```
 *
 * @example With child blocks as content
 * ```typescript
 * GovUKAccordion({
 *   id: 'accordion-with-blocks',
 *   items: [
 *     {
 *       heading: { text: 'Section with nested components' },
 *       content: {
 *         blocks: [
 *           GovUKInsetText({ text: 'Important information' }),
 *           GovUKWarningText({ text: 'Warning message' }),
 *         ],
 *       },
 *     },
 *   ],
 * })
 * ```
 */
export function GovUKAccordion(props: GovUKAccordionProps): GovUKAccordion {
  return blockBuilder<GovUKAccordion>({ ...props, variant: 'govukAccordion' })
}
