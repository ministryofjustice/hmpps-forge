import { MojComponentTestHelper } from '../../test-utils/MojComponentTestHelper'
import { setupComponentTest } from '../../test-utils/setupComponentTest'
import { MOJNotificationBadge } from './mojNotificationBadge'

vi.mock('nunjucks')

describe('MOJNotificationBadge', () => {
  setupComponentTest()

  const helper = new MojComponentTestHelper(MOJNotificationBadge)

  beforeEach(() => {
    helper.resetMock()
  })

  describe('render()', () => {
    it('should select the component template when rendering', () => {
      // Arrange
      const props = { text: 3, visuallyHiddenText: 'unread messages' }

      // Act
      const { template } = helper.executeComponent(props)

      // Assert
      expect(template).toBe('moj/components/notification-badge/template.njk')
    })

    it('should render MOJ markup when required options are supplied', () => {
      // Arrange
      const props = { text: 3, visuallyHiddenText: 'unread messages' }

      // Act
      const html = helper.renderWithNunjucks(props)

      // Assert
      expect(html).toContain('moj-notification-badge')
    })

    it('should hide the badge when the count is zero', () => {
      // Arrange
      const props = { text: 0 }

      // Act
      const html = helper.renderWithNunjucks(props)

      // Assert
      expect(html.trim()).toBe('')
    })

    it('should cap the visible count when it exceeds the limit', () => {
      // Arrange
      const props = { text: 120, visuallyHiddenText: 'unread messages' }

      // Act
      const html = helper.renderWithNunjucks(props)

      // Assert
      expect(html).toContain('99+')
      expect(html).toContain('99 or more unread messages')
    })

    it('should preserve spacing when custom classes are supplied', () => {
      // Arrange
      const props = { text: '4', classes: 'custom-badge' }

      // Act
      const html = helper.renderWithNunjucks(props)

      // Assert
      expect(html).toContain('moj-notification-badge custom-badge')
    })

    it('should preserve custom classes and attributes when supplied', () => {
      // Arrange
      const props = {
        ...{ text: 3, visuallyHiddenText: 'unread messages' },
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
