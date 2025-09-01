import { govukCheckboxInput } from './govukCheckboxInput'
import { GovukComponentTestHelper } from '../../../../test-utils/govukComponentTestHelper'
import { setupComponentTest } from '../../../../test-utils/componentTestHelper'

jest.mock('nunjucks')

describe('govukCheckboxInput', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukCheckboxInput)

  describe('Data transformation', () => {
    it('sets default values correctly', async () => {
      const params = await helper.getParams({
        code: 'test-checkbox',
        items: [{ value: 'option1', text: 'Option 1' }],
      })
      expect(params.idPrefix).toBe('test-checkbox')
      expect(params.name).toBe('test-checkbox')
      expect(params.items).toHaveLength(1)
    })

    it('uses custom idPrefix over code', async () => {
      const params = await helper.getParams({
        code: 'test-checkbox',
        idPrefix: 'custom-id-prefix',
        items: [],
      })
      expect(params.idPrefix).toBe('custom-id-prefix')
      expect(params.name).toBe('test-checkbox')
    })

    it('uses custom name when provided', async () => {
      const params = await helper.getParams({
        code: 'test-checkbox',
        name: 'custom-name',
        items: [],
      })
      expect(params.name).toBe('custom-name')
    })
  })

  describe('Fieldset and legend transformation', () => {
    it('creates fieldset with label as legend when no fieldset provided', async () => {
      const params = await helper.getParams({
        code: 'test-checkbox',
        label: 'Choose options',
        items: [],
      })
      expect(params.fieldset).toEqual({
        legend: {
          text: 'Choose options',
        },
      })
    })

    it('passes through existing fieldset configuration', async () => {
      const fieldsetConfig = {
        legend: {
          text: 'Custom Legend',
          classes: 'govuk-fieldset__legend--l',
          isPageHeading: true,
        },
        classes: 'custom-fieldset',
        attributes: { 'data-test': 'fieldset' },
      }
      const params = await helper.getParams({
        code: 'test-checkbox',
        fieldset: fieldsetConfig,
        items: [],
      })
      expect(params.fieldset).toEqual(fieldsetConfig)
    })
  })

  describe('Hint transformation', () => {
    it('converts string hint to object format', async () => {
      const params = await helper.getParams({
        code: 'test-checkbox',
        hint: 'Select all that apply',
        items: [],
      })
      expect(params.hint).toEqual({
        text: 'Select all that apply',
      })
    })

    it('passes through object hint unchanged', async () => {
      const hintObj = {
        text: 'Hint text',
        classes: 'custom-hint',
        id: 'hint-id',
      }
      const params = await helper.getParams({
        code: 'test-checkbox',
        hint: hintObj,
        items: [],
      })
      expect(params.hint).toEqual(hintObj)
    })

    it('passes undefined hint when not provided', async () => {
      const params = await helper.getParams({
        code: 'test-checkbox',
        hint: undefined,
        items: [],
      })
      expect(params.hint).toEqual({ text: undefined })
    })
  })

  describe('Items transformation', () => {
    it('transforms checkbox items correctly', async () => {
      const params = await helper.getParams({
        code: 'test-checkbox',
        items: [
          { value: 'email', text: 'Email' },
          { value: 'phone', text: 'Phone', disabled: true },
        ],
      })
      expect(params.items).toEqual([
        {
          value: 'email',
          text: 'Email',
          html: undefined,
          id: undefined,
          hint: { text: undefined },
          checked: undefined,
          conditional: undefined,
          disabled: undefined,
          behaviour: undefined,
          attributes: undefined,
          label: undefined,
        },
        {
          value: 'phone',
          text: 'Phone',
          html: undefined,
          id: undefined,
          hint: { text: undefined },
          checked: undefined,
          conditional: undefined,
          disabled: true,
          behaviour: undefined,
          attributes: undefined,
          label: undefined,
        },
      ])
    })

    it('handles dividers in items', async () => {
      const params = await helper.getParams({
        code: 'test-checkbox',
        items: [
          { value: 'option1', text: 'Option 1' },
          { divider: 'or' },
          { value: 'none', text: 'None of the above', behaviour: 'exclusive' },
        ],
      })
      expect(params.items).toHaveLength(3)
      expect(params.items[1]).toEqual({ divider: 'or' })
      expect(params.items[2].behaviour).toBe('exclusive')
    })

    it('marks items as checked based on value array', async () => {
      const params = await helper.getParams({
        code: 'test-checkbox',
        value: ['email', 'phone'],
        items: [
          { value: 'email', text: 'Email' },
          { value: 'phone', text: 'Phone' },
          { value: 'post', text: 'Post' },
        ],
      })
      expect(params.items[0].checked).toBe(true)
      expect(params.items[1].checked).toBe(true)
      expect(params.items[2].checked).toBe(false)
    })

    it('respects individual checked property over value array', async () => {
      const params = await helper.getParams({
        code: 'test-checkbox',
        value: ['email'],
        items: [
          { value: 'email', text: 'Email' },
          { value: 'phone', text: 'Phone', checked: true },
        ],
      })
      expect(params.items[0].checked).toBe(true)
      expect(params.items[1].checked).toBe(true)
    })

    it('transforms item hints correctly', async () => {
      const params = await helper.getParams({
        code: 'test-checkbox',
        items: [
          { value: 'email', text: 'Email', hint: "We'll only use this for updates" },
          {
            value: 'phone',
            text: 'Phone',
            hint: {
              text: 'Including country code',
              classes: 'custom-hint',
            },
          },
        ],
      })
      expect(params.items[0].hint).toEqual({ text: "We'll only use this for updates" })
      expect(params.items[1].hint).toEqual({
        text: 'Including country code',
        classes: 'custom-hint',
      })
    })
  })

  describe('Error message transformation', () => {
    it('transforms error array to error message object', async () => {
      const params = await helper.getParams({
        code: 'test-checkbox',
        errors: [{ message: 'Select at least one option' }],
        items: [],
      })
      expect(params.errorMessage).toEqual({
        text: 'Select at least one option',
      })
    })

    it('uses first error when multiple provided', async () => {
      const params = await helper.getParams({
        code: 'test-checkbox',
        errors: [{ message: 'First error' }, { message: 'Second error' }],
        items: [],
      })
      expect(params.errorMessage).toEqual({
        text: 'First error',
      })
    })

    it('sets errorMessage to undefined when no errors', async () => {
      const params = await helper.getParams({
        code: 'test-checkbox',
        items: [],
      })
      expect(params.errorMessage).toBeUndefined()
    })
  })

  describe('Additional options passthrough', () => {
    it('passes through formGroup options', async () => {
      const formGroupObj = {
        classes: 'custom-form-group',
        attributes: { 'data-test': 'value' },
        beforeInputs: { text: 'Before text' },
        afterInputs: { html: '<span>After HTML</span>' },
      }
      const params = await helper.getParams({
        code: 'test-checkbox',
        formGroup: formGroupObj,
        items: [],
      })
      expect(params.formGroup).toEqual(formGroupObj)
    })

    it('passes through classes and attributes', async () => {
      const params = await helper.getParams({
        code: 'test-checkbox',
        classes: 'custom-checkbox-class',
        attributes: { 'data-module': 'custom-module' },
        items: [],
      })
      expect(params.classes).toBe('custom-checkbox-class')
      expect(params.attributes).toEqual({ 'data-module': 'custom-module' })
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      const { template } = await helper.executeComponent({
        code: 'test-checkbox',
        items: [],
      })
      expect(template).toBe('govuk/components/checkboxes/template.njk')
    })

    it('wraps params in context object', async () => {
      const { context } = (await helper.executeComponent({
        code: 'test-checkbox',
        items: [],
      })) as { context: any }
      expect(context).toHaveProperty('params')
      expect(context.params).toHaveProperty('idPrefix')
      expect(context.params).toHaveProperty('name')
      expect(context.params).toHaveProperty('items')
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders a valid checkbox component', async () => {
      const html = await helper.renderWithNunjucks({
        variant: 'govukCheckboxInput',
        code: 'contact-methods',
        label: 'How would you like to be contacted?',
        hint: 'Select all that apply',
        value: ['email'],
        items: [
          { value: 'email', text: 'Email' },
          { value: 'phone', text: 'Phone' },
          { divider: 'or' },
          { value: 'none', text: 'I do not want to be contacted', behaviour: 'exclusive' },
        ],
        errors: [{ message: 'Select at least one option' }],
      })

      expect(html).toContainText('govuk-checkboxes')
      expect(html).toContainText('contact-methods')
      expect(html).toContainText('How would you like to be contacted?')
      expect(html).toContainText('Select all that apply')
      expect(html).toContainText('Select at least one option')
      expect(html).toContainText('Email')
      expect(html).toContainText('Phone')
      expect(html).toContainText('or')
      expect(html).toContainText('I do not want to be contacted')
      expect(html).toContainText('data-behaviour="exclusive"')
    })
  })
})
