
import { component } from '@ministryofjustice/hmpps-forge/core/components'
import { ComponentRegistryTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { GovUKGridRow } from './govukGridRow'
import type { GovUKGridColumn } from './govukGridRow'

const TestBlock = component<{ html: string }>('testBlock', { render: props => props.html })

const harness = new ComponentRegistryTestHarness([GovUKGridRow, TestBlock])

const render = (props: GovUKGridRow) => harness.render(GovUKGridRow(props))

const renderedBlock = (html: string) => TestBlock({ html })

describe('GovUKGridRow', () => {
  describe('block building', () => {
    it('should stamp the govukGridRow variant when called as a builder', async () => {
      // Arrange & Act
      const built = GovUKGridRow({ columns: [] })

      // Assert
      expect(built.variant).toBe('govukGridRow')
    })
  })

  describe('rendering', () => {
    it('should wrap each column of rendered blocks in a width-classed div', async () => {
      // Arrange
      const columns: GovUKGridColumn[] = [
        { width: 'one-quarter', blocks: [renderedBlock('<p>Label</p>')] },
        { width: 'two-thirds', blocks: [renderedBlock('<input>'), renderedBlock('<p>Hint</p>')] },
      ]

      // Act
      const output = await render({ columns })

      // Assert
      expect(output).toBe(
        '<div class="govuk-grid-row">' +
          '<div class="govuk-grid-column-one-quarter"><p>Label</p></div>' +
          '<div class="govuk-grid-column-two-thirds"><input><p>Hint</p></div>' +
          '</div>',
      )
    })

    it('should render an empty row when there are no columns', async () => {
      // Arrange & Act
      const output = await render({ columns: [] })

      // Assert
      expect(output).toBe('<div class="govuk-grid-row"></div>')
    })

    it('should append additional classes and attributes', async () => {
      // Arrange & Act
      const output = await render({ columns: [], classes: 'app-row', attributes: { 'data-qa': 'layout' } })

      // Assert
      expect(output).toBe('<div class="govuk-grid-row app-row" data-qa="layout"></div>')
    })

    it('should escape attribute values', async () => {
      // Arrange & Act
      const output = await render({ columns: [], attributes: { 'data-label': 'a "quoted" value' } })

      // Assert
      expect(output).toBe('<div class="govuk-grid-row" data-label="a &quot;quoted&quot; value"></div>')
    })
  })
})
