import { GovUKHeading } from './govukHeading'

describe('GovUKHeading', () => {
  describe('tag and classes', () => {
    it('should render a default h1 with size l', () => {
      // Arrange & Act
      const result = GovUKHeading({ text: 'Page title' })

      // Assert
      expect(result.tag).toBe('h1')
      expect(result.classes).toBe('govuk-heading-l')
      expect(result.content).toBe('Page title')
    })

    it('should render with specified size', () => {
      // Arrange & Act
      const result = GovUKHeading({ text: 'Subtitle', size: 'm' })

      // Assert
      expect(result.tag).toBe('h2')
      expect(result.classes).toBe('govuk-heading-m')
    })

    it('should render xl size as h1', () => {
      // Arrange & Act
      const result = GovUKHeading({ text: 'Big title', size: 'xl' })

      // Assert
      expect(result.tag).toBe('h1')
      expect(result.classes).toBe('govuk-heading-xl')
    })

    it('should render s size as h3', () => {
      // Arrange & Act
      const result = GovUKHeading({ text: 'Small heading', size: 's' })

      // Assert
      expect(result.tag).toBe('h3')
      expect(result.classes).toBe('govuk-heading-s')
    })

    it('should allow overriding the heading level', () => {
      // Arrange & Act
      const result = GovUKHeading({ text: 'Styled as large, semantically h2', size: 'l', level: 2 })

      // Assert
      expect(result.tag).toBe('h2')
      expect(result.classes).toBe('govuk-heading-l')
    })
  })

  describe('caption', () => {
    it('should render caption with matching size class', () => {
      // Arrange & Act
      const result = GovUKHeading({ text: 'Page title', size: 'l', caption: 'Section' })

      // Assert
      expect(result.tag).toBe('h1')
      expect(result.classes).toBe('govuk-heading-l')
      expect(result.content).toEqual(
        expect.objectContaining({
          template: '<span class="govuk-caption-l">%1</span>%2',
        }),
      )
    })

    it('should not include caption markup when caption is omitted', () => {
      // Arrange & Act
      const result = GovUKHeading({ text: 'No caption' })

      // Assert
      expect(result.content).toBe('No caption')
    })
  })

  describe('block properties', () => {
    it('should return an html variant', () => {
      // Arrange & Act
      const result = GovUKHeading({ text: 'Title' })

      // Assert
      expect(result.variant).toBe('html')
    })

    it('should pass through hidden prop', () => {
      // Arrange & Act
      const result = GovUKHeading({ text: 'Title', hidden: true })

      // Assert
      expect(result.hidden).toBe(true)
    })

    it('should append custom classes to the heading', () => {
      // Arrange & Act
      const result = GovUKHeading({ text: 'Title', classes: 'govuk-!-margin-bottom-0' })

      // Assert
      expect(result.classes).toBe('govuk-heading-l govuk-!-margin-bottom-0')
    })

    it('should append custom classes to the heading when caption is present', () => {
      // Arrange & Act
      const result = GovUKHeading({ text: 'Title', caption: 'Section', classes: 'govuk-!-margin-bottom-0' })

      // Assert
      expect(result.tag).toBe('h1')
      expect(result.classes).toBe('govuk-heading-l govuk-!-margin-bottom-0')
      expect(result.content).toEqual(
        expect.objectContaining({
          template: '<span class="govuk-caption-l">%1</span>%2',
        }),
      )
    })
  })
})
