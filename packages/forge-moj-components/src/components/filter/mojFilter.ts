import { ResolvableBlockProps } from '@ministryofjustice/hmpps-forge/core/components'
import { nunjucksComponent } from '../../utils/nunjucksComponent'

/**
 * Heading configuration for the filter component.
 */
export interface MOJFilterHeading {
  /** Heading text (required if html not set) */
  text?: string

  /** Heading HTML content (required if text not set) */
  html?: string
}

/**
 * Clear link configuration for selected filters.
 */
export interface MOJFilterClearLink {
  /** URL for the clear all filters link */
  href: string

  /** Text for the clear link (e.g. "Clear filters") */
  text: string
}

/**
 * Individual selected filter tag item.
 */
export interface MOJFilterTagItem {
  /** URL to remove this filter */
  href: string

  /** Display text for the filter tag */
  text: string

  /** Conditional visibility for this filter tag */
  visibleWhen?: boolean
}

/**
 * Category of selected filters with heading and removable tags.
 */
export interface MOJFilterCategory {
  /** Heading for this category of filters */
  heading: MOJFilterHeading

  /** Array of filter tag items in this category */
  items: MOJFilterTagItem[]

  /** Conditional visibility for this filter category */
  visibleWhen?: boolean
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
  categories: MOJFilterCategory[]
}

/**
 * Submit button configuration for applying filters.
 */
export interface MOJFilterSubmit {
  /** Button text (default: "Apply filters") */
  text?: string

  /** Additional HTML attributes for the submit button */
  attributes?: Record<string, string>
}

/**
 * MOJ Filter component.
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
export type MOJFilter = ResolvableBlockProps<{
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
  optionsHtml?: string

  /**
   * Additional CSS classes for the filter container.
   * @example 'app-filter--custom'
   */
  classes?: string

  /**
   * Additional HTML attributes for the filter container.
   * @example { 'data-module': 'app-filter' }
   */
  attributes?: Record<string, string>
}>

/**
 * MOJ Filter component.
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
export const MOJFilter = nunjucksComponent<MOJFilter>('mojFilter', {
  render: (props, nunjucksEnv) => {
    const selectedFilters = props.selectedFilters
      ? {
          ...props.selectedFilters,
          categories: props.selectedFilters.categories
            .filter(category => category.visibleWhen !== false)
            .map(category => ({
              ...category,
              items: category.items.filter(item => item.visibleWhen !== false),
            })),
        }
      : undefined

    const params = {
      heading: props.heading,
      selectedFilters,
      submit: props.submit,
      optionsHtml: props.optionsHtml,
      classes: props.classes,
      attributes: props.attributes,
    }

    return nunjucksEnv.render('moj/components/filter/template.njk', { params })
  },
})
