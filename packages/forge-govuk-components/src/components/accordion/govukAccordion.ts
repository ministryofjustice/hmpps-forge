import { BlockDefinition, ResolvableBlockProps } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import { normaliseGovukTextHtmlContent } from '../../utils/govukParamNormalisers'

/**
 * Heading configuration for an accordion section.
 * Displays as the clickable header that expands/collapses the section.
 */
export interface AccordionItemHeading {
  /** Plain text content for the heading. Required unless html is provided. */
  text?: string

  /**
   * HTML content for the heading. Takes precedence over text.
   * Note: The header is inside a `<button>` element, so only phrasing content is allowed.
   */
  html?: string
}

/**
 * Summary line configuration for an accordion section.
 * Optional additional text displayed alongside the heading.
 */
export interface AccordionItemSummary {
  /** Plain text content for the summary line. */
  text?: string

  /**
   * HTML content for the summary line. Takes precedence over text.
   * Note: The summary line is inside a `<button>` element, so only phrasing content is allowed.
   */
  html?: string
}

/**
 * Content configuration for an accordion section.
 * The content that is shown when the section is expanded.
 */
export interface AccordionItemContent {
  /** Plain text content for the section. Required unless html or blocks is provided. */
  text?: string

  /** HTML content for the section. Takes precedence over text. */
  html?: string

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
  expanded?: boolean

  /**
   * Conditional visibility for this section. When the evaluated value is `false`,
   * the section is omitted from rendering. Defaults to showing the section.
   */
  visibleWhen?: boolean
}

/**
 * GOV.UK Accordion component.
 *
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
export type GovUKAccordion = ResolvableBlockProps<{
  /**
   * Unique ID for the accordion.
   * Must be unique across the domain if `rememberExpanded` is true, as the expanded state
   * persists across page loads using session storage.
   */
  id: string

  /** The sections within the accordion. Required. Supports dynamic expressions. */
  items: AccordionItem[]

  /** Heading level for section headings, from 1 to 6. Defaults to 2. */
  headingLevel?: number

  /**
   * Whether the expanded/collapsed state should persist across page loads.
   * Uses session storage. Defaults to true.
   */
  rememberExpanded?: boolean

  /** Text for the "Hide all sections" button when all sections are expanded. */
  hideAllSectionsText?: string

  /** Text for the "Show all sections" button when at least one section is collapsed. */
  showAllSectionsText?: string

  /** Text for the "Hide" button within each expanded section. */
  hideSectionText?: string

  /** Text for the "Show" button within each collapsed section. */
  showSectionText?: string

  /** Accessible label text when section is expanded. Defaults to "Hide this section". */
  hideSectionAriaLabelText?: string

  /** Accessible label text when section is collapsed. Defaults to "Show this section". */
  showSectionAriaLabelText?: string

  /** Additional CSS classes for the accordion element. */
  classes?: string

  /** Custom HTML attributes for the accordion element. */
  attributes?: Record<string, any>
}>

/**
 * GOV.UK Accordion component.
 *
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
export const GovUKAccordion = nunjucksComponent<GovUKAccordion>('govukAccordion', {
  render: (props, nunjucksEnv) => {
    const processedItems = props.items
      .filter(item => item.visibleWhen !== false)
      .map(item => {
        const content = normaliseGovukTextHtmlContent({
          text: item.content.text,
          html: item.content.html,
          blocks: item.content.blocks,
        })

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
            text: content.text,
            html: content.html,
          },
          expanded: item.expanded,
        }
      })

    const params: Record<string, any> = {
      id: props.id,
      items: processedItems,
      headingLevel: props.headingLevel,
      rememberExpanded: props.rememberExpanded,
      hideAllSectionsText: props.hideAllSectionsText,
      showAllSectionsText: props.showAllSectionsText,
      hideSectionText: props.hideSectionText,
      showSectionText: props.showSectionText,
      hideSectionAriaLabelText: props.hideSectionAriaLabelText,
      showSectionAriaLabelText: props.showSectionAriaLabelText,
      classes: props.classes,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('govuk/components/accordion/template.njk', { params })
  },
})
