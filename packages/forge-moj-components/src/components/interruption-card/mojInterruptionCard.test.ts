import { MojComponentTestHelper } from '../../test-utils/MojComponentTestHelper'
import { setupComponentTest } from '../../test-utils/setupComponentTest'
import { MOJInterruptionCard } from './mojInterruptionCard'

vi.mock('nunjucks')

describe('MOJInterruptionCard', () => {
  setupComponentTest()

  const helper = new MojComponentTestHelper(MOJInterruptionCard)

  beforeEach(() => {
    helper.resetMock()
  })

  describe('render()', () => {
    it('should select the component template when rendering', () => {
      // Arrange
      const props = {
        heading: 'Before you continue',
        text: 'Check the case details.',
        primaryAction: { text: 'Continue', href: '#continue' },
      }

      // Act
      const { template } = helper.executeComponent(props)

      // Assert
      expect(template).toBe('components/interruption-card/template.njk')
    })

    it('should render MOJ markup when required options are supplied', () => {
      // Arrange
      const props = {
        heading: 'Before you continue',
        text: 'Check the case details.',
        primaryAction: { text: 'Continue', href: '#continue' },
      }

      // Act
      const html = helper.renderWithNunjucks(props)

      // Assert
      expect(html).toContain('moj-interruption-card')
    })

    it('should escape text content when markup is supplied as text', () => {
      // Arrange
      const props = {
        heading: 'Before you continue',
        text: '<script>alert(1)</script>',
        primaryAction: { text: 'Continue', href: '#continue' },
      }

      // Act
      const html = helper.renderWithNunjucks(props)

      // Assert
      expect(html).toContain('&lt;script&gt;')
      expect(html).not.toContain('<script>')
    })

    it('should render trusted content when html is supplied', () => {
      // Arrange
      const props = {
        heading: 'Before you continue',
        html: '<p>Check the <strong>case</strong>.</p>',
        primaryAction: { text: 'Continue', href: '#continue' },
      }

      // Act
      const html = helper.renderWithNunjucks(props)

      // Assert
      expect(html).toContain('<strong>case</strong>')
    })

    it('should prefer child content when text and html are also supplied', () => {
      // Arrange
      const props = {
        heading: 'Before you continue',
        text: 'Fallback text',
        html: '<p>Fallback HTML</p>',
        blocks: [
          {
            block: MOJInterruptionCard({ heading: 'Child', primaryAction: { text: 'Continue' } }),
            html: '<p>Child content</p>',
          },
        ],
        primaryAction: { text: 'Continue', href: '#continue' },
      }

      // Act
      const html = helper.renderWithNunjucks(props)

      // Assert
      expect(html).toContain('<p>Child content</p>')
      expect(html).not.toContain('Fallback')
    })

    it('should render alternative action styles when requested', () => {
      // Arrange
      const props = {
        heading: 'Before you continue',
        primaryAction: { text: 'Continue', href: '#continue', style: 'link' as const },
        secondaryAction: { text: 'Go back', href: '#back', style: 'button' as const },
      }

      // Act
      const html = helper.renderWithNunjucks(props)

      // Assert
      expect(html).toContain('govuk-link--inverse')
      expect(html).toContain('govuk-button--inverse')
      expect(html).toContain('Go back')
    })
  })
})
