import { GovUKSectionBreak } from './govukSectionBreak'

describe('GovUKSectionBreak', () => {
  describe('tag and classes', () => {
    it('should use an hr tag with default section break class', () => {
      // Arrange & Act
      const result = GovUKSectionBreak()

      // Assert
      expect(result.tag).toBe('hr')
      expect(result.classes).toBe('govuk-section-break')
    })

    it('should apply size modifier', () => {
      // Arrange & Act
      const result = GovUKSectionBreak({ size: 'l' })

      // Assert
      expect(result.tag).toBe('hr')
      expect(result.classes).toBe('govuk-section-break govuk-section-break--l')
    })

    it('should apply visible modifier', () => {
      // Arrange & Act
      const result = GovUKSectionBreak({ visible: true })

      // Assert
      expect(result.tag).toBe('hr')
      expect(result.classes).toBe('govuk-section-break govuk-section-break--visible')
    })

    it('should apply both size and visible modifiers', () => {
      // Arrange & Act
      const result = GovUKSectionBreak({ size: 'xl', visible: true })

      // Assert
      expect(result.tag).toBe('hr')
      expect(result.classes).toBe('govuk-section-break govuk-section-break--xl govuk-section-break--visible')
    })
  })

  describe('block properties', () => {
    it('should return an html variant', () => {
      // Arrange & Act
      const result = GovUKSectionBreak()

      // Assert
      expect(result.variant).toBe('html')
    })

    it('should pass through hidden prop', () => {
      // Arrange & Act
      const result = GovUKSectionBreak({ hidden: true })

      // Assert
      expect(result.hidden).toBe(true)
    })

    it('should append custom classes to the section break', () => {
      // Arrange & Act
      const result = GovUKSectionBreak({ size: 'm', visible: true, classes: 'govuk-!-margin-top-4' })

      // Assert
      expect(result.classes).toBe(
        'govuk-section-break govuk-section-break--m govuk-section-break--visible govuk-!-margin-top-4',
      )
    })
  })
})
