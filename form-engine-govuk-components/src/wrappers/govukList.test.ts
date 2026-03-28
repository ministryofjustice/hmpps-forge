import { Data } from '@form-engine/form/builders'
import { GovUKList } from './govukList'

describe('GovUKList', () => {
  describe('tag and classes', () => {
    it('should render a plain list by default', () => {
      // Arrange & Act
      const result = GovUKList({ items: Data('items') })

      // Assert
      expect(result.tag).toBe('ul')
      expect(result.classes).toBe('govuk-list')
    })

    it('should render a bullet list', () => {
      // Arrange & Act
      const result = GovUKList({ items: Data('items'), type: 'bullet' })

      // Assert
      expect(result.tag).toBe('ul')
      expect(result.classes).toBe('govuk-list govuk-list--bullet')
    })

    it('should render a numbered list with ol tag', () => {
      // Arrange & Act
      const result = GovUKList({ items: Data('items'), type: 'number' })

      // Assert
      expect(result.tag).toBe('ol')
      expect(result.classes).toBe('govuk-list govuk-list--number')
    })

    it('should apply spaced modifier', () => {
      // Arrange & Act
      const result = GovUKList({ items: Data('items'), type: 'bullet', spaced: true })

      // Assert
      expect(result.tag).toBe('ul')
      expect(result.classes).toBe('govuk-list govuk-list--bullet govuk-list--spaced')
    })
  })

  describe('block properties', () => {
    it('should return an html variant', () => {
      // Arrange & Act
      const result = GovUKList({ items: Data('items') })

      // Assert
      expect(result.variant).toBe('html')
    })

    it('should pass through hidden prop', () => {
      // Arrange & Act
      const result = GovUKList({ items: Data('items'), hidden: true })

      // Assert
      expect(result.hidden).toBe(true)
    })

    it('should append custom classes to the list', () => {
      // Arrange & Act
      const result = GovUKList({ items: Data('items'), type: 'bullet', classes: 'govuk-!-margin-top-4' })

      // Assert
      expect(result.classes).toBe('govuk-list govuk-list--bullet govuk-!-margin-top-4')
    })
  })
})
