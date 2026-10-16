import { MojComponentTestHelper } from '../../test-utils/MojComponentTestHelper'
import { setupComponentTest } from '../../test-utils/setupComponentTest'
import { MOJPageHeaderActions } from './mojPageHeaderActions'

vi.mock('nunjucks')

describe('MOJPageHeaderActions', () => {
  setupComponentTest()

  const helper = new MojComponentTestHelper(MOJPageHeaderActions)

  beforeEach(() => {
    helper.resetMock()
  })

  describe('render()', () => {
    it('should select the component template when rendering', () => {
      // Arrange
      const props = { heading: 'Cases', items: [{ text: 'Add case', href: '#add' }] }

      // Act
      const { template } = helper.executeComponent(props)

      // Assert
      expect(template).toBe('moj/components/page-header-actions/template.njk')
    })

    it('should render MOJ markup when required options are supplied', () => {
      // Arrange
      const props = { heading: 'Cases', items: [{ text: 'Add case', href: '#add' }] }

      // Act
      const html = helper.renderWithNunjucks(props)

      // Assert
      expect(html).toContain('moj-page-header-actions')
    })

    it('should normalise the heading when a string is supplied', () => {
      // Arrange
      const props = { heading: 'Cases' }

      // Act
      const params = helper.getParams(props)

      // Assert
      expect(params.heading).toEqual({ text: 'Cases' })
    })

    it('should omit hidden actions when visibility is false', () => {
      // Arrange
      const props = {
        heading: 'Cases',
        items: [
          { text: 'Add case', href: '#add' },
          { text: 'Hidden', href: '#hidden', visibleWhen: false },
        ],
      }

      // Act
      const html = helper.renderWithNunjucks(props)

      // Assert
      expect(html).toContain('Add case')
      expect(html).not.toContain('Hidden')
    })

    it('should render the requested heading level when a heading object is supplied', () => {
      // Arrange
      const props = { heading: { html: '<em>Cases</em>', level: 2 as const } }

      // Act
      const html = helper.renderWithNunjucks(props)

      // Assert
      expect(html).toContain('<h2')
      expect(html).toContain('<em>Cases</em>')
      expect(html).not.toContain('moj-page-header-actions__actions')
    })

    it('should preserve custom classes and attributes when supplied', () => {
      // Arrange
      const props = {
        ...{ heading: 'Cases', items: [{ text: 'Add case', href: '#add' }] },
        classes: 'custom-component',
        attributes: { 'data-testid': 'example' },
      }

      // Act
      const html = helper.renderWithNunjucks(props)

      // Assert
      expect(html).toContain('custom-component')
      expect(html).toContain('data-testid="example"')
    })
  })
})
