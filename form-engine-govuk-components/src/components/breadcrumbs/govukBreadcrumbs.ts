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
 * Individual breadcrumb item configuration.
 */
export interface BreadcrumbItem {
  /** Plain text content for the breadcrumb. Required unless html is provided. */
  text?: ConditionalString

  /** HTML content for the breadcrumb. Takes precedence over text. */
  html?: ConditionalString

  /** Link URL for the breadcrumb. If not specified, renders as plain text. */
  href?: ConditionalString

  /** Custom HTML attributes for the breadcrumb item. */
  attributes?: Record<string, any>
}

/**
 * Props for the GovUKBreadcrumbs component.
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
export interface GovUKBreadcrumbsProps extends BasicBlockProps {
  /** The breadcrumb items to display. Required. */
  items: BreadcrumbItem[]

  /** When true, collapses to first and last item only on mobile. */
  collapseOnMobile?: boolean

  /** Accessibility label for the navigation landmark. Defaults to "Breadcrumb". */
  labelText?: ConditionalString

  /** Additional CSS classes for the breadcrumbs container. */
  classes?: ConditionalString

  /** Custom HTML attributes for the breadcrumbs container. */
  attributes?: Record<string, any>
}

/**
 * GOV.UK Breadcrumbs component interface.
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `GovUKBreadcrumbsProps` type or the `GovUKBreadcrumbs()` wrapper function instead.
 */
export interface GovUKBreadcrumbs extends BlockDefinition, GovUKBreadcrumbsProps {
  /** Component variant identifier */
  variant: 'govukBreadcrumbs'
}

/**
 * Renders the GOV.UK Breadcrumbs component using the official Nunjucks template.
 */
async function breadcrumbsRenderer(
  block: EvaluatedBlock<GovUKBreadcrumbs>,
  nunjucksEnv: nunjucks.Environment,
): Promise<string> {
  const params: Record<string, any> = {
    items: block.items,
    collapseOnMobile: block.collapseOnMobile,
    labelText: block.labelText,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('govuk/components/breadcrumbs/template.njk', { params })
}

export const govukBreadcrumbs = buildNunjucksComponent<GovUKBreadcrumbs>('govukBreadcrumbs', breadcrumbsRenderer)

/**
 * Creates a GOV.UK Breadcrumbs block for navigation hierarchy.
 * Helps users understand where they are and navigate back to higher levels.
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
export function GovUKBreadcrumbs(props: GovUKBreadcrumbsProps): GovUKBreadcrumbs {
  return blockBuilder<GovUKBreadcrumbs>({ ...props, variant: 'govukBreadcrumbs' })
}
