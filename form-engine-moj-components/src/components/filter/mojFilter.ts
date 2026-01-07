import type nunjucks from 'nunjucks'

import { buildNunjucksComponent } from '@form-engine-moj-components/internal/buildNunjucksComponent'
import {
  BasicBlockProps,
  BlockDefinition,
  ConditionalString,
  ConditionalArray,
  EvaluatedBlock,
} from '@form-engine/form/types/structures.type'
import { block as blockBuilder } from '@form-engine/form/builders'

/**
 * Heading configuration for the filter component.
 */
export interface MOJFilterHeading {
  /** Heading text (required if html not set) */
  text?: ConditionalString

  /** Heading HTML content (required if text not set) */
  html?: ConditionalString
}

/**
 * Clear link configuration for selected filters.
 */
export interface MOJFilterClearLink {
  /** URL for the clear all filters link */
  href: ConditionalString

  /** Text for the clear link (e.g. "Clear filters") */
  text: ConditionalString
}

/**
 * Individual selected filter tag item.
 */
export interface MOJFilterTagItem {
  /** URL to remove this filter */
  href: ConditionalString

  /** Display text for the filter tag */
  text: ConditionalString
}

/**
 * Category of selected filters with heading and removable tags.
 */
export interface MOJFilterCategory {
  /** Heading for this category of filters */
  heading: MOJFilterHeading

  /** Array of filter tag items in this category */
  items: ConditionalArray<MOJFilterTagItem>
}

/**
 * Selected filters configuration showing active filter tags.
 */
export interface MOJFilterSelectedFilters {
  /** Heading for the selected filters section */
  heading: MOJFilterHeading

  /** Link to clear all selected filters */
  clearLink: MOJFilterClearLink

  /** Categories of selected filter tags */
  categories: ConditionalArray<MOJFilterCategory>
}

/**
 * Submit button configuration for applying filters.
 */
export interface MOJFilterSubmit {
  /** Button text (default: "Apply filters") */
  text?: ConditionalString

  /** Additional HTML attributes for the submit button */
  attributes?: Record<string, string>
}

/**
 * Props for the MOJFilter component.
 *
 * The filter component provides a panel for filtering content on a page.
 * It includes a heading, optional display of selected filter tags,
 * and an area for filter form controls.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/filter
 * @example
 * ```typescript
 * MOJFilter({
 *   heading: { text: 'Filter' },
 *   submit: { text: 'Apply filters' },
 *   optionsHtml: '<div class="govuk-form-group">...filter controls...</div>',
 *   selectedFilters: {
 *     heading: { text: 'Selected filters' },
 *     clearLink: { href: '/clear', text: 'Clear filters' },
 *     categories: [
 *       {
 *         heading: { text: 'Status' },
 *         items: [
 *           { text: 'Active', href: '/remove-active' },
 *           { text: 'Pending', href: '/remove-pending' },
 *         ],
 *       },
 *     ],
 *   },
 * })
 * ```
 */
export interface MOJFilterProps extends BasicBlockProps {
  /**
   * Heading for the filter panel.
   * @example { text: 'Filter' }
   * @example { html: '<span>Filter</span>' }
   */
  heading: MOJFilterHeading

  /**
   * Configuration for displaying selected filter tags.
   * Shows active filters that can be individually removed.
   * @example { heading: { text: 'Selected' }, clearLink: { href: '/clear', text: 'Clear' }, categories: [] }
   */
  selectedFilters?: MOJFilterSelectedFilters

  /**
   * Submit button configuration for applying filters.
   * @example { text: 'Apply filters' }
   * @example { text: 'Search', attributes: { 'data-tracking': 'filter-submit' } }
   */
  submit?: MOJFilterSubmit

  /**
   * HTML content for the filter options/form controls.
   * This should contain the form fields for filtering.
   * @example '<div class="govuk-form-group"><label>...</label><input>...</div>'
   */
  optionsHtml?: ConditionalString

  /**
   * Additional CSS classes for the filter container.
   * @example 'app-filter--custom'
   */
  classes?: ConditionalString

  /**
   * Additional HTML attributes for the filter container.
   * @example { 'data-module': 'app-filter' }
   */
  attributes?: Record<string, string>
}

/**
 * MOJ Filter Component
 *
 * Full interface including form-engine discriminator properties.
 * For most use cases, use `MOJFilterProps` type or the `MOJFilter()` wrapper function instead.
 */
export interface MOJFilter extends BlockDefinition, MOJFilterProps {
  /** Component variant identifier */
  variant: 'mojFilter'
}

/**
 * Renders an MOJ Filter component using Nunjucks template
 */
async function filterRenderer(block: EvaluatedBlock<MOJFilter>, nunjucksEnv: nunjucks.Environment): Promise<string> {
  const params = {
    heading: block.heading,
    selectedFilters: block.selectedFilters,
    submit: block.submit,
    optionsHtml: block.optionsHtml,
    classes: block.classes,
    attributes: block.attributes,
  }

  return nunjucksEnv.render('moj/components/filter/template.njk', { params })
}

export const mojFilter = buildNunjucksComponent<MOJFilter>('mojFilter', filterRenderer)

/**
 * Creates an MOJ Filter block for filtering page content.
 *
 * The filter component displays a panel with filter controls.
 * It can show currently selected filters as removable tags and
 * provides an area for form controls to define filter criteria.
 *
 * @see https://design-patterns.service.justice.gov.uk/components/filter
 * @example
 * ```typescript
 * MOJFilter({
 *   heading: { text: 'Filter' },
 *   submit: { text: 'Apply filters' },
 *   optionsHtml: '<div class="govuk-form-group">...filter controls...</div>',
 * })
 * ```
 */
export function MOJFilter(props: MOJFilterProps): MOJFilter {
  return blockBuilder<MOJFilter>({ ...props, variant: 'mojFilter' })
}
