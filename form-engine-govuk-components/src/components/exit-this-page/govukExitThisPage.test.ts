import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { govukExitThisPage } from './govukExitThisPage'

jest.mock('nunjucks')

describe('GOV.UK Exit This Page Component', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukExitThisPage)

  describe('Data transformation', () => {
    it('sets minimal defaults correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({})

      // Assert
      expect(params.text).toBeUndefined()
      expect(params.html).toBeUndefined()
      expect(params.redirectUrl).toBeUndefined()
      expect(params.id).toBeUndefined()
      expect(params.classes).toBeUndefined()
      expect(params.attributes).toBeUndefined()
      expect(params.activatedText).toBeUndefined()
      expect(params.timedOutText).toBeUndefined()
      expect(params.pressTwoMoreTimesText).toBeUndefined()
      expect(params.pressOneMoreTimeText).toBeUndefined()
    })

    it('sets text content correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Leave this page',
      })

      // Assert
      expect(params.text).toBe('Leave this page')
      expect(params.html).toBeUndefined()
    })

    it('uses html over text when both provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'This is ignored',
        html: '<span class="govuk-visually-hidden">Emergency</span> Exit this page',
      })

      // Assert
      expect(params.text).toBeUndefined()
      expect(params.html).toBe('<span class="govuk-visually-hidden">Emergency</span> Exit this page')
    })

    it('sets redirectUrl correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        redirectUrl: 'https://www.google.co.uk',
      })

      // Assert
      expect(params.redirectUrl).toBe('https://www.google.co.uk')
    })

    it('sets id attribute correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        id: 'custom-exit-page',
      })

      // Assert
      expect(params.id).toBe('custom-exit-page')
    })
  })

  describe('Screen reader options', () => {
    it('sets activatedText correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        activatedText: 'Redirecting now.',
      })

      // Assert
      expect(params.activatedText).toBe('Redirecting now.')
    })

    it('sets timedOutText correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        timedOutText: 'Exit shortcut has expired.',
      })

      // Assert
      expect(params.timedOutText).toBe('Exit shortcut has expired.')
    })

    it('sets pressTwoMoreTimesText correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        pressTwoMoreTimesText: 'Press Shift 2 more times.',
      })

      // Assert
      expect(params.pressTwoMoreTimesText).toBe('Press Shift 2 more times.')
    })

    it('sets pressOneMoreTimeText correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        pressOneMoreTimeText: 'Press Shift 1 more time.',
      })

      // Assert
      expect(params.pressOneMoreTimeText).toBe('Press Shift 1 more time.')
    })

    it('handles all screen reader options together', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        activatedText: 'Leaving page.',
        timedOutText: 'Timeout occurred.',
        pressTwoMoreTimesText: 'Two more presses needed.',
        pressOneMoreTimeText: 'One more press needed.',
      })

      // Assert
      expect(params.activatedText).toBe('Leaving page.')
      expect(params.timedOutText).toBe('Timeout occurred.')
      expect(params.pressTwoMoreTimesText).toBe('Two more presses needed.')
      expect(params.pressOneMoreTimeText).toBe('One more press needed.')
    })
  })

  describe('Optional attributes', () => {
    it('passes through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        classes: 'app-exit-page--custom',
      })

      // Assert
      expect(params.classes).toBe('app-exit-page--custom')
    })

    it('passes through attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        attributes: {
          'data-module': 'exit-page-tracking',
          'data-track': 'exit-clicked',
        },
      })

      // Assert
      expect(params.attributes).toEqual({
        'data-module': 'exit-page-tracking',
        'data-track': 'exit-clicked',
      })
    })

    it('handles all options together', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        html: '<span class="govuk-visually-hidden">Emergency</span> Exit now',
        redirectUrl: 'https://www.google.co.uk',
        id: 'emergency-exit',
        classes: 'app-exit-page--urgent',
        attributes: {
          'data-module': 'exit-tracking',
        },
        activatedText: 'Exiting.',
        timedOutText: 'Expired.',
        pressTwoMoreTimesText: 'Two more.',
        pressOneMoreTimeText: 'One more.',
      })

      // Assert
      expect(params).toEqual({
        id: 'emergency-exit',
        text: undefined,
        html: '<span class="govuk-visually-hidden">Emergency</span> Exit now',
        redirectUrl: 'https://www.google.co.uk',
        classes: 'app-exit-page--urgent',
        attributes: {
          'data-module': 'exit-tracking',
        },
        activatedText: 'Exiting.',
        timedOutText: 'Expired.',
        pressTwoMoreTimesText: 'Two more.',
        pressOneMoreTimeText: 'One more.',
      })
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        redirectUrl: 'https://www.google.co.uk',
      })

      // Assert
      expect(template).toBe('govuk/components/exit-this-page/template.njk')
    })

    it('wraps params in correct context structure', async () => {
      // Arrange & Act
      const { context } = (await helper.executeComponent({
        text: 'Exit this page',
        redirectUrl: 'https://www.bbc.co.uk/weather',
      })) as { context: { params: any } }

      // Assert
      expect(context).toHaveProperty('params')
      expect(context.params).toHaveProperty('text', 'Exit this page')
      expect(context.params).toHaveProperty('redirectUrl', 'https://www.bbc.co.uk/weather')
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders a valid exit this page component with minimal config', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({})

      // Assert
      expect(html).toContain('govuk-exit-this-page')
    })

    it('renders with custom text', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        text: 'Leave this page',
        redirectUrl: 'https://www.google.co.uk',
      })

      // Assert
      expect(html).toContain('govuk-exit-this-page')
      expect(html).toContain('Leave this page')
    })

    it('renders with HTML content', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        html: '<span class="govuk-visually-hidden">Emergency</span> Exit this page',
        redirectUrl: 'https://www.bbc.co.uk/weather',
      })

      // Assert
      expect(html).toContain('govuk-exit-this-page')
      expect(html).toContain('<span class="govuk-visually-hidden">Emergency</span>')
      expect(html).toContain('Exit this page')
    })

    it('renders with custom classes and attributes', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        redirectUrl: 'https://www.google.co.uk',
        classes: 'app-exit-custom',
        id: 'emergency-exit',
      })

      // Assert
      expect(html).toContain('govuk-exit-this-page')
      expect(html).toContain('app-exit-custom')
      expect(html).toContain('id="emergency-exit"')
    })

    it('renders with all options configured', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        html: '<span class="govuk-visually-hidden">Emergency</span> Exit now',
        redirectUrl: 'https://www.google.co.uk',
        id: 'full-exit-test',
        classes: 'app-exit-full',
        activatedText: 'Leaving.',
        timedOutText: 'Expired.',
      })

      // Assert
      expect(html).toContain('govuk-exit-this-page')
      expect(html).toContain('Exit now')
      expect(html).toContain('id="full-exit-test"')
      expect(html).toContain('app-exit-full')
    })
  })
})
