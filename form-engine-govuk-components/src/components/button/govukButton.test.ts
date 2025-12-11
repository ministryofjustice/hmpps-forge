import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { govukButton, govukLinkButton } from './govukButton'

jest.mock('nunjucks')

describe('GOV.UK Button Components', () => {
  setupComponentTest()

  describe('govukButton - Standard Button', () => {
    const helper = new GovukComponentTestHelper(govukButton)

    describe('Data transformation', () => {
      it('sets default values correctly', async () => {
        const params = await helper.getParams({
          text: 'Click me',
        })

        expect(params.text).toBe('Click me')
        expect(params.type).toBe('submit')
        expect(params.element).toBe('button')
        expect(params.name).toBe('action')
        expect(params.html).toBeUndefined()
      })

      it('uses html over text', async () => {
        const params = await helper.getParams({
          text: 'This is ignored',
          html: '<span>HTML content</span>',
        })

        expect(params.text).toBeUndefined()
        expect(params.html).toBe('<span>HTML content</span>')
        expect(params.element).toBe('button')
      })

      it('passes through button-specific attributes', async () => {
        const params = await helper.getParams({
          text: 'Submit',
          id: 'submit-btn',
          name: 'custom-action',
          value: 'submit_form',
          disabled: true,
          preventDoubleClick: true,
        })

        expect(params.id).toBe('submit-btn')
        expect(params.name).toBe('custom-action')
        expect(params.value).toBe('submit_form')
        expect(params.disabled).toBe(true)
        expect(params.preventDoubleClick).toBe(true)
      })
    })

    describe('Button types', () => {
      it('defaults to submit type', async () => {
        const params = await helper.getParams({
          text: 'Submit',
        })

        expect(params.type).toBe('submit')
      })

      it('allows button type', async () => {
        const params = await helper.getParams({
          text: 'Click',
          buttonType: 'button',
        })

        expect(params.type).toBe('button')
      })

      it('allows reset type', async () => {
        const params = await helper.getParams({
          text: 'Clear',
          buttonType: 'reset',
        })

        expect(params.type).toBe('reset')
      })
    })

    describe('Complex scenarios', () => {
      it('handles button with all options', async () => {
        const params = await helper.getParams({
          text: 'Submit application',
          name: 'action',
          value: 'submit',
          buttonType: 'submit',
          disabled: false,
          classes: 'app-submit',
          preventDoubleClick: true,
          id: 'submit-btn',
          attributes: {
            'data-action': 'submit-form',
          },
        })

        expect(params).toEqual({
          element: 'button',
          text: 'Submit application',
          html: undefined,
          name: 'action',
          type: 'submit',
          value: 'submit',
          disabled: false,
          classes: 'app-submit',
          attributes: {
            'data-action': 'submit-form',
          },
          preventDoubleClick: true,
          isStartButton: undefined,
          id: 'submit-btn',
        })
      })
    })

    describe('Template and context', () => {
      it('calls nunjucks with correct template path', async () => {
        const { template } = await helper.executeComponent({
          text: 'Test',
        })

        expect(template).toBe('govuk/components/button/template.njk')
      })

      it('wraps params in correct context structure', async () => {
        const { context } = (await helper.executeComponent({
          text: 'Test button',
          buttonType: 'button',
        })) as { context: { params: any } }

        expect(context).toHaveProperty('params')
        expect(context.params).toHaveProperty('text', 'Test button')
        expect(context.params).toHaveProperty('type', 'button')
      })
    })

    describe('DOM rendering smoke test', () => {
      it('renders a valid button component', async () => {
        const html = await helper.renderWithNunjucks({
          text: 'Save and continue',
          buttonType: 'submit',
          classes: 'govuk-button--primary',
          id: 'submit-button',
        })

        expect(html).toContain('govuk-button')
        expect(html).toContain('Save and continue')
        expect(html).toContain('type="submit"')
        expect(html).toContain('id="submit-button"')
      })
    })
  })

  describe('govukLinkButton - Link Button', () => {
    const helper = new GovukComponentTestHelper(govukLinkButton)

    describe('Data transformation', () => {
      it('sets link button defaults correctly', async () => {
        const params = await helper.getParams({
          text: 'Continue',
          href: '/next-page',
        })

        expect(params.text).toBe('Continue')
        expect(params.element).toBe('a')
        expect(params.href).toBe('/next-page')
        expect(params.html).toBeUndefined()

        expect(params.name).toBeUndefined()
        expect(params.type).toBeUndefined()
        expect(params.value).toBeUndefined()
        expect(params.disabled).toBeUndefined()
        expect(params.preventDoubleClick).toBeUndefined()
      })

      it('uses html over text for links', async () => {
        const params = await helper.getParams({
          text: 'This is ignored',
          html: '<strong>Continue</strong> to next step',
          href: '/next',
        })

        expect(params.text).toBeUndefined()
        expect(params.html).toBe('<strong>Continue</strong> to next step')
        expect(params.element).toBe('a')
        expect(params.href).toBe('/next')
      })

      it('passes through link attributes', async () => {
        const params = await helper.getParams({
          text: 'Navigate',
          href: '/destination',
          id: 'nav-link',
          classes: 'app-link',
          attributes: {
            'data-track': 'navigation',
          },
        })

        expect(params.id).toBe('nav-link')
        expect(params.href).toBe('/destination')
        expect(params.classes).toBe('app-link')
        expect(params.attributes).toEqual({
          'data-track': 'navigation',
        })
      })
    })

    describe('Complex link scenarios', () => {
      it('handles link button with all options', async () => {
        const params = await helper.getParams({
          text: 'Continue to SAN',
          href: '/san-assessment',
          classes: 'super-pretty-button',
          isStartButton: true,
          id: 'san-link',
          attributes: {
            'data-module': 'san-button',
          },
        })

        expect(params).toEqual({
          element: 'a',
          text: 'Continue to SAN',
          html: undefined,
          href: '/san-assessment',
          classes: 'super-pretty-button',
          attributes: {
            'data-module': 'san-button',
          },
          isStartButton: true,
          id: 'san-link',
        })
      })
    })

    describe('Template and context', () => {
      it('calls nunjucks with correct template path', async () => {
        const { template } = await helper.executeComponent({
          text: 'Link',
          href: '/path',
        })

        expect(template).toBe('govuk/components/button/template.njk')
      })

      it('wraps params in correct context structure', async () => {
        const { context } = (await helper.executeComponent({
          text: 'Link button',
          href: '/destination',
        })) as { context: { params: any } }

        expect(context).toHaveProperty('params')
        expect(context.params).toHaveProperty('text', 'Link button')
        expect(context.params).toHaveProperty('href', '/destination')
        expect(context.params).toHaveProperty('element', 'a')
      })
    })

    describe('DOM rendering smoke test', () => {
      it('renders a valid link button component', async () => {
        const html = await helper.renderWithNunjucks({
          text: 'Continue',
          href: '/next-step',
          classes: 'govuk-button--secondary',
          id: 'continue-link',
        })

        expect(html).toContain('govuk-button')
        expect(html).toContain('Continue')
        expect(html).toContain('href="/next-step"')
        expect(html).toContain('id="continue-link"')
      })
    })
  })
})
