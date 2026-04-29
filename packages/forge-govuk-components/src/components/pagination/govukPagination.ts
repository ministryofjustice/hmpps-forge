import type nunjucks from 'nunjucks'
import {
  BasicBlockProps,
  BlockDefinition,
  ResolvableArray,
  ResolvableBoolean,
  ResolvableString,
  EvaluatedBlock,
} from '@ministryofjustice/hmpps-forge/core/components'
import { buildNunjucksComponent } from '@ministryofjustice/hmpps-forge/express-nunjucks'
import { block as buildBlock } from '@ministryofjustice/hmpps-forge/core/authoring'

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
 * Props for the GovUKPagination component.
 * Provides navigation between pages with previous/next links and numbered page navigation.
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
export interface GovUKPaginationProps extends BasicBlockProps {
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
 * GOV.UK Pagination Component
 *
 * Full interface including forge discriminator properties.
 * For most use cases, use `GovUKPaginationProps` type or the `GovUKPagination()` wrapper function instead.
 */
export interface GovUKPagination extends BlockDefinition, GovUKPaginationProps {
  /** Component variant identifier */
  variant: 'govukPagination'
}

/**
 * Renders the GOV.UK Pagination component using the official Nunjucks template.
 */
function paginationRenderer(block: EvaluatedBlock<GovUKPagination>, nunjucksEnv: nunjucks.Environment): string {
  const params: Record<string, any> = {
    previous: block.previous?.visibleWhen === false ? undefined : block.previous,
    next: block.next?.visibleWhen === false ? undefined : block.next,
    items: block.items?.filter(item => item.visibleWhen !== false),
    landmarkLabel: block.landmarkLabel,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('govuk/components/pagination/template.njk', { params })
}

export const govukPagination = buildNunjucksComponent<GovUKPagination>('govukPagination', paginationRenderer as any)

/**
 * Creates a GOV.UK Pagination for navigating between pages.
 * Supports previous/next links with labels, and numbered page navigation.
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
export function GovUKPagination(props: GovUKPaginationProps): GovUKPagination {
  return buildBlock<GovUKPagination>({ ...props, variant: 'govukPagination' })
}
