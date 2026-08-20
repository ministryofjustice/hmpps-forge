import { BlockDefinition, ResolvableBoolean, ResolvableString } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'

/**
 * Individual breadcrumb item configuration.
 */
export interface BreadcrumbItem {
  /** Plain text content for the breadcrumb. Required unless html is provided. */
  text?: ResolvableString

  /** HTML content for the breadcrumb. Takes precedence over text. */
  html?: ResolvableString

  /** Link URL for the breadcrumb. If not specified, renders as plain text. */
  href?: ResolvableString

  /** Custom HTML attributes for the breadcrumb item. */
  attributes?: Record<string, any>

  /**
   * Conditional visibility for this breadcrumb. When the evaluated value is `false`,
   * the item is omitted from rendering. Defaults to showing the item.
   */
  visibleWhen?: ResolvableBoolean
}

/**
 * GOV.UK Breadcrumbs component.
 *
 * Use this to help users understand where they are in the website's structure
 * and navigate back to higher levels.
 *
 * @see https://design-system.service.gov.uk/components/breadcrumbs/
 * @example
 * ```typescript
 * GovUKBreadcrumbs({
 *   items: [
 *     { text: 'Home', href: '/' },
 *     { text: 'Passports, travel and living abroad', href: '/browse/abroad' },
 *     { text: 'Travel abroad' },
 *   ],
 * })
 * ```
 */
export interface GovUKBreadcrumbs extends BlockDefinition {
  /** The breadcrumb items to display. Required. */
  items: BreadcrumbItem[]

  /** When true, collapses to first and last item only on mobile. */
  collapseOnMobile?: boolean

  /** Accessibility label for the navigation landmark. Defaults to "Breadcrumb". */
  labelText?: ResolvableString

  /** Additional CSS classes for the breadcrumbs container. */
  classes?: ResolvableString

  /** Custom HTML attributes for the breadcrumbs container. */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Breadcrumbs component.
 *
 * Use this to help users understand where they are in the website's structure
 * and navigate back to higher levels.
 *
 * @see https://design-system.service.gov.uk/components/breadcrumbs/
 * @example
 * ```typescript
 * GovUKBreadcrumbs({
 *   items: [
 *     { text: 'Home', href: '/' },
 *     { text: 'Passports, travel and living abroad', href: '/browse/abroad' },
 *     { text: 'Travel abroad' },
 *   ],
 * })
 * ```
 */
export const GovUKBreadcrumbs = nunjucksComponent<GovUKBreadcrumbs>('govukBreadcrumbs', {
  render: (props, nunjucksEnv) => {
    const params: Record<string, any> = {
      items: props.items.filter(item => item.visibleWhen !== false),
      collapseOnMobile: props.collapseOnMobile,
      labelText: props.labelText,
      classes: props.classes,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('govuk/components/breadcrumbs/template.njk', { params })
  },
})
