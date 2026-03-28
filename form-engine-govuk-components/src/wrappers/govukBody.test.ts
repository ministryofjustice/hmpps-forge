import { GovUKBody } from './govukBody'

describe('GovUKBody', () => {
  describe('tag and classes', () => {
    it('should use a p tag with default body class', () => {
      // Arrange & Act
      const result = GovUKBody({ text: 'Hello world' })

      // Assert
      expect(result.tag).toBe('p')
      expect(result.classes).toBe('govuk-body')
      expect(result.content).toBe('Hello world')
    })

    it('should use lead paragraph class with size l', () => {
      // Arrange & Act
      const result = GovUKBody({ text: 'Introduction', size: 'l' })

      // Assert
      expect(result.tag).toBe('p')
      expect(result.classes).toBe('govuk-body-l')
    })

    it('should use small paragraph class with size s', () => {
      // Arrange & Act
      const result = GovUKBody({ text: 'Fine print', size: 's' })

      // Assert
      expect(result.tag).toBe('p')
      expect(result.classes).toBe('govuk-body-s')
    })
  })

  describe('block properties', () => {
    it('should return an html variant', () => {
      // Arrange & Act
      const result = GovUKBody({ text: 'Text' })

      // Assert
      expect(result.variant).toBe('html')
    })

    it('should pass through hidden prop', () => {
      // Arrange & Act
      const result = GovUKBody({ text: 'Text', hidden: true })

      // Assert
      expect(result.hidden).toBe(true)
    })

    it('should append custom classes to the paragraph', () => {
      // Arrange & Act
      const result = GovUKBody({ text: 'Text', classes: 'govuk-!-margin-bottom-0' })

      // Assert
      expect(result.classes).toBe('govuk-body govuk-!-margin-bottom-0')
    })
  })
})
