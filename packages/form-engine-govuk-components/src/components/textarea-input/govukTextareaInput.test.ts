import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { govukTextareaInput } from './govukTextareaInput'

jest.mock('nunjucks')

describe('govukTextareaInput', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukTextareaInput)

  describe('Data transformation', () => {
    it('sets default values correctly', async () => {
      const params = await helper.getParams({ code: 'test-textarea' })
      expect(params.id).toBe('test-textarea')
      expect(params.name).toBe('test-textarea')
      expect(params.rows).toBe('5')
      expect(params.value).toBeUndefined()
    })

    it('uses custom ID over code', async () => {
      const params = await helper.getParams({
        code: 'test-textarea',
        id: 'custom-id',
      })
      expect(params.id).toBe('custom-id')
      expect(params.name).toBe('test-textarea')
    })

    it('passes through value', async () => {
      const params = await helper.getParams({
        code: 'test-textarea',
        value: 'Initial text content',
      })
      expect(params.value).toBe('Initial text content')
    })
  })

  describe('Label transformation', () => {
    it('converts string label to object format', async () => {
      const params = await helper.getParams({
        code: 'test-textarea',
        label: 'Enter your comments',
      })
      expect(params.label).toEqual({
        text: 'Enter your comments',
      })
    })

    it('passes through object label unchanged', async () => {
      const labelObj = {
        text: 'Detailed feedback',
        classes: 'govuk-label--l',
        isPageHeading: true,
      }
      const params = await helper.getParams({
        code: 'test-textarea',
        label: labelObj,
      })
      expect(params.label).toEqual(labelObj)
    })

    it('passes through label with HTML', async () => {
      const labelObj = {
        html: '<span>Comments</span> <span class="govuk-caption-m">Optional</span>',
      }
      const params = await helper.getParams({
        code: 'test-textarea',
        label: labelObj,
      })
      expect(params.label).toEqual(labelObj)
    })
  })

  describe('Hint transformation', () => {
    it('converts string hint to object format', async () => {
      const params = await helper.getParams({
        code: 'test-textarea',
        hint: 'Provide as much detail as possible',
      })
      expect(params.hint).toEqual({
        text: 'Provide as much detail as possible',
      })
    })

    it('passes through object hint unchanged', async () => {
      const hintObj = {
        text: 'Include specific examples',
        classes: 'custom-hint',
        id: 'hint-id',
      }
      const params = await helper.getParams({
        code: 'test-textarea',
        hint: hintObj,
      })
      expect(params.hint).toEqual(hintObj)
    })

    it('passes undefined hint when not provided', async () => {
      const params = await helper.getParams({
        code: 'test-textarea',
        hint: undefined,
      })
      expect(params.hint).toBeUndefined()
    })
  })

  describe('Textarea attributes', () => {
    it('passes through all textarea attributes without transformation', async () => {
      const params = await helper.getParams({
        code: 'test-textarea',
        rows: '10',
        spellcheck: false,
        autocomplete: 'off',
        formGroup: {
          classes: 'custom-form-group',
          attributes: { 'data-test': 'value' },
          beforeInput: { text: 'Before text' },
          afterInput: { html: '<span>After HTML</span>' },
        },
        classes: 'govuk-textarea--error custom-textarea',
        attributes: {
          'data-testid': 'textarea-test',
          'aria-describedby': 'extra-description',
          maxlength: '500',
        },
      })

      // All simple pass-through properties
      expect(params.rows).toBe('10')
      expect(params.spellcheck).toBe(false)
      expect(params.autocomplete).toBe('off')
      expect(params.formGroup).toEqual({
        classes: 'custom-form-group',
        attributes: { 'data-test': 'value' },
        beforeInput: { text: 'Before text' },
        afterInput: { html: '<span>After HTML</span>' },
      })
      expect(params.classes).toBe('govuk-textarea--error custom-textarea')
      expect(params.attributes).toEqual({
        'data-testid': 'textarea-test',
        'aria-describedby': 'extra-description',
        maxlength: '500',
      })
    })
  })

  describe('Error message transformation', () => {
    it('transforms error array to error message object', async () => {
      const params = await helper.getParams({
        code: 'test-textarea',
        errors: [{ message: 'Enter a description' }],
      })
      expect(params.errorMessage).toEqual({
        text: 'Enter a description',
      })
    })

    it('uses first error when multiple provided', async () => {
      const params = await helper.getParams({
        code: 'test-textarea',
        errors: [{ message: 'First error' }, { message: 'Second error' }],
      })
      expect(params.errorMessage).toEqual({
        text: 'First error',
      })
    })

    it('sets errorMessage to undefined when no errors', async () => {
      const params = await helper.getParams({ code: 'test-textarea' })
      expect(params.errorMessage).toBeUndefined()
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      const { template } = await helper.executeComponent({
        code: 'test-textarea',
      })
      expect(template).toBe('govuk/components/textarea/template.njk')
    })

    it('wraps params in context object', async () => {
      const { context } = (await helper.executeComponent({
        code: 'test-textarea',
      })) as { context: any }
      expect(context).toHaveProperty('params')
      expect(context.params).toHaveProperty('id')
      expect(context.params).toHaveProperty('name')
      expect(context.params).toHaveProperty('rows')
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders a valid textarea component', async () => {
      const html = await helper.renderWithNunjucks({
        variant: 'govukTextarea',
        code: 'feedback-textarea',
        label: 'Provide your feedback',
        hint: 'Tell us what you think',
        value: 'Initial feedback text',
        rows: '8',
        spellcheck: true,
        errors: [{ message: 'Please provide more detail' }],
      })

      expect(html).toContainText('govuk-textarea')
      expect(html).toContainText('feedback-textarea')
      expect(html).toContainText('Provide your feedback')
      expect(html).toContainText('Tell us what you think')
      expect(html).toContainText('Please provide more detail')
      expect(html).toContainText('Initial feedback text')
      expect(html).toContainText('rows="8"')
      expect(html).toContainText('spellcheck="true"')
    })
  })
})
