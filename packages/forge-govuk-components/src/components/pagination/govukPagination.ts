import {
  BlockDefinition,
  ResolvableArray,
  ResolvableBoolean,
  ResolvableString,
} from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'

/**
 * Pagination link configuration for previous/next navigation.
 */
export interface PaginationLink {
  /** The link's URL. Required. */
  href: ResolvableString

  /** Text content of the link. Defaults to "Previous page" or "Next page". */
  text?: ResolvableString

  /** HTML content of the link. Takes precedence over text. */
  html?: ResolvableString

  /** Label underneath the link providing context (e.g., "Introduction"). */
  labelText?: ResolvableString

  /** Custom HTML attributes for the anchor element. */
  attributes?: Record<string, any>

  /**
   * Conditional visibility for this link. When the evaluated value is `false`,
   * the link is omitted from rendering. Defaults to showing the link.
   */
  visibleWhen?: ResolvableBoolean
}

/**
 * Pagination item for numbered page navigation.
 */
export interface PaginationItem {
  /** The page number text. Required unless ellipsis is true. */
  number?: ResolvableString

  /** Visually hidden label for screen readers (e.g., "Page 1"). */
  visuallyHiddenText?: ResolvableString

  /** The link's URL. Required unless ellipsis is true. */
  href?: ResolvableString

  /** Set to true to indicate the current page. */
  current?: ResolvableBoolean

  /** Set to true to render an ellipsis instead of a page number. */
  ellipsis?: ResolvableBoolean

  /** Custom HTML attributes for the anchor element. */
  attributes?: Record<string, any>

  /**
   * Conditional visibility for this item. When the evaluated value is `false`,
   * the item is omitted from rendering. Defaults to showing the item.
   */
  visibleWhen?: ResolvableBoolean
}

/**
 * GOV.UK Pagination component.
 *
 * Use this to navigate between pages. Supports previous/next links with labels, and
 * numbered page navigation.
 *
 * @see https://design-system.service.gov.uk/components/pagination/
 * @example
 * ```typescript
 * GovUKPagination({
 *   previous: {
 *     href: '/docs/introduction',
 *     labelText: 'Introduction',
 *   },
 *   next: {
 *     href: '/docs/getting-started',
 *     labelText: 'Getting Started',
 *   },
 * })
 * ```
 */
export interface GovUKPagination extends BlockDefinition {
  /** Link to the previous page. */
  previous?: PaginationLink

  /** Link to the next page. */
  next?: PaginationLink

  /** Numbered page items for multi-page navigation. */
  items?: ResolvableArray<PaginationItem>

  /** Accessibility label for the navigation landmark. Defaults to "Pagination". */
  landmarkLabel?: ResolvableString

  /** Additional CSS classes for the pagination nav element. */
  classes?: ResolvableString

  /** Custom HTML attributes for the pagination nav element. */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Pagination component.
 *
 * Use this to navigate between pages. Supports previous/next links with labels, and
 * numbered page navigation.
 *
 * @see https://design-system.service.gov.uk/components/pagination/
 * @example
 * ```typescript
 * GovUKPagination({
 *   previous: {
 *     href: '/docs/introduction',
 *     labelText: 'Introduction',
 *   },
 *   next: {
 *     href: '/docs/getting-started',
 *     labelText: 'Getting Started',
 *   },
 * })
 * ```
 */
export const GovUKPagination = nunjucksComponent<GovUKPagination>('govukPagination', {
  render: (props, nunjucksEnv) => {
    const params: Record<string, any> = {
      previous: props.previous?.visibleWhen === false ? undefined : props.previous,
      next: props.next?.visibleWhen === false ? undefined : props.next,
      items: props.items?.filter(item => item.visibleWhen !== false),
      landmarkLabel: props.landmarkLabel,
      classes: props.classes,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('govuk/components/pagination/template.njk', { params })
  },
})
