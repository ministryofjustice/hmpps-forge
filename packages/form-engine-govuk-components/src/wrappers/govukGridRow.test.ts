import { HtmlBlock } from '@form-engine/registry/components/html'
import { GovUKGridRow } from './govukGridRow'

describe('GovUKGridRow', () => {
  describe('template', () => {
    it('should create a grid row with column widths', () => {
      // Arrange
      const blockA = HtmlBlock({ content: 'A' })
      const blockB = HtmlBlock({ content: 'B' })

      // Act
      const result = GovUKGridRow({
        columns: [
          { width: 'one-third', blocks: [blockA] },
          { width: 'two-thirds', blocks: [blockB] },
        ],
      })

      // Assert
      expect(result.template).toBe(
        '<div class="govuk-grid-row">' +
          '<div class="govuk-grid-column-one-third">{{slot:col0}}</div>' +
          '<div class="govuk-grid-column-two-thirds">{{slot:col1}}</div>' +
          '</div>',
      )
    })

    it('should append additional classes to the row', () => {
      // Arrange
      const block = HtmlBlock({ content: 'A' })

      // Act
      const result = GovUKGridRow({
        columns: [{ width: 'full', blocks: [block] }],
        classes: 'step-row govuk-!-margin-bottom-2',
      })

      // Assert
      expect(result.template).toContain('class="govuk-grid-row step-row govuk-!-margin-bottom-2"')
    })

    it('should not append extra space when no additional classes provided', () => {
      // Arrange
      const block = HtmlBlock({ content: 'A' })

      // Act
      const result = GovUKGridRow({ columns: [{ width: 'full', blocks: [block] }] })

      // Assert
      expect(result.template).toContain('class="govuk-grid-row"')
    })

    it('should include attributes on the row element', () => {
      // Arrange
      const block = HtmlBlock({ content: 'A' })

      // Act
      const result = GovUKGridRow({
        columns: [{ width: 'full', blocks: [block] }],
        attributes: { 'data-qa': 'step-row' },
      })

      // Assert
      expect(result.template).toContain('data-qa="step-row"')
    })
  })

  describe('slots', () => {
    it('should map each column to a named slot', () => {
      // Arrange
      const blockA = HtmlBlock({ content: 'A' })
      const blockB = HtmlBlock({ content: 'B' })
      const blockC = HtmlBlock({ content: 'C' })

      // Act
      const result = GovUKGridRow({
        columns: [
          { width: 'one-quarter', blocks: [blockA] },
          { width: 'two-thirds', blocks: [blockB] },
          { width: 'one-sixth', blocks: [blockC] },
        ],
      })

      // Assert
      expect(result.slots).toEqual({
        col0: [blockA],
        col1: [blockB],
        col2: [blockC],
      })
    })

    it('should support multiple blocks per column', () => {
      // Arrange
      const blockA = HtmlBlock({ content: 'A' })
      const blockB = HtmlBlock({ content: 'B' })

      // Act
      const result = GovUKGridRow({ columns: [{ width: 'two-thirds', blocks: [blockA, blockB] }] })

      // Assert
      expect(result.slots).toEqual({
        col0: [blockA, blockB],
      })
    })
  })

  describe('block properties', () => {
    it('should return a templateWrapper variant', () => {
      // Arrange
      const block = HtmlBlock({ content: 'A' })

      // Act
      const result = GovUKGridRow({ columns: [{ width: 'full', blocks: [block] }] })

      // Assert
      expect(result.variant).toBe('templateWrapper')
    })

    it('should pass through hidden prop', () => {
      // Arrange
      const block = HtmlBlock({ content: 'A' })

      // Act
      const result = GovUKGridRow({ columns: [{ width: 'full', blocks: [block] }], hidden: true })

      // Assert
      expect(result.hidden).toBe(true)
    })
  })
})
