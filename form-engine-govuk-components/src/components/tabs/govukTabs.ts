import type nunjucks from 'nunjucks'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalString,
  EvaluatedBlock,
  RenderedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

/**
 * Panel content configuration for a tab.
 * The content that is displayed when the tab is selected.
 */
export interface TabPanel {
  /** Plain text content for the panel. Required unless html or blocks is provided. */
  text?: ConditionalString

  /** HTML content for the panel. Takes precedence over text. */
  html?: ConditionalString

  /** Child blocks to render in the panel. Takes precedence over text/html. */
  blocks?: BlockDefinition[]

  /** Custom HTML attributes for the panel element. */
  attributes?: Record<string, any>
}

/**
 * An individual tab within the tabs component.
 */
export interface TabItem {
  /**
   * Specific ID attribute for the tab item.
   * This is used as the panel's ID and for the tab link's href.
   */
  id: ConditionalString

  /** The text label displayed on the tab. Required. */
  label: ConditionalString

  /** The content of the tab panel. Required. */
  panel: TabPanel

  /** Custom HTML attributes for the tab element. */
  attributes?: Record<string, any>
}

/**
 * Props for the GovUKTabs component.
 * A tabbed content component following GOV.UK Design System patterns.
 * Tabs allow users to navigate between related sections of content, displaying one section at a time.
 *
 * @see https://design-system.service.gov.uk/components/tabs/
 * @example
 * ```typescript
 * GovUKTabs({
 *   id: 'my-tabs',
 *   items: [
 *     {
 *       id: 'past-day',
 *       label: 'Past day',
 *       panel: { text: 'Content for past day tab' },
 *     },
 *     {
 *       id: 'past-week',
 *       label: 'Past week',
 *       panel: { text: 'Content for past week tab' },
 *     },
 *   ],
 * })
 * ```
 */
export interface GovUKTabsProps extends BasicBlockProps {
  /**
   * Unique ID for the tabs component.
   * This is used for the main component and to compose the ID attribute for each item.
   */
  id: ConditionalString

  /**
   * Title for the tabs table of contents.
   * Displayed on mobile where tabs become a table of contents.
   * Defaults to "Contents".
   */
  title?: ConditionalString

  /** The individual tabs within the tabs component. Required. */
  items: TabItem[]

  /** Additional CSS classes for the tabs element. */
  classes?: ConditionalString

  /** Custom HTML attributes for the tabs element. */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Tabs Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKTabsProps` type or the `GovUKTabs()` wrapper function instead.
 */
export interface GovUKTabs extends BlockDefinition, GovUKTabsProps {
  /** Component variant identifier */
  variant: 'govukTabs'
}

/**
 * Renders the GOV.UK Tabs component using the official Nunjucks template.
 */
async function tabsRenderer(block: EvaluatedBlock<GovUKTabs>, nunjucksEnv: nunjucks.Environment): Promise<string> {
  // Process items, handling child blocks in panel content
  const processedItems = block.items.map(item => {
    let panelHtml: string | undefined

    // If panel blocks are provided, render them and use as HTML
    if (item.panel.blocks && item.panel.blocks.length > 0) {
      panelHtml = (item.panel.blocks as RenderedBlock[]).map(b => b.html).join('')
    }

    return {
      id: item.id,
      label: item.label,
      attributes: item.attributes,
      panel: {
        text: panelHtml || item.panel.html ? undefined : item.panel.text,
        html: panelHtml || item.panel.html,
        attributes: item.panel.attributes,
      },
    }
  })

  const params: Record<string, any> = {
    id: block.id,
    title: block.title,
    items: processedItems,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('govuk/components/tabs/template.njk', { params })
}

export const govukTabs = buildNunjucksComponent<GovUKTabs>('govukTabs', tabsRenderer)

/**
 * Creates a GOV.UK Tabs component with tabbed navigation.
 * Renders as a set of tab buttons that reveal associated content panels.
 * On mobile, tabs are displayed as a table of contents.
 *
 * @see https://design-system.service.gov.uk/components/tabs/
 * @example
 * ```typescript
 * GovUKTabs({
 *   id: 'my-tabs',
 *   items: [
 *     {
 *       id: 'past-day',
 *       label: 'Past day',
 *       panel: { text: 'Content for past day tab' },
 *     },
 *     {
 *       id: 'past-week',
 *       label: 'Past week',
 *       panel: { text: 'Content for past week tab' },
 *     },
 *   ],
 * })
 * ```
 *
 * @example With child blocks as panel content
 * ```typescript
 * GovUKTabs({
 *   id: 'tabs-with-blocks',
 *   items: [
 *     {
 *       id: 'overview',
 *       label: 'Overview',
 *       panel: {
 *         blocks: [
 *           GovUKInsetText({ text: 'Important overview information' }),
 *           GovUKWarningText({ text: 'Warning message' }),
 *         ],
 *       },
 *     },
 *   ],
 * })
 * ```
 */
export function GovUKTabs(props: GovUKTabsProps): GovUKTabs {
  return blockBuilder<GovUKTabs>({ ...props, variant: 'govukTabs' })
}
