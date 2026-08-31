import { BlockDefinition } from '@ministryofjustice/hmpps-forge/core/components'
import { jsxComponent, raw } from '@ministryofjustice/hmpps-forge/jsx-components'

type GridColumnWidth = 'full' | 'one-half' | 'one-third' | 'two-thirds' | 'one-quarter' | 'three-quarters' | 'one-sixth'

export interface GovUKGridColumn {
  width: GridColumnWidth
  blocks: BlockDefinition[]
}

/**
 * Wraps child blocks in a GOV.UK grid row with responsive column widths.
 *
 * @see https://design-system.service.gov.uk/styles/layout/#grid-system
 * @example
 * ```typescript
 * GovUKGridRow({
 *   columns: [
 *     { width: 'one-quarter', blocks: [labelBlock] },
 *     { width: 'two-thirds', blocks: [inputField] },
 *     { width: 'one-sixth', blocks: [removeButton] },
 *   ],
 * })
 * ```
 */
export interface GovUKGridRow {
  /** Column definitions with width and child blocks. */
  columns: GovUKGridColumn[]

  /** Additional CSS classes to append to the row. */
  classes?: string

  /** HTML attributes to add to the row element. */
  attributes?: Record<string, any>
}

/**
 * Wraps child blocks in a GOV.UK grid row with responsive column widths.
 *
 * @see https://design-system.service.gov.uk/styles/layout/#grid-system
 * @example
 * ```typescript
 * GovUKGridRow({
 *   columns: [{ width: 'one-half', blocks: [textInput] }],
 * })
 * ```
 */
export const GovUKGridRow = jsxComponent<GovUKGridRow>('govukGridRow', {
  factory:
    () =>
    props => {
      const className = props.classes ? `govuk-grid-row ${props.classes}` : 'govuk-grid-row'

      return (
        <div class={className} {...props.attributes}>
          {props.columns.map(column => (
            <div class={`govuk-grid-column-${column.width}`}>{column.blocks.map(block => raw(block.html))}</div>
          ))}
        </div>
      )
    },
})
