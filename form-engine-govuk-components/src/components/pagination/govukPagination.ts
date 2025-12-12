import type nunjucks from 'nunjucks'
import { buildNunjucksComponent } from '@form-engine-govuk-components/internal/buildNunjucksComponent'
import { BlockDefinition, ConditionalString } from '@form-engine/form/types/structures.type'
import { StructureType } from '@form-engine/form/types/enums'

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
 * GOV.UK Pagination component for navigating between pages.
 *
 * Supports two main patterns:
 * 1. Previous/Next navigation with optional labels (for sequential content)
 * 2. Numbered page navigation with ellipsis support (for large result sets)
 *
 * @example Previous/Next with labels (for documentation)
 * ```typescript
 * block<GovUKPagination>({
 *   variant: 'govukPagination',
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
 *
 * @example Numbered pagination
 * ```typescript
 * block<GovUKPagination>({
 *   variant: 'govukPagination',
 *   previous: { href: '/results?page=1' },
 *   next: { href: '/results?page=3' },
 *   items: [
 *     { number: '1', href: '/results?page=1' },
 *     { number: '2', href: '/results?page=2', current: true },
 *     { number: '3', href: '/results?page=3' },
 *   ],
 * })
 * ```
 */
export interface GovUKPagination extends BlockDefinition {
  variant: 'govukPagination'

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
 * Runtime representation of the pagination component after evaluation.
 */
export interface EvaluatedGovUKPagination {
  type: typeof StructureType.BLOCK
  variant: 'govukPagination'
  previous?: {
    href: string
    text?: string
    html?: string
    labelText?: string
    attributes?: Record<string, string>
  }
  next?: {
    href: string
    text?: string
    html?: string
    labelText?: string
    attributes?: Record<string, string>
  }
  items?: Array<{
    number?: string
    visuallyHiddenText?: string
    href?: string
    current?: boolean
    ellipsis?: boolean
    attributes?: Record<string, string>
  }>
  landmarkLabel?: string
  classes?: string
  attributes?: Record<string, string>
}

/**
 * Renders the GOV.UK Pagination component using the official Nunjucks template.
 */
async function paginationRenderer(block: EvaluatedGovUKPagination, nunjucksEnv: nunjucks.Environment): Promise<string> {
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
