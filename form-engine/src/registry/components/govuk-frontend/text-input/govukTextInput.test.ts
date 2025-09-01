import { govukTextInput } from './govukTextInput'
import { GovukComponentTestHelper } from '../../../../test-utils/govukComponentTestHelper'
import { setupComponentTest } from '../../../../test-utils/componentTestHelper'

jest.mock('nunjucks')

describe('govukTextInput', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukTextInput)

  describe('Data transformation', () => {
    it('sets default values correctly', async () => {
      const params = await helper.getParams({ code: 'test-input' })
      expect(params.id).toBe('test-input')
      expect(params.name).toBe('test-input')
      expect(params.type).toBe('text')
      expect(params.value).toBeUndefined()
    })

    it('uses custom ID over code', async () => {
      const params = await helper.getParams({
        code: 'test-input',
        id: 'custom-id',
      })
      expect(params.id).toBe('custom-id')
      expect(params.name).toBe('test-input')
    })

    it('passes through value', async () => {
      const params = await helper.getParams({
        code: 'test-input',
        value: 'Initial value',
      })
      expect(params.value).toBe('Initial value')
    })
  })

  describe('Label transformation', () => {
    it('converts string label to object format', async () => {
      const params = await helper.getParams({
        code: 'test-input',
        label: 'Enter your name',
      })
      expect(params.label).toEqual({
        text: 'Enter your name',
      })
    })

    it('passes through object label unchanged', async () => {
      const labelObj = {
        text: 'Full Name',
        classes: 'govuk-label--l',
        isPageHeading: true,
      }
      const params = await helper.getParams({
        code: 'test-input',
        label: labelObj,
      })
      expect(params.label).toEqual(labelObj)
    })

    it('passes through label with HTML', async () => {
      const labelObj = {
        html: '<span>Name</span> <span class="govuk-caption-m">Required</span>',
      }
      const params = await helper.getParams({
        code: 'test-input',
        label: labelObj,
      })
      expect(params.label).toEqual(labelObj)
    })
  })

  describe('Hint transformation', () => {
    it('converts string hint to object format', async () => {
      const params = await helper.getParams({
        code: 'test-input',
        hint: 'Include your middle name',
      })
      expect(params.hint).toEqual({
        text: 'Include your middle name',
      })
    })

    it('passes through object hint unchanged', async () => {
      const hintObj = {
        text: 'Enter your full legal name',
        classes: 'custom-hint',
      }
      const params = await helper.getParams({
        code: 'test-input',
        hint: hintObj,
      })
      expect(params.hint).toEqual(hintObj)
    })

    it('passes undefined hint when not provided', async () => {
      const params = await helper.getParams({
        code: 'test-input',
        hint: undefined,
      })
      expect(params.hint).toEqual({ text: undefined })
    })
  })

  describe('Input attributes', () => {
    it('passes through all input attributes without transformation', async () => {
      const params = await helper.getParams({
        code: 'test-input',
        inputMode: 'numeric',
        pattern: '[0-9]*',
        spellcheck: false,
        autocomplete: 'email',
        disabled: true,
        autocapitalize: 'words',
        prefix: { text: '£' },
        suffix: { text: 'per month' },
        inputWrapper: { classes: 'wrapper-class' },
        inputType: 'email',
        formGroup: {
          classes: 'custom-form-group',
          beforeInput: { text: 'Before text' },
          afterInput: { html: '<span>After HTML</span>' },
        },
        classes: 'govuk-input--width-10',
        attributes: {
          'data-testid': 'test-input',
          'aria-describedby': 'help-text',
        },
      })

      expect(params.inputmode).toBe('numeric')
      expect(params.pattern).toBe('[0-9]*')
      expect(params.spellcheck).toBe(false)
      expect(params.autocomplete).toBe('email')
      expect(params.disabled).toBe(true)
      expect(params.autocapitalize).toBe('words')
      expect(params.prefix).toEqual({ text: '£' })
      expect(params.suffix).toEqual({ text: 'per month' })
      expect(params.inputWrapper).toEqual({ classes: 'wrapper-class' })
      expect(params.type).toEqual('email')
      expect(params.formGroup).toEqual({
        classes: 'custom-form-group',
        beforeInput: { text: 'Before text' },
        afterInput: { html: '<span>After HTML</span>' },
      })
      expect(params.classes).toBe('govuk-input--width-10')
      expect(params.attributes).toEqual({
        'data-testid': 'test-input',
        'aria-describedby': 'help-text',
      })
    })
  })

  describe('Error message transformation', () => {
    it('transforms error array to error message object', async () => {
      const params = await helper.getParams({
        code: 'test-input',
        errors: [{ message: 'Enter a valid email address' }],
      })
      expect(params.errorMessage).toEqual({
        text: 'Enter a valid email address',
      })
    })

    it('uses first error when multiple provided', async () => {
      const params = await helper.getParams({
        code: 'test-input',
        errors: [{ message: 'First error' }, { message: 'Second error' }],
      })
      expect(params.errorMessage).toEqual({
        text: 'First error',
      })
    })

    it('sets errorMessage to undefined when no errors', async () => {
      const params = await helper.getParams({ code: 'test-input' })
      expect(params.errorMessage).toBeUndefined()
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      const { template } = await helper.executeComponent({
        code: 'test-input',
      })
      expect(template).toBe('govuk/components/input/template.njk')
    })

    it('wraps params in context object', async () => {
      const { context } = (await helper.executeComponent({
        code: 'test-input',
      })) as { context: any }
      expect(context).toHaveProperty('params')
      expect(context.params).toHaveProperty('id')
      expect(context.params).toHaveProperty('name')
      expect(context.params).toHaveProperty('type')
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders a valid text input component', async () => {
      const html = await helper.renderWithNunjucks({
        code: 'email-address',
        variant: 'govukTextInput',
        inputType: 'email',
        label: 'Email address',
        hint: `We'll only use this to contact you`,
        value: 'user@example.com',
        autocomplete: 'email',
        spellcheck: false,
        errors: [{ message: 'Enter a valid email address' }],
      })

      expect(html).toContainText('govuk-input')
      expect(html).toContainText('type="email"')
      expect(html).toContainText('email-address')
      expect(html).toContainText('Email address')
      expect(html).toContainText(`We'll only use this to contact you`)
      expect(html).toContainText('Enter a valid email address')
      expect(html).toContainText('user@example.com')
      expect(html).toContainText('autocomplete="email"')
      expect(html).toContainText('spellcheck="false"')
    })
  })
})
