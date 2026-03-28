import { TemplateWrapper } from '@form-engine/registry/components/templateWrapper'
import type { BasicBlockProps, BlockDefinition } from '@form-engine/form/types/structures.type'

type GridColumnWidth = 'full' | 'one-half' | 'one-third' | 'two-thirds' | 'one-quarter' | 'three-quarters' | 'one-sixth'

export interface GovUKGridColumn {
  width: GridColumnWidth
  blocks: BlockDefinition[]
}

export interface GovUKGridRowProps extends BasicBlockProps {
  /** Column definitions with width and child blocks. */
  columns: GovUKGridColumn[]

  /** Additional CSS classes to append to the row. */
  classes?: string

  /** HTML attributes to add to the wrapper element. */
  attributes?: Record<string, any>
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
export function GovUKGridRow(props: GovUKGridRowProps): TemplateWrapper {
  const { columns, classes, attributes, ...blockProps } = props
  const rowClasses = classes ? `govuk-grid-row ${classes}` : 'govuk-grid-row'
  const rowAttrs = attributes
    ? Object.entries(attributes)
        .map(([key, value]) => ` ${key}="${String(value)}"`)
        .join('')
    : ''

  return TemplateWrapper({
    ...blockProps,
    template: `<div class="${rowClasses}"${rowAttrs}>${columns.map((col, i) => `<div class="govuk-grid-column-${col.width}">{{slot:col${i}}}</div>`).join('')}</div>`,
    slots: Object.fromEntries(columns.map((col, i) => [`col${i}`, col.blocks])),
  })
}
