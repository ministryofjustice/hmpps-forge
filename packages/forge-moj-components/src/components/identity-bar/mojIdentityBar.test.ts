import { MojComponentTestHelper } from '../../test-utils/MojComponentTestHelper'
import { setupComponentTest } from '../../test-utils/setupComponentTest'
import { MOJIdentityBar } from './mojIdentityBar'

vi.mock('nunjucks')

describe('MOJIdentityBar', () => {
  setupComponentTest()

  const helper = new MojComponentTestHelper(MOJIdentityBar)

  beforeEach(() => {
    helper.resetMock()
  })

  describe('render()', () => {
    it('should select the component template when rendering', () => {
      // Arrange
      const props = { title: 'Alex Smith', menus: [{ items: [{ text: 'Edit', href: '#edit' }] }] }

      // Act
      const { template } = helper.executeComponent(props)

      // Assert
      expect(template).toBe('moj/components/identity-bar/template.njk')
    })

    it('should render MOJ markup when required options are supplied', () => {
      // Arrange
      const props = { title: 'Alex Smith', menus: [{ items: [{ text: 'Edit', href: '#edit' }] }] }

      // Act
      const html = helper.renderWithNunjucks(props)

      // Assert
      expect(html).toContain('moj-identity-bar')
    })

    it('should normalise the title when a string is supplied', () => {
      // Arrange
      const props = { title: 'Alex Smith' }

      // Act
      const params = helper.getParams(props)

      // Assert
      expect(params.title).toEqual({ text: 'Alex Smith' })
    })

    it('should omit hidden menus and actions when visibility is false', () => {
      // Arrange
      const props = {
        menus: [
          {
            items: [
              { text: 'Edit', href: '#edit' },
              { text: 'Hidden action', href: '#hidden', visibleWhen: false },
            ],
          },
          { visibleWhen: false, items: [{ text: 'Hidden menu', href: '#hidden-menu' }] },
        ],
      }

      // Act
      const html = helper.renderWithNunjucks(props)

      // Assert
      expect(html).toContain('Edit')
      expect(html).not.toContain('Hidden action')
      expect(html).not.toContain('Hidden menu')
    })

    it('should render the title without actions when menus are omitted', () => {
      // Arrange
      const props = { title: { html: '<strong>Alex Smith</strong>' } }

      // Act
      const html = helper.renderWithNunjucks(props)

      // Assert
      expect(html).toContain('<strong>Alex Smith</strong>')
      expect(html).not.toContain('moj-identity-bar__actions')
    })

    it('should preserve custom classes and attributes when supplied', () => {
      // Arrange
      const props = {
        ...{ title: 'Alex Smith', menus: [{ items: [{ text: 'Edit', href: '#edit' }] }] },
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
