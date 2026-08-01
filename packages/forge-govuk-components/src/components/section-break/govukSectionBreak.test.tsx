import type { EvaluatedBlock } from '@ministryofjustice/hmpps-forge/core/components'

import { GovUKSectionBreak } from './govukSectionBreak'

const render = (props: Record<string, unknown>) => GovUKSectionBreak.render(props as EvaluatedBlock<GovUKSectionBreak>)

describe('GovUKSectionBreak', () => {
  describe('block building', () => {
    it('should stamp the govukSectionBreak variant when called as a builder', () => {
      // Arrange & Act
      const built = GovUKSectionBreak({})

      // Assert
      expect(built.variant).toBe('govukSectionBreak')
    })
  })

  describe('rendering', () => {
    it('should render a spacing-only hr by default', () => {
      // Arrange & Act
      const output = render({})

      // Assert
      expect(output).toBe('<hr class="govuk-section-break">')
    })

    it('should apply the size modifier', () => {
      // Arrange & Act
      const output = render({ size: 'xl' })

      // Assert
      expect(output).toBe('<hr class="govuk-section-break govuk-section-break--xl">')
    })

    it('should apply the visible modifier', () => {
      // Arrange & Act
      const output = render({ size: 'l', visible: true })

      // Assert
      expect(output).toBe('<hr class="govuk-section-break govuk-section-break--l govuk-section-break--visible">')
    })

    it('should append additional classes and attributes', () => {
      // Arrange & Act
      const output = render({ classes: 'app-break', attributes: { 'data-qa': 'divider' } })

      // Assert
      expect(output).toBe('<hr class="govuk-section-break app-break" data-qa="divider">')
    })
  })
})
