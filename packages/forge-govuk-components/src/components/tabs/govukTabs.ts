import { BlockDefinition } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'
import { normaliseGovukTextHtmlContent } from '../../utils/govukParamNormalisers'

/**
 * Panel content configuration for a tab.
 * The content that is displayed when the tab is selected.
 */
export interface TabPanel {
  /** Plain text content for the panel. Required unless html or blocks is provided. */
  text?: string

  /** HTML content for the panel. Takes precedence over text. */
  html?: string

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
  id: string

  /** The text label displayed on the tab. Required. */
  label: string

  /** The content of the tab panel. Required. */
  panel: TabPanel

  /** Custom HTML attributes for the tab element. */
  attributes?: Record<string, any>

  /**
   * Conditional visibility for this tab. When the evaluated value is `false`,
   * the tab is omitted from rendering.
   */
  visibleWhen?: boolean
}

/**
 * GOV.UK Tabs component.
 *
 * Tabs allow users to navigate between related sections of content, displaying one
 * section at a time. Renders as a set of tab buttons that reveal associated content
 * panels. On mobile, tabs are displayed as a table of contents.
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
export interface GovUKTabs {
  /**
   * Unique ID for the tabs component.
   * This is used for the main component and to compose the ID attribute for each item.
   */
  id: string

  /**
   * Title for the tabs table of contents.
   * Displayed on mobile where tabs become a table of contents.
   * Defaults to "Contents".
   */
  title?: string

  /** The individual tabs within the tabs component. Required. */
  items: TabItem[]

  /** Additional CSS classes for the tabs element. */
  classes?: string

  /** Custom HTML attributes for the tabs element. */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Tabs component.
 *
 * Tabs allow users to navigate between related sections of content, displaying one
 * section at a time. Renders as a set of tab buttons that reveal associated content
 * panels. On mobile, tabs are displayed as a table of contents.
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
export const GovUKTabs = nunjucksComponent<GovUKTabs>('govukTabs', {
  render: (props, nunjucksEnv) => {
    // Process items, handling child blocks in panel content
    const processedItems = props.items
      .filter(item => item.visibleWhen !== false)
      .map(item => {
        const panel = normaliseGovukTextHtmlContent({
          text: item.panel.text,
          html: item.panel.html,
          blocks: item.panel.blocks,
        })

        return {
          id: item.id,
          label: item.label,
          attributes: item.attributes,
          panel: {
            text: panel.text,
            html: panel.html,
            attributes: item.panel.attributes,
          },
        }
      })

    const params: Record<string, any> = {
      id: props.id,
      title: props.title,
      items: processedItems,
      classes: props.classes,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('govuk/components/tabs/template.njk', { params })
  },
})
