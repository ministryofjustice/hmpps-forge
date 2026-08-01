import type { EvaluatedBlock } from '@ministryofjustice/hmpps-forge/core/components'

import { GovUKList } from './govukList'

const render = (props: Record<string, unknown>) => GovUKList.render(props as EvaluatedBlock<GovUKList>)

describe('GovUKList', () => {
  describe('block building', () => {
    it('should stamp the govukList variant when called as a builder', () => {
      // Arrange & Act
      const built = GovUKList({ items: ['one', 'two'] })

      // Assert
      expect(built.variant).toBe('govukList')
    })
  })

  describe('rendering', () => {
    it('should render a plain ul by default', () => {
      // Arrange & Act
      const output = render({ items: ['First', 'Second'] })

      // Assert
      expect(output).toBe('<ul class="govuk-list"><li>First</li><li>Second</li></ul>')
    })

    it('should render a bullet list', () => {
      // Arrange & Act
      const output = render({ items: ['First'], style: 'bullet' })

      // Assert
      expect(output).toBe('<ul class="govuk-list govuk-list--bullet"><li>First</li></ul>')
    })

    it('should render a numbered list with an ol tag', () => {
      // Arrange & Act
      const output = render({ items: ['First'], style: 'number' })

      // Assert
      expect(output).toBe('<ol class="govuk-list govuk-list--number"><li>First</li></ol>')
    })

    it('should apply the spaced modifier', () => {
      // Arrange & Act
      const output = render({ items: ['First'], style: 'bullet', spaced: true })

      // Assert
      expect(output).toBe('<ul class="govuk-list govuk-list--bullet govuk-list--spaced"><li>First</li></ul>')
    })

    it('should append additional classes and attributes', () => {
      // Arrange & Act
      const output = render({ items: [], classes: 'app-list', attributes: { 'data-qa': 'suggestions' } })

      // Assert
      expect(output).toBe('<ul class="govuk-list app-list" data-qa="suggestions"></ul>')
    })

    it('should escape HTML in the items', () => {
      // Arrange & Act
      const output = render({ items: ['a < b'] })

      // Assert
      expect(output).toBe('<ul class="govuk-list"><li>a &lt; b</li></ul>')
    })
  })
})
