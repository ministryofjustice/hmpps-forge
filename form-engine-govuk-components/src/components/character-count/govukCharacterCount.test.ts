import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { govukCharacterCount } from './govukCharacterCount'

jest.mock('nunjucks')

describe('govukCharacterCount', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukCharacterCount)

  describe('Data transformation', () => {
    it('sets default values correctly', async () => {
      const params = await helper.getParams({ code: 'test-field' })
      expect(params.id).toBe('test-field')
      expect(params.name).toBe('test-field')
      expect(params.rows).toBe('5')
      expect(params.value).toBeUndefined()
    })

    it('uses custom ID over code', async () => {
      const params = await helper.getParams({
        code: 'test-field',
        id: 'custom-id',
      })
      expect(params.id).toBe('custom-id')
      expect(params.name).toBe('test-field')
    })

    it('passes through custom rows', async () => {
      const params = await helper.getParams({
        code: 'test-field',
        rows: '10',
      })
      expect(params.rows).toBe('10')
    })

    it('passes through value', async () => {
      const params = await helper.getParams({
        code: 'test-field',
        value: 'Initial text',
      })
      expect(params.value).toBe('Initial text')
    })
  })

  describe('Character and word limit logic', () => {
    it('sets maxlength when only maxLength provided', async () => {
      const params = await helper.getParams({
        code: 'test-field',
        maxLength: '500',
      })
      expect(params.maxlength).toBe('500')
      expect(params.maxwords).toBeUndefined()
    })

    it('sets maxwords when only maxWords provided', async () => {
      const params = await helper.getParams({
        code: 'test-field',
        maxWords: '150',
        maxLength: undefined,
      })
      expect(params.maxwords).toBe('150')
      expect(params.maxlength).toBeUndefined()
    })

    it('prioritizes maxWords over maxLength when both provided', async () => {
      const params = await helper.getParams({
        code: 'test-field',
        maxWords: '150',
        maxLength: '1000',
      })
      expect(params.maxwords).toBe('150')
      expect(params.maxlength).toBeUndefined()
    })

    it('passes through threshold value', async () => {
      const params = await helper.getParams({
        code: 'test-field',
        threshold: '75',
      })
      expect(params.threshold).toBe('75')
    })
  })

  describe('Label transformation', () => {
    it('converts string label to object format', async () => {
      const params = await helper.getParams({
        code: 'test-field',
        label: 'Describe your experience',
      })
      expect(params.label).toEqual({
        text: 'Describe your experience',
      })
    })

    it('passes through object label unchanged', async () => {
      const labelObj = {
        text: 'Complex Label',
        classes: 'govuk-label--l',
        isPageHeading: true,
      }
      const params = await helper.getParams({
        code: 'test-field',
        label: labelObj,
      })
      expect(params.label).toEqual(labelObj)
    })

    it('passes through label with HTML', async () => {
      const labelObj = {
        html: '<span>HTML Label</span>',
      }
      const params = await helper.getParams({
        code: 'test-field',
        label: labelObj,
      })
      expect(params.label).toEqual(labelObj)
    })
  })

  describe('Hint transformation', () => {
    it('converts string hint to object format', async () => {
      const params = await helper.getParams({
        code: 'test-field',
        hint: 'Do not include personal information',
      })
      expect(params.hint).toEqual({
        text: 'Do not include personal information',
      })
    })

    it('passes through object hint unchanged', async () => {
      const hintObj = {
        text: 'Complex hint text',
        classes: 'custom-hint-class',
        id: 'hint-id',
      }
      const params = await helper.getParams({
        code: 'test-field',
        hint: hintObj,
      })
      expect(params.hint).toEqual(hintObj)
    })

    it('passes undefined hint when not provided', async () => {
      const params = await helper.getParams({
        code: 'test-field',
        hint: undefined,
      })
      expect(params.hint).toEqual({ text: undefined })
    })
  })

  describe('Error message transformation', () => {
    it('transforms error array to error message object', async () => {
      const params = await helper.getParams({
        code: 'test-field',
        errors: [{ message: 'Enter a valid description' }],
      })
      expect(params.errorMessage).toEqual({
        text: 'Enter a valid description',
      })
    })

    it('uses first error when multiple provided', async () => {
      const params = await helper.getParams({
        code: 'test-field',
        errors: [{ message: 'First error' }, { message: 'Second error' }],
      })
      expect(params.errorMessage).toEqual({
        text: 'First error',
      })
    })

    it('sets errorMessage to undefined when no errors', async () => {
      const params = await helper.getParams({ code: 'test-field' })
      expect(params.errorMessage).toBeUndefined()
    })
  })

  describe('Textarea attributes', () => {
    it('passes through all textarea attributes without transformation', async () => {
      const params = await helper.getParams({
        code: 'test-field',
        spellcheck: false,
        formGroup: {
          classes: 'custom-form-group',
          attributes: { 'data-test': 'value' },
          beforeInput: { text: 'Before text' },
          afterInput: { html: '<span>After HTML</span>' },
        },
        classes: 'custom-character-count',
        attributes: {
          'data-testid': 'character-count-test',
          'data-module': 'custom-module',
        },
      })

      expect(params.spellcheck).toBe(false)
      expect(params.formGroup).toEqual({
        classes: 'custom-form-group',
        attributes: { 'data-test': 'value' },
        beforeInput: { text: 'Before text' },
        afterInput: { html: '<span>After HTML</span>' },
      })
      expect(params.classes).toBe('custom-character-count')
      expect(params.attributes).toEqual({
        'data-testid': 'character-count-test',
        'data-module': 'custom-module',
      })
    })
  })

  describe('Count message customization', () => {
    it('passes through all custom text messages for characters', async () => {
      const params = await helper.getParams({
        code: 'test-field',
        maxLength: '200',
        textareaDescriptionText: 'You can enter up to %{count} characters',
        charactersUnderLimitText: {
          one: 'You have %{count} character remaining',
          other: 'You have %{count} characters remaining',
        },
        charactersAtLimitText: 'You have reached the character limit',
        charactersOverLimitText: {
          one: 'You are %{count} character over the limit',
          other: 'You are %{count} characters over the limit',
        },
        countMessage: {
          classes: 'custom-count-message',
        },
      })

      expect(params.textareaDescriptionText).toBe('You can enter up to %{count} characters')
      expect(params.charactersUnderLimitText).toEqual({
        one: 'You have %{count} character remaining',
        other: 'You have %{count} characters remaining',
      })
      expect(params.charactersAtLimitText).toBe('You have reached the character limit')
      expect(params.charactersOverLimitText).toEqual({
        one: 'You are %{count} character over the limit',
        other: 'You are %{count} characters over the limit',
      })
      expect(params.countMessage).toEqual({
        classes: 'custom-count-message',
      })
    })

    it('passes through all custom text messages for words', async () => {
      const params = await helper.getParams({
        code: 'test-field',
        maxWords: '100',
        wordsUnderLimitText: {
          one: 'You have %{count} word remaining',
          other: 'You have %{count} words remaining',
        },
        wordsAtLimitText: 'You have reached the word limit',
        wordsOverLimitText: {
          one: 'You are %{count} word over the limit',
          other: 'You are %{count} words over the limit',
        },
      })

      expect(params.wordsUnderLimitText).toEqual({
        one: 'You have %{count} word remaining',
        other: 'You have %{count} words remaining',
      })
      expect(params.wordsAtLimitText).toBe('You have reached the word limit')
      expect(params.wordsOverLimitText).toEqual({
        one: 'You are %{count} word over the limit',
        other: 'You are %{count} words over the limit',
      })
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      const { template } = await helper.executeComponent({
        code: 'test-field',
      })
      expect(template).toBe('govuk/components/character-count/template.njk')
    })

    it('wraps params in context object', async () => {
      const { context } = (await helper.executeComponent({
        code: 'test-field',
      })) as { context: any }
      expect(context).toHaveProperty('params')
      expect(context.params).toHaveProperty('id')
      expect(context.params).toHaveProperty('name')
      expect(context.params).toHaveProperty('rows')
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders a valid character count component', async () => {
      const html = await helper.renderWithNunjucks({
        code: 'feedback-text',
        variant: 'govukCharacterCount',
        label: 'Provide feedback',
        hint: 'Do not include personal information',
        value: 'This is some initial text',
        maxLength: '200',
        threshold: '75',
        spellcheck: false,
        errors: [{ message: 'Your feedback is too long' }],
      })

      expect(html).toContainText('govuk-character-count')
      expect(html).toContainText('govuk-textarea')
      expect(html).toContainText('feedback-text')
      expect(html).toContainText('Provide feedback')
      expect(html).toContainText('Do not include personal information')
      expect(html).toContainText('Your feedback is too long')
      expect(html).toContainText('This is some initial text')
      expect(html).toContainText('data-maxlength="200"')
      expect(html).toContainText('data-threshold="75"')
      expect(html).toContainText('spellcheck="false"')
    })
  })
})
