import type nunjucks from 'nunjucks'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalString,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

/**
 * Pagination link configuration for previous/next navigation.
 */
export interface PaginationLink {
  /** The link's URL. Required. */
  href: ConditionalString

  /** Text content of the link. Defaults to "Previous page" or "Next page". */
  text?: ConditionalString

  /** HTML content of the link. Takes precedence over text. */
  html?: ConditionalString

  /** Label underneath the link providing context (e.g., "Introduction"). */
  labelText?: ConditionalString

  /** Custom HTML attributes for the anchor element. */
  attributes?: Record<string, any>
}

/**
 * Pagination item for numbered page navigation.
 */
export interface PaginationItem {
  /** The page number text. Required unless ellipsis is true. */
  number?: ConditionalString

  /** Visually hidden label for screen readers (e.g., "Page 1"). */
  visuallyHiddenText?: ConditionalString

  /** The link's URL. Required unless ellipsis is true. */
  href?: ConditionalString

  /** Set to true to indicate the current page. */
  current?: boolean

  /** Set to true to render an ellipsis instead of a page number. */
  ellipsis?: boolean

  /** Custom HTML attributes for the anchor element. */
  attributes?: Record<string, any>
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
  items?: PaginationItem[]

  /** Accessibility label for the navigation landmark. Defaults to "Pagination". */
  landmarkLabel?: ConditionalString

  /** Additional CSS classes for the pagination nav element. */
  classes?: ConditionalString

  /** Custom HTML attributes for the pagination nav element. */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Pagination Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKPaginationProps` type or the `GovUKPagination()` wrapper function instead.
 */
export interface GovUKPagination extends BlockDefinition, GovUKPaginationProps {
  /** Component variant identifier */
  variant: 'govukPagination'
}

/**
 * Renders the GOV.UK Pagination component using the official Nunjucks template.
 */
async function paginationRenderer(
  block: EvaluatedBlock<GovUKPagination>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  const params: Record<string, any> = {
    previous: block.previous,
    next: block.next,
    items: block.items,
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
  return blockBuilder<GovUKPagination>({ ...props, variant: 'govukPagination' })
}
