import { HtmlBlock } from '@form-engine/registry/components/html'
import { GovUKButtonGroup } from './govukButtonGroup'

describe('GovUKButtonGroup', () => {
  describe('template', () => {
    it('should wrap buttons in a govuk-button-group div', () => {
      // Arrange
      const buttonA = HtmlBlock({ content: 'A' })
      const buttonB = HtmlBlock({ content: 'B' })

      // Act
      const result = GovUKButtonGroup({ buttons: [buttonA, buttonB] })

      // Assert
      expect(result.template).toBe('<div class="govuk-button-group">{{slot:child0}}{{slot:child1}}</div>')
    })

    it('should handle a single button', () => {
      // Arrange
      const button = HtmlBlock({ content: 'A' })

      // Act
      const result = GovUKButtonGroup({ buttons: [button] })

      // Assert
      expect(result.template).toBe('<div class="govuk-button-group">{{slot:child0}}</div>')
    })
  })

  describe('slots', () => {
    it('should map each button to a named slot', () => {
      // Arrange
      const buttonA = HtmlBlock({ content: 'A' })
      const buttonB = HtmlBlock({ content: 'B' })
      const buttonC = HtmlBlock({ content: 'C' })

      // Act
      const result = GovUKButtonGroup({ buttons: [buttonA, buttonB, buttonC] })

      // Assert
      expect(result.slots).toEqual({
        child0: [buttonA],
        child1: [buttonB],
        child2: [buttonC],
      })
    })
  })

  describe('block properties', () => {
    it('should return a templateWrapper variant', () => {
      // Arrange
      const button = HtmlBlock({ content: 'A' })

      // Act
      const result = GovUKButtonGroup({ buttons: [button] })

      // Assert
      expect(result.variant).toBe('templateWrapper')
    })

    it('should pass through hidden prop', () => {
      // Arrange
      const button = HtmlBlock({ content: 'A' })

      // Act
      const result = GovUKButtonGroup({ buttons: [button], hidden: true })

      // Assert
      expect(result.hidden).toBe(true)
    })

    it('should append custom classes to the button group', () => {
      // Arrange
      const button = HtmlBlock({ content: 'A' })

      // Act
      const result = GovUKButtonGroup({ buttons: [button], classes: 'govuk-!-margin-top-4' })

      // Assert
      expect(result.template).toBe('<div class="govuk-button-group govuk-!-margin-top-4">{{slot:child0}}</div>')
    })
  })
})
