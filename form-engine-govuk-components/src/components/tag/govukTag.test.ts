import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { govukTag } from './govukTag'

jest.mock('nunjucks')

describe('GOV.UK Tag Component', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukTag)

  describe('Data transformation', () => {
    it('sets text content correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Completed',
      })

      // Assert
      expect(params.text).toBe('Completed')
      expect(params.html).toBeUndefined()
    })

    it('uses html over text when both provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'This is ignored',
        html: '<strong>Beta</strong>',
      })

      // Assert
      expect(params.text).toBeUndefined()
      expect(params.html).toBe('<strong>Beta</strong>')
    })

    it('passes through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Active',
        classes: 'govuk-tag--green',
      })

      // Assert
      expect(params.classes).toBe('govuk-tag--green')
    })

    it('passes through attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Pending',
        attributes: {
          'data-module': 'custom-tag',
          'data-status': 'pending',
        },
      })

      // Assert
      expect(params.attributes).toEqual({
        'data-module': 'custom-tag',
        'data-status': 'pending',
      })
    })

    it('handles all options together', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        html: '<strong>New</strong>',
        classes: 'govuk-tag--blue app-tag--custom',
        attributes: {
          'data-tracking': 'new-feature',
        },
      })

      // Assert
      expect(params.text).toBeUndefined()
      expect(params.html).toBe('<strong>New</strong>')
      expect(params.classes).toBe('govuk-tag--blue app-tag--custom')
      expect(params.attributes).toEqual({
        'data-tracking': 'new-feature',
      })
    })
  })

  describe('Colour classes', () => {
    it('supports grey modifier class', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Inactive',
        classes: 'govuk-tag--grey',
      })

      // Assert
      expect(params.classes).toBe('govuk-tag--grey')
    })

    it('supports green modifier class', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Success',
        classes: 'govuk-tag--green',
      })

      // Assert
      expect(params.classes).toBe('govuk-tag--green')
    })

    it('supports red modifier class', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Error',
        classes: 'govuk-tag--red',
      })

      // Assert
      expect(params.classes).toBe('govuk-tag--red')
    })

    it('supports blue modifier class', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Information',
        classes: 'govuk-tag--blue',
      })

      // Assert
      expect(params.classes).toBe('govuk-tag--blue')
    })

    it('supports yellow modifier class', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Pending',
        classes: 'govuk-tag--yellow',
      })

      // Assert
      expect(params.classes).toBe('govuk-tag--yellow')
    })

    it('supports orange modifier class', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Warning',
        classes: 'govuk-tag--orange',
      })

      // Assert
      expect(params.classes).toBe('govuk-tag--orange')
    })

    it('supports multiple classes including colour modifier', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Important',
        classes: 'govuk-tag--purple app-tag--large',
      })

      // Assert
      expect(params.classes).toBe('govuk-tag--purple app-tag--large')
    })
  })

  describe('Optional attributes', () => {
    it('passes through custom data attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'Active',
        attributes: {
          'data-test-id': 'status-tag',
          'data-status-code': '200',
        },
      })

      // Assert
      expect(params.attributes).toEqual({
        'data-test-id': 'status-tag',
        'data-status-code': '200',
      })
    })

    it('passes through ARIA attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        text: 'New',
        attributes: {
          'aria-label': 'New feature indicator',
          role: 'status',
        },
      })

      // Assert
      expect(params.attributes).toEqual({
        'aria-label': 'New feature indicator',
        role: 'status',
      })
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        text: 'Test tag',
      })

      // Assert
      expect(template).toBe('govuk/components/tag/template.njk')
    })

    it('wraps params in correct context structure', async () => {
      // Arrange & Act
      const { context } = (await helper.executeComponent({
        text: 'Completed',
        classes: 'govuk-tag--green',
      })) as { context: { params: any } }

      // Assert
      expect(context).toHaveProperty('params')
      expect(context.params).toHaveProperty('text', 'Completed')
      expect(context.params).toHaveProperty('classes', 'govuk-tag--green')
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders a valid tag component with text', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        text: 'Completed',
      })

      // Assert
      expect(html).toContain('govuk-tag')
      expect(html).toContain('Completed')
    })

    it('renders with HTML content', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        html: '<strong>Beta</strong>',
      })

      // Assert
      expect(html).toContain('govuk-tag')
      expect(html).toContain('<strong>Beta</strong>')
    })

    it('renders with green colour class', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        text: 'Success',
        classes: 'govuk-tag--green',
      })

      // Assert
      expect(html).toContain('govuk-tag')
      expect(html).toContain('govuk-tag--green')
      expect(html).toContain('Success')
    })

    it('renders with red colour class', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        text: 'Error',
        classes: 'govuk-tag--red',
      })

      // Assert
      expect(html).toContain('govuk-tag')
      expect(html).toContain('govuk-tag--red')
      expect(html).toContain('Error')
    })

    it('renders with yellow colour class', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        text: 'Pending',
        classes: 'govuk-tag--yellow',
      })

      // Assert
      expect(html).toContain('govuk-tag')
      expect(html).toContain('govuk-tag--yellow')
      expect(html).toContain('Pending')
    })

    it('renders with custom classes', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        text: 'Important',
        classes: 'govuk-tag--purple app-tag--large',
      })

      // Assert
      expect(html).toContain('govuk-tag')
      expect(html).toContain('govuk-tag--purple')
      expect(html).toContain('app-tag--large')
    })

    it('renders with custom attributes', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        text: 'Active',
        attributes: {
          'data-test-id': 'status-tag',
        },
      })

      // Assert
      expect(html).toContain('govuk-tag')
      expect(html).toContain('data-test-id="status-tag"')
    })
  })
})
