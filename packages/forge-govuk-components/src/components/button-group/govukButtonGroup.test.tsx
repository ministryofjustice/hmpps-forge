
import { component } from '@ministryofjustice/hmpps-forge/core/components'
import { ComponentRegistryTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { GovUKButtonGroup } from './govukButtonGroup'

const TestButton = component<{ html: string }>('testButton', { render: props => props.html })

const harness = new ComponentRegistryTestHarness([GovUKButtonGroup, TestButton])

const render = (props: GovUKButtonGroup) => harness.render(GovUKButtonGroup(props))

const renderedButton = (html: string) => TestButton({ html })

describe('GovUKButtonGroup', () => {
  describe('block building', () => {
    it('should stamp the govukButtonGroup variant when called as a builder', async () => {
      // Arrange & Act
      const built = GovUKButtonGroup({ buttons: [] })

      // Assert
      expect(built.variant).toBe('govukButtonGroup')
    })
  })

  describe('rendering', () => {
    it('should wrap rendered child buttons in the button group div', async () => {
      // Arrange
      const buttons = [
        renderedButton('<button class="govuk-button">Save</button>'),
        renderedButton('<a class="govuk-button govuk-button--secondary">Cancel</a>'),
      ]

      // Act
      const output = await render({ buttons })

      // Assert
      expect(output).toBe(
        '<div class="govuk-button-group">' +
          '<button class="govuk-button">Save</button>' +
          '<a class="govuk-button govuk-button--secondary">Cancel</a>' +
          '</div>',
      )
    })

    it('should embed child HTML verbatim without escaping', async () => {
      // Arrange
      const buttons = [renderedButton('<button data-qa="save">Save & continue</button>')]

      // Act
      const output = await render({ buttons })

      // Assert
      expect(output).toBe('<div class="govuk-button-group"><button data-qa="save">Save & continue</button></div>')
    })

    it('should render an empty group when there are no buttons', async () => {
      // Arrange & Act
      const output = await render({ buttons: [] })

      // Assert
      expect(output).toBe('<div class="govuk-button-group"></div>')
    })

    it('should append additional classes and attributes', async () => {
      // Arrange & Act
      const output = await render({ buttons: [], classes: 'app-actions', attributes: { 'data-qa': 'actions' } })

      // Assert
      expect(output).toBe('<div class="govuk-button-group app-actions" data-qa="actions"></div>')
    })
  })
})
