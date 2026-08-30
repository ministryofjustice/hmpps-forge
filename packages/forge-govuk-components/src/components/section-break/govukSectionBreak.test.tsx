
import { ComponentTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { GovUKSectionBreak } from './govukSectionBreak'

const harness = new ComponentTestHarness(GovUKSectionBreak)

const render = (props: GovUKSectionBreak) => harness.render(GovUKSectionBreak(props))

describe('GovUKSectionBreak', () => {
  describe('block building', () => {
    it('should stamp the govukSectionBreak variant when called as a builder', async () => {
      // Arrange & Act
      const built = GovUKSectionBreak()

      // Assert
      expect(built.variant).toBe('govukSectionBreak')
    })
  })

  describe('rendering', () => {
    it('should render a spacing-only hr by default', async () => {
      // Arrange & Act
      const output = await render({})

      // Assert
      expect(output).toBe('<hr class="govuk-section-break">')
    })

    it('should apply the size modifier', async () => {
      // Arrange & Act
      const output = await render({ size: 'xl' })

      // Assert
      expect(output).toBe('<hr class="govuk-section-break govuk-section-break--xl">')
    })

    it('should apply the visible modifier', async () => {
      // Arrange & Act
      const output = await render({ size: 'l', visible: true })

      // Assert
      expect(output).toBe('<hr class="govuk-section-break govuk-section-break--l govuk-section-break--visible">')
    })

    it('should append additional classes and attributes', async () => {
      // Arrange & Act
      const output = await render({ classes: 'app-break', attributes: { 'data-qa': 'divider' } })

      // Assert
      expect(output).toBe('<hr class="govuk-section-break app-break" data-qa="divider">')
    })
  })
})
