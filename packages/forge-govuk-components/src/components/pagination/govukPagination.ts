import { nunjucksComponent } from '../../utils/nunjucksComponent'

/**
 * Pagination link configuration for previous/next navigation.
 */
export interface PaginationLink {
  /** The link's URL. Required. */
  href: string

  /** Text content of the link. Defaults to "Previous page" or "Next page". */
  text?: string

  /** HTML content of the link. Takes precedence over text. */
  html?: string

  /** Label underneath the link providing context (e.g., "Introduction"). */
  labelText?: string

  /** Custom HTML attributes for the anchor element. */
  attributes?: Record<string, any>

  /**
   * Conditional visibility for this link. When the evaluated value is `false`,
   * the link is omitted from rendering. Defaults to showing the link.
   */
  visibleWhen?: boolean
}

/**
 * Pagination item for numbered page navigation.
 */
export interface PaginationItem {
  /** The page number text. Required unless ellipsis is true. */
  number?: string

  /** Visually hidden label for screen readers (e.g., "Page 1"). */
  visuallyHiddenText?: string

  /** The link's URL. Required unless ellipsis is true. */
  href?: string

  /** Set to true to indicate the current page. */
  current?: boolean

  /** Set to true to render an ellipsis instead of a page number. */
  ellipsis?: boolean

  /** Custom HTML attributes for the anchor element. */
  attributes?: Record<string, any>

  /**
   * Conditional visibility for this item. When the evaluated value is `false`,
   * the item is omitted from rendering. Defaults to showing the item.
   */
  visibleWhen?: boolean
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
export interface GovUKPagination {
  /** Link to the previous page. */
  previous?: PaginationLink

  /** Link to the next page. */
  next?: PaginationLink

  /** Numbered page items for multi-page navigation. */
  items?: PaginationItem[]

  /** Accessibility label for the navigation landmark. Defaults to "Pagination". */
  landmarkLabel?: string

  /** Additional CSS classes for the pagination nav element. */
  classes?: string

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
  factory:
    ({ nunjucksEnv }) =>
    props => {
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
