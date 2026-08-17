import type { EvaluatedBlock } from '@ministryofjustice/hmpps-forge/core/components'

import { GovUKButtonGroup } from './govukButtonGroup'

const render = (props: Record<string, unknown>) => GovUKButtonGroup.render(props as EvaluatedBlock<GovUKButtonGroup>)

const renderedButton = (html: string) => ({ block: { variant: 'govukButton' }, html })

describe('GovUKButtonGroup', () => {
  describe('block building', () => {
    it('should stamp the govukButtonGroup variant when called as a builder', () => {
      // Arrange & Act
      const built = GovUKButtonGroup({ buttons: [] })

      // Assert
      expect(built.variant).toBe('govukButtonGroup')
    })
  })

  describe('rendering', () => {
    it('should wrap rendered child buttons in the button group div', () => {
      // Arrange
      const buttons = [
        renderedButton('<button class="govuk-button">Save</button>'),
        renderedButton('<a class="govuk-button govuk-button--secondary">Cancel</a>'),
      ]

      // Act
      const output = render({ buttons })

      // Assert
      expect(output).toBe(
        '<div class="govuk-button-group">' +
          '<button class="govuk-button">Save</button>' +
          '<a class="govuk-button govuk-button--secondary">Cancel</a>' +
          '</div>',
      )
    })

    it('should embed child HTML verbatim without escaping', () => {
      // Arrange
      const buttons = [renderedButton('<button data-qa="save">Save & continue</button>')]

      // Act
      const output = render({ buttons })

      // Assert
      expect(output).toBe('<div class="govuk-button-group"><button data-qa="save">Save & continue</button></div>')
    })

    it('should render an empty group when there are no buttons', () => {
      // Arrange & Act
      const output = render({ buttons: [] })

      // Assert
      expect(output).toBe('<div class="govuk-button-group"></div>')
    })

    it('should append additional classes and attributes', () => {
      // Arrange & Act
      const output = render({ buttons: [], classes: 'app-actions', attributes: { 'data-qa': 'actions' } })

      // Assert
      expect(output).toBe('<div class="govuk-button-group app-actions" data-qa="actions"></div>')
    })
  })
})
