import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { StructureType } from '@form-engine/form/types/enums'
import { govukNotificationBanner } from './govukNotificationBanner'

jest.mock('nunjucks')

describe('GOV.UK Notification Banner Component', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukNotificationBanner)

  describe('Content transformation', () => {
    it('sets text content correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'You have 7 days left to send your application.',
      })

      // Assert
      expect(params.text).toBe('You have 7 days left to send your application.')
      expect(params.html).toBeUndefined()
    })

    it('uses html over text when both provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'This is ignored',
        html: '<p class="govuk-notification-banner__heading">Important update</p>',
      })

      // Assert
      expect(params.text).toBeUndefined()
      expect(params.html).toBe('<p class="govuk-notification-banner__heading">Important update</p>')
    })

    it('renders child blocks as HTML content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        content: [
          {
            block: { type: StructureType.BLOCK, variant: 'html' },
            html: '<p class="govuk-notification-banner__heading">Application submitted</p>',
          },
          {
            block: { type: StructureType.BLOCK, variant: 'html' },
            html: '<p class="govuk-body">Your reference number is HDJ2123F</p>',
          },
        ],
      } as any)

      // Assert
      expect(params.html).toBe(
        '<p class="govuk-notification-banner__heading">Application submitted</p><p class="govuk-body">Your reference number is HDJ2123F</p>',
      )
      expect(params.text).toBeUndefined()
    })

    it('child blocks take precedence over html and text', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'This is ignored',
        html: '<p>This is also ignored</p>',
        content: [
          {
            block: { type: StructureType.BLOCK, variant: 'html' },
            html: '<p>Child block content</p>',
          },
        ],
      } as any)

      // Assert
      expect(params.html).toBe('<p>Child block content</p>')
      expect(params.text).toBeUndefined()
    })

    it('handles empty content array', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Fallback text',
        content: [],
      } as any)

      // Assert
      expect(params.text).toBe('Fallback text')
      expect(params.html).toBeUndefined()
    })
  })

  describe('Title options', () => {
    it('sets titleText correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        titleText: 'Important notice',
        text: 'Content here',
      })

      // Assert
      expect(params.titleText).toBe('Important notice')
      expect(params.titleHtml).toBeUndefined()
    })

    it('uses titleHtml over titleText', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        titleText: 'This is ignored',
        titleHtml: '<span class="govuk-visually-hidden">Success:</span> Application complete',
        text: 'Content here',
      })

      // Assert
      expect(params.titleText).toBeUndefined()
      expect(params.titleHtml).toBe('<span class="govuk-visually-hidden">Success:</span> Application complete')
    })

    it('passes through titleHeadingLevel', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        titleText: 'Important',
        titleHeadingLevel: '3',
        text: 'Content here',
      })

      // Assert
      expect(params.titleHeadingLevel).toBe('3')
    })

    it('passes through titleId', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        titleText: 'Important',
        titleId: 'custom-banner-title',
        text: 'Content here',
      })

      // Assert
      expect(params.titleId).toBe('custom-banner-title')
    })
  })

  describe('Banner type and role', () => {
    it('maps bannerType to type parameter', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        bannerType: 'success',
        text: 'Application completed successfully',
      })

      // Assert
      expect(params.type).toBe('success')
    })

    it('passes through role attribute', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        role: 'alert',
        text: 'Important message',
      })

      // Assert
      expect(params.role).toBe('alert')
    })

    it('handles both bannerType and role together', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        bannerType: 'success',
        role: 'status',
        text: 'Update successful',
      })

      // Assert
      expect(params.type).toBe('success')
      expect(params.role).toBe('status')
    })
  })

  describe('Optional attributes', () => {
    it('passes through disableAutoFocus', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Important message',
        disableAutoFocus: true,
      })

      // Assert
      expect(params.disableAutoFocus).toBe(true)
    })

    it('passes through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Important message',
        classes: 'app-notification-banner--custom',
      })

      // Assert
      expect(params.classes).toBe('app-notification-banner--custom')
    })

    it('passes through attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Important message',
        attributes: {
          'data-module': 'custom-banner',
          'data-track': 'banner-shown',
        },
      })

      // Assert
      expect(params.attributes).toEqual({
        'data-module': 'custom-banner',
        'data-track': 'banner-shown',
      })
    })

    it('handles all options together', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        titleText: 'Success',
        titleHeadingLevel: '2',
        titleId: 'success-banner',
        html: '<p class="govuk-notification-banner__heading">Application submitted</p>',
        bannerType: 'success',
        role: 'alert',
        disableAutoFocus: false,
        classes: 'app-notification-banner--large',
        attributes: {
          'data-module': 'govuk-notification-banner',
        },
      })

      // Assert
      expect(params.titleText).toBe('Success')
      expect(params.titleHtml).toBeUndefined()
      expect(params.titleHeadingLevel).toBe('2')
      expect(params.titleId).toBe('success-banner')
      expect(params.text).toBeUndefined()
      expect(params.html).toBe('<p class="govuk-notification-banner__heading">Application submitted</p>')
      expect(params.type).toBe('success')
      expect(params.role).toBe('alert')
      expect(params.disableAutoFocus).toBe(false)
      expect(params.classes).toBe('app-notification-banner--large')
      expect(params.attributes).toEqual({
        'data-module': 'govuk-notification-banner',
      })
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        text: 'Test notification',
      })

      // Assert
      expect(template).toBe('govuk/components/notification-banner/template.njk')
    })

    it('wraps params in correct context structure', async () => {
      // Arrange & Act
      const { context } = (await helper.executeComponent({
        titleText: 'Important',
        text: 'You have 7 days left to send your application.',
      })) as { context: { params: any } }

      // Assert
      expect(context).toHaveProperty('params')
      expect(context.params).toHaveProperty('titleText', 'Important')
      expect(context.params).toHaveProperty('text', 'You have 7 days left to send your application.')
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders a valid notification banner with text', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        text: 'You have 7 days left to send your application.',
      })

      // Assert
      expect(html).toContain('govuk-notification-banner')
      expect(html).toContain('You have 7 days left to send your application.')
    })

    it('renders a success notification banner', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        bannerType: 'success',
        titleText: 'Success',
        text: 'Training outcome recorded and trainee withdrawn',
      })

      // Assert
      expect(html).toContain('govuk-notification-banner')
      expect(html).toContain('govuk-notification-banner--success')
      expect(html).toContain('Success')
      expect(html).toContain('Training outcome recorded and trainee withdrawn')
    })

    it('renders with HTML content', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        titleText: 'Important',
        html: '<p class="govuk-notification-banner__heading">Application submitted</p>',
      })

      // Assert
      expect(html).toContain('govuk-notification-banner')
      expect(html).toContain('Important')
      expect(html).toContain('<p class="govuk-notification-banner__heading">Application submitted</p>')
    })

    it('renders with custom title HTML', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        titleHtml: '<span class="govuk-visually-hidden">Success:</span> Complete',
        text: 'Your application has been submitted.',
      })

      // Assert
      expect(html).toContain('govuk-notification-banner')
      expect(html).toContain('<span class="govuk-visually-hidden">Success:</span> Complete')
      expect(html).toContain('Your application has been submitted.')
    })

    it('renders with custom classes', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        text: 'Important message',
        classes: 'app-notification-banner--large',
      })

      // Assert
      expect(html).toContain('govuk-notification-banner')
      expect(html).toContain('app-notification-banner--large')
    })
  })
})
