import type { EvaluatedBlock } from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKBody } from './govukBody'

const render = (props: Record<string, unknown>) => GovUKBody.render(props as EvaluatedBlock<GovUKBody>)

describe('GovUKBody', () => {
  describe('block building', () => {
    it('should stamp the govukBody variant when called as a builder', () => {
      // Arrange & Act
      const built = GovUKBody({ text: 'Hello world' })

      // Assert
      expect(built.variant).toBe('govukBody')
      expect(built.text).toBe('Hello world')
    })

    it('should pass through visibleWhen', () => {
      // Arrange & Act
      const built = GovUKBody({ text: 'Text', visibleWhen: false })

      // Assert
      expect(built.visibleWhen).toBe(false)
    })
  })

  describe('rendering', () => {
    it('should render a p tag with the default body class', () => {
      // Arrange & Act
      const output = render({ text: 'Hello world' })

      // Assert
      expect(output).toBe('<p class="govuk-body">Hello world</p>')
    })

    it('should use the lead paragraph class with size l', () => {
      // Arrange & Act
      const output = render({ text: 'Introduction', size: 'l' })

      // Assert
      expect(output).toBe('<p class="govuk-body-l">Introduction</p>')
    })

    it('should use the small paragraph class with size s', () => {
      // Arrange & Act
      const output = render({ text: 'Fine print', size: 's' })

      // Assert
      expect(output).toBe('<p class="govuk-body-s">Fine print</p>')
    })

    it('should append additional classes', () => {
      // Arrange & Act
      const output = render({ text: 'Text', classes: 'app-intro' })

      // Assert
      expect(output).toBe('<p class="govuk-body app-intro">Text</p>')
    })

    it('should render extra attributes onto the paragraph', () => {
      // Arrange & Act
      const output = render({ text: 'Text', attributes: { 'data-qa': 'intro' } })

      // Assert
      expect(output).toBe('<p class="govuk-body" data-qa="intro">Text</p>')
    })

    it('should escape HTML in the text', () => {
      // Arrange & Act
      const output = render({ text: '<script>alert(1)</script>' })

      // Assert
      expect(output).toBe('<p class="govuk-body">&lt;script&gt;alert(1)&lt;/script&gt;</p>')
    })
  })
})
