import { govukRadioInput } from './govukRadioInput'
import { GovukComponentTestHelper } from '../../../../test-utils/govukComponentTestHelper'
import { setupComponentTest } from '../../../../test-utils/componentTestHelper'
import { StructureType } from '../../../../form/types/enums'
import { BlockDefinition } from '../../../../form/types/structures.type'

jest.mock('nunjucks')

describe('govukRadioInput', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukRadioInput)

  describe('Data transformation', () => {
    it('sets default values correctly', async () => {
      const params = await helper.getParams({
        code: 'test-radio',
        items: [{ value: 'option1', text: 'Option 1' }],
      })
      expect(params.idPrefix).toBe('test-radio')
      expect(params.name).toBe('test-radio')
      expect(params.items).toHaveLength(1)
      expect(params.value).toBeUndefined()
    })

    it('uses custom idPrefix over code', async () => {
      const params = await helper.getParams({
        code: 'test-radio',
        idPrefix: 'custom-id-prefix',
        items: [],
      })
      expect(params.idPrefix).toBe('custom-id-prefix')
      expect(params.name).toBe('test-radio')
    })

    it('passes through value', async () => {
      const params = await helper.getParams({
        code: 'test-radio',
        value: 'selected-value',
        items: [],
      })
      expect(params.value).toBe('selected-value')
    })
  })

  describe('Fieldset and legend transformation', () => {
    it('creates fieldset with label as legend when no fieldset provided', async () => {
      const params = await helper.getParams({
        code: 'test-radio',
        label: 'Choose an option',
        items: [],
      })
      expect(params.fieldset).toEqual({
        legend: {
          text: 'Choose an option',
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
        code: 'test-radio',
        fieldset: fieldsetConfig,
        items: [],
      })
      expect(params.fieldset).toEqual(fieldsetConfig)
    })
  })

  describe('Hint transformation', () => {
    it('converts string hint to object format', async () => {
      const params = await helper.getParams({
        code: 'test-radio',
        hint: 'Select one option',
        items: [],
      })
      expect(params.hint).toEqual({
        text: 'Select one option',
      })
    })

    it('passes through object hint unchanged', async () => {
      const hintObj = {
        text: 'Hint text',
        classes: 'custom-hint',
        id: 'hint-id',
      }
      const params = await helper.getParams({
        code: 'test-radio',
        hint: hintObj,
        items: [],
      })
      expect(params.hint).toEqual(hintObj)
    })

    it('passes undefined hint when not provided', async () => {
      const params = await helper.getParams({
        code: 'test-radio',
        hint: undefined,
        items: [],
      })
      expect(params.hint).toEqual({ text: undefined })
    })
  })

  describe('Items transformation', () => {
    it('transforms radio items correctly', async () => {
      const params = await helper.getParams({
        code: 'test-radio',
        items: [
          { value: 'yes', text: 'Yes' },
          { value: 'no', text: 'No', disabled: true },
        ],
      })
      expect(params.items).toEqual([
        {
          value: 'yes',
          text: 'Yes',
          html: undefined,
          id: undefined,
          hint: { text: undefined },
          checked: false,
          conditional: undefined,
          disabled: undefined,
          attributes: undefined,
        },
        {
          value: 'no',
          text: 'No',
          html: undefined,
          id: undefined,
          hint: { text: undefined },
          checked: false,
          conditional: undefined,
          disabled: true,
          attributes: undefined,
        },
      ])
    })

    it('handles dividers in items', async () => {
      const params = await helper.getParams({
        code: 'test-radio',
        items: [{ value: 'option1', text: 'Option 1' }, { divider: 'or' }, { value: 'option2', text: 'Option 2' }],
      })
      expect(params.items).toHaveLength(3)
      expect(params.items[1]).toEqual({ divider: 'or' })
    })

    it('marks item as checked based on value', async () => {
      const params = await helper.getParams({
        code: 'test-radio',
        value: 'option2',
        items: [
          { value: 'option1', text: 'Option 1' },
          { value: 'option2', text: 'Option 2' },
          { value: 'option3', text: 'Option 3' },
        ],
      })
      expect(params.items[0].checked).toBe(false)
      expect(params.items[1].checked).toBe(true)
      expect(params.items[2].checked).toBe(false)
    })

    it('respects individual checked property over value', async () => {
      // TODO: I'm not really sure how the JS handles 2 of these with competing checks...
      const params = await helper.getParams({
        code: 'test-radio',
        value: 'option1',
        items: [
          { value: 'option1', text: 'Option 1' },
          { value: 'option2', text: 'Option 2', checked: true },
        ],
      })

      expect(params.items[0].checked).toBe(true)
      expect(params.items[1].checked).toBe(true)
    })

    it('transforms item hints correctly', async () => {
      const params = await helper.getParams({
        code: 'test-radio',
        items: [
          { value: 'email', text: 'Email', hint: `We'll send updates to your email` },
          {
            value: 'sms',
            text: 'SMS',
            hint: {
              text: 'Standard rates apply',
              classes: 'custom-hint',
            },
          },
        ],
      })
      expect(params.items[0].hint).toEqual({ text: `We'll send updates to your email` })
      expect(params.items[1].hint).toEqual({
        text: 'Standard rates apply',
        classes: 'custom-hint',
      })
    })

    it('passes through conditional blocks', async () => {
      const conditionalBlock: BlockDefinition = {
        type: StructureType.BLOCK,
        variant: 'text',
      }
      const conditionalHtml = `<p>Some conditional HTML</p>`
      const params = await helper.getParams({
        code: 'test-radio',
        items: [
          { value: 'yes', text: 'Yes', block: { block: conditionalBlock, html: conditionalHtml } },
          { value: 'no', text: 'No' },
        ],
      })
      expect(params.items[0].conditional).toEqual({ html: conditionalHtml })
      expect(params.items[1].conditional).toBeUndefined()
    })
  })

  describe('Error message transformation', () => {
    it('transforms error array to error message object', async () => {
      const params = await helper.getParams({
        code: 'test-radio',
        errors: [{ message: 'Select an option' }],
        items: [],
      })
      expect(params.errorMessage).toEqual({
        text: 'Select an option',
      })
    })

    it('uses first error when multiple provided', async () => {
      const params = await helper.getParams({
        code: 'test-radio',
        errors: [{ message: 'First error' }, { message: 'Second error' }],
        items: [],
      })
      expect(params.errorMessage).toEqual({
        text: 'First error',
      })
    })

    it('sets errorMessage to undefined when no errors', async () => {
      const params = await helper.getParams({
        code: 'test-radio',
        items: [],
      })
      expect(params.errorMessage).toBeUndefined()
    })
  })

  describe('Radio attributes', () => {
    it('passes through all radio attributes without transformation', async () => {
      const params = await helper.getParams({
        code: 'test-radio',
        classes: 'govuk-radios--inline',
        attributes: { 'data-module': 'govuk-radios' },
        formGroup: {
          classes: 'custom-form-group',
          attributes: { 'data-test': 'value' },
          beforeInputs: { text: 'Before text' },
          afterInputs: { html: '<span>After HTML</span>' },
        },
        items: [],
      })

      expect(params.classes).toBe('govuk-radios--inline')
      expect(params.attributes).toEqual({ 'data-module': 'govuk-radios' })
      expect(params.formGroup).toEqual({
        classes: 'custom-form-group',
        attributes: { 'data-test': 'value' },
        beforeInputs: { text: 'Before text' },
        afterInputs: { html: '<span>After HTML</span>' },
      })
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      const { template } = await helper.executeComponent({
        code: 'test-radio',
        items: [],
      })
      expect(template).toBe('govuk/components/radios/template.njk')
    })

    it('wraps params in context object', async () => {
      const { context } = (await helper.executeComponent({
        code: 'test-radio',
        items: [],
      })) as { context: any }
      expect(context).toHaveProperty('params')
      expect(context.params).toHaveProperty('idPrefix')
      expect(context.params).toHaveProperty('name')
      expect(context.params).toHaveProperty('items')
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders a valid radio component', async () => {
      const html = await helper.renderWithNunjucks({
        variant: 'govukRadioInput',
        code: 'contact-preference',
        label: 'How would you prefer to be contacted?',
        hint: 'Select one option',
        value: 'email',
        items: [
          { value: 'email', text: 'Email', hint: `We'll respond within 24 hours` },
          { value: 'phone', text: 'Phone' },
          { divider: 'or' },
          { value: 'post', text: 'Post', hint: 'Allow 5-7 working days' },
        ],
        errors: [{ message: `Select how you'd like to be contacted` }],
      })

      expect(html).toContainText('govuk-radios')
      expect(html).toContainText('contact-preference')
      expect(html).toContainText('How would you prefer to be contacted?')
      expect(html).toContainText('Select one option')
      expect(html).toContainText(`Select how you'd like to be contacted`)
      expect(html).toContainText('Email')
      expect(html).toContainText('Phone')
      expect(html).toContainText('Post')
      expect(html).toContainText('or')
      expect(html).toContainText(`We'll respond within 24 hours`)
      expect(html).toContainText('Allow 5-7 working days')
    })
  })
})
