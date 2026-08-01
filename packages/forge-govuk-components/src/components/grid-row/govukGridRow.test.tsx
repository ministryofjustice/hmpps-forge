import type { EvaluatedBlock } from '@ministryofjustice/hmpps-forge/core/components'

import { GovUKGridRow } from './govukGridRow'

const render = (props: Record<string, unknown>) => GovUKGridRow.render(props as EvaluatedBlock<GovUKGridRow>)

const renderedBlock = (html: string) => ({ block: { variant: 'govukBody' }, html })

describe('GovUKGridRow', () => {
  describe('block building', () => {
    it('should stamp the govukGridRow variant when called as a builder', () => {
      // Arrange & Act
      const built = GovUKGridRow({ columns: [] })

      // Assert
      expect(built.variant).toBe('govukGridRow')
    })
  })

  describe('rendering', () => {
    it('should wrap each column of rendered blocks in a width-classed div', () => {
      // Arrange
      const columns = [
        { width: 'one-quarter', blocks: [renderedBlock('<p>Label</p>')] },
        { width: 'two-thirds', blocks: [renderedBlock('<input>'), renderedBlock('<p>Hint</p>')] },
      ]

      // Act
      const output = render({ columns })

      // Assert
      expect(output).toBe(
        '<div class="govuk-grid-row">' +
          '<div class="govuk-grid-column-one-quarter"><p>Label</p></div>' +
          '<div class="govuk-grid-column-two-thirds"><input><p>Hint</p></div>' +
          '</div>',
      )
    })

    it('should render an empty row when there are no columns', () => {
      // Arrange & Act
      const output = render({ columns: [] })

      // Assert
      expect(output).toBe('<div class="govuk-grid-row"></div>')
    })

    it('should append additional classes and attributes', () => {
      // Arrange & Act
      const output = render({ columns: [], classes: 'app-row', attributes: { 'data-qa': 'layout' } })

      // Assert
      expect(output).toBe('<div class="govuk-grid-row app-row" data-qa="layout"></div>')
    })

    it('should escape attribute values', () => {
      // Arrange & Act
      const output = render({ columns: [], attributes: { 'data-label': 'a "quoted" value' } })

      // Assert
      expect(output).toBe('<div class="govuk-grid-row" data-label="a &quot;quoted&quot; value"></div>')
    })
  })
})
