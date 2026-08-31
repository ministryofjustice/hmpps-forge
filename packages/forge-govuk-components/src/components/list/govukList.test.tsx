
import { component as declareComponent } from '@ministryofjustice/hmpps-forge/core/components'
import { FunctionRegistryTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { GovUKList } from './govukList'

const TestBlock = declareComponent<{ html: string }>('testBlock', { factory: () => props => props.html })

const harness = new FunctionRegistryTestHarness([GovUKList, TestBlock])

const render = (props: GovUKList) => harness.render(GovUKList(props))

describe('GovUKList', () => {
  describe('block building', () => {
    it('should stamp the govukList variant when called as a builder', async () => {
      // Arrange & Act
      const built = GovUKList({ items: ['one', 'two'] })

      // Assert
      expect(built.variant).toBe('govukList')
    })
  })

  describe('rendering', () => {
    it('should render a plain ul by default', async () => {
      // Arrange & Act
      const output = await render({ items: ['First', 'Second'] })

      // Assert
      expect(output).toBe('<ul class="govuk-list"><li>First</li><li>Second</li></ul>')
    })

    it('should render a bullet list', async () => {
      // Arrange & Act
      const output = await render({ items: ['First'], style: 'bullet' })

      // Assert
      expect(output).toBe('<ul class="govuk-list govuk-list--bullet"><li>First</li></ul>')
    })

    it('should render a numbered list with an ol tag', async () => {
      // Arrange & Act
      const output = await render({ items: ['First'], style: 'number' })

      // Assert
      expect(output).toBe('<ol class="govuk-list govuk-list--number"><li>First</li></ol>')
    })

    it('should apply the spaced modifier', async () => {
      // Arrange & Act
      const output = await render({ items: ['First'], style: 'bullet', spaced: true })

      // Assert
      expect(output).toBe('<ul class="govuk-list govuk-list--bullet govuk-list--spaced"><li>First</li></ul>')
    })

    it('should append additional classes and attributes', async () => {
      // Arrange & Act
      const output = await render({ items: [], classes: 'app-list', attributes: { 'data-qa': 'suggestions' } })

      // Assert
      expect(output).toBe('<ul class="govuk-list app-list" data-qa="suggestions"></ul>')
    })

    it('should embed rendered child blocks verbatim as items', async () => {
      // Arrange
      const items = [
        'A plain string',
        TestBlock({ html: '<p class="govuk-body">A block item</p>' }),
        TestBlock({ html: '<a href="/help">A link item</a>' }),
      ]

      // Act
      const output = await render({ items })

      // Assert
      expect(output).toBe(
        '<ul class="govuk-list">' +
          '<li>A plain string</li>' +
          '<li><p class="govuk-body">A block item</p></li>' +
          '<li><a href="/help">A link item</a></li>' +
          '</ul>',
      )
    })

    it('should render HTML in string items unescaped', async () => {
      // Arrange & Act
      const output = await render({ items: ['<a href="/help">Get help</a>'] })

      // Assert
      expect(output).toBe('<ul class="govuk-list"><li><a href="/help">Get help</a></li></ul>')
    })
  })
})
