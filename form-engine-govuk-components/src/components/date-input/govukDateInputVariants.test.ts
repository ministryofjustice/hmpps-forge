import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { govukDateInputFull, govukDateInputYearMonth, govukDateInputMonthDay } from './govukDateInputVariants'

jest.mock('nunjucks')

describe('govukDateInputVariants', () => {
  setupComponentTest()

  describe('govukDateInputFull', () => {
    const helper = new GovukComponentTestHelper(govukDateInputFull)

    describe('Data transformation', () => {
      it('sets default values correctly', async () => {
        const params = await helper.getParams({ code: 'test-date' })
        expect(params.id).toBe('test-date')
        expect(params.items).toHaveLength(3)
        expect(params.items[0].name).toBe('test-date[day]')
        expect(params.items[1].name).toBe('test-date[month]')
        expect(params.items[2].name).toBe('test-date[year]')
      })

      it('uses custom ID and namePrefix', async () => {
        const params = await helper.getParams({
          code: 'test-date',
          id: 'custom-id',
          namePrefix: 'custom-name',
        })
        expect(params.id).toBe('custom-id')
        expect(params.items[0].id).toBe('custom-id-day')
        expect(params.items[0].name).toBe('custom-name[day]')
      })

      it('parses ISO date string correctly', async () => {
        const params = await helper.getParams({
          code: 'test-date',
          value: '1980-03-31',
        })
        expect(params.items[0].value).toBe('31') // day
        expect(params.items[1].value).toBe('03') // month
        expect(params.items[2].value).toBe('1980') // year
      })

      it('handles undefined value gracefully', async () => {
        const params = await helper.getParams({
          code: 'test-date',
          value: undefined,
        })
        expect(params.items[0].value).toBeUndefined()
        expect(params.items[1].value).toBeUndefined()
        expect(params.items[2].value).toBeUndefined()
      })
    })

    describe('Input attributes', () => {
      it('sets correct input attributes and width classes', async () => {
        const params = await helper.getParams({ code: 'test-date' })

        params.items.forEach((item: { pattern: any; inputmode: any }) => {
          expect(item.pattern).toBe('[0-9]*')
          expect(item.inputmode).toBe('numeric')
        })

        expect(params.items[0].classes).toBe('govuk-input--width-2') // day
        expect(params.items[1].classes).toBe('govuk-input--width-2') // month
        expect(params.items[2].classes).toBe('govuk-input--width-4') // year
      })
    })

    describe('Fieldset and legend transformation', () => {
      it('creates fieldset with label as legend when no fieldset provided', async () => {
        const params = await helper.getParams({
          code: 'test-date',
          label: 'Date of birth',
        })
        expect(params.fieldset).toEqual({
          legend: {
            text: 'Date of birth',
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
        }
        const params = await helper.getParams({
          code: 'test-date',
          fieldset: fieldsetConfig,
        })
        expect(params.fieldset).toEqual(fieldsetConfig)
      })
    })

    describe('Hint transformation', () => {
      it('converts string hint to object format', async () => {
        const params = await helper.getParams({
          code: 'test-date',
          hint: 'For example, 31 3 1980',
        })
        expect(params.hint).toEqual({
          text: 'For example, 31 3 1980',
        })
      })

      it('passes through object hint unchanged', async () => {
        const hintObj = {
          text: 'Date hint',
          classes: 'custom-hint',
        }
        const params = await helper.getParams({
          code: 'test-date',
          hint: hintObj,
        })
        expect(params.hint).toEqual(hintObj)
      })

      it('passes undefined hint when not provided', async () => {
        const params = await helper.getParams({
          code: 'test-date',
          hint: undefined,
        })
        expect(params.hint).toBeUndefined()
      })
    })

    describe('Error message transformation', () => {
      it('applies error class to all fields when general error', async () => {
        const params = await helper.getParams({
          code: 'test-date',
          errors: [{ message: 'Enter a valid date' }],
        })
        expect(params.errorMessage).toEqual({ text: 'Enter a valid date' })
        expect(params.items[0].classes).toContain('govuk-input--error')
        expect(params.items[1].classes).toContain('govuk-input--error')
        expect(params.items[2].classes).toContain('govuk-input--error')
      })

      it('applies error class only to specific field when details.field provided', async () => {
        const params = await helper.getParams({
          code: 'test-date',
          errors: [{ message: 'Day must be valid', details: { field: 'day' } }],
        })
        expect(params.items[0].classes).toContain('govuk-input--error')
        expect(params.items[1].classes).not.toContain('govuk-input--error')
        expect(params.items[2].classes).not.toContain('govuk-input--error')
      })

      it('uses first error when multiple provided', async () => {
        const params = await helper.getParams({
          code: 'test-date',
          errors: [{ message: 'First error' }, { message: 'Second error' }],
        })
        expect(params.errorMessage).toEqual({
          text: 'First error',
        })
      })

      it('sets errorMessage to undefined when no errors', async () => {
        const params = await helper.getParams({ code: 'test-date' })
        expect(params.errorMessage).toBeUndefined()
      })
    })

    describe('Additional options passthrough', () => {
      it('passes through formGroup, classes and attributes', async () => {
        const params = await helper.getParams({
          code: 'test-date',
          formGroup: {
            classes: 'custom-form-group',
            attributes: { 'data-test': 'value' },
          },
          classes: 'custom-date-input',
          attributes: { 'data-module': 'date-picker' },
        })

        expect(params.formGroup).toEqual({
          classes: 'custom-form-group',
          attributes: { 'data-test': 'value' },
        })
        expect(params.classes).toBe('custom-date-input')
        expect(params.attributes).toEqual({ 'data-module': 'date-picker' })
      })
    })

    describe('Template and context', () => {
      it('calls nunjucks with correct template path', async () => {
        const { template } = await helper.executeComponent({
          code: 'test-date',
        })
        expect(template).toBe('govuk/components/date-input/template.njk')
      })

      it('wraps params in context object', async () => {
        const { context } = (await helper.executeComponent({
          code: 'test-date',
        })) as { context: any }
        expect(context).toHaveProperty('params')
        expect(context.params).toHaveProperty('id')
        expect(context.params).toHaveProperty('items')
        expect(context.params.items).toHaveLength(3)
      })
    })

    describe('DOM rendering smoke test', () => {
      it('renders a valid full date input component', async () => {
        const html = await helper.renderWithNunjucks({
          code: 'birth-date',
          variant: 'govukDateInputFull',
          label: 'Date of birth',
          hint: 'For example, 31 3 1980',
          value: '1980-03-31',
          errors: [{ message: 'Enter a valid date' }],
        })

        expect(html).toContainText('govuk-date-input')
        expect(html).toContainText('birth-date')
        expect(html).toContainText('Date of birth')
        expect(html).toContainText('For example, 31 3 1980')
        expect(html).toContainText('Enter a valid date')
        expect(html).toContainText('value="31"')
        expect(html).toContainText('value="03"')
        expect(html).toContainText('value="1980"')
      })
    })
  })

  describe('govukDateInputYearMonth', () => {
    const helper = new GovukComponentTestHelper(govukDateInputYearMonth)

    describe('Data transformation', () => {
      it('creates only month and year fields', async () => {
        const params = await helper.getParams({ code: 'expiry-date' })
        expect(params.items).toHaveLength(2)
        expect(params.items[0].name).toBe('expiry-date[month]')
        expect(params.items[1].name).toBe('expiry-date[year]')
        expect(params.items[0].label).toBe('Month')
        expect(params.items[1].label).toBe('Year')
      })

      it('parses year-month ISO string correctly', async () => {
        const params = await helper.getParams({
          code: 'expiry-date',
          value: '2025-03',
        })
        expect(params.items[0].value).toBe('03')
        expect(params.items[1].value).toBe('2025')
      })

      it('sets correct width classes', async () => {
        const params = await helper.getParams({ code: 'expiry-date' })
        expect(params.items[0].classes).toBe('govuk-input--width-2')
        expect(params.items[1].classes).toBe('govuk-input--width-4')
      })
    })

    describe('Error handling', () => {
      it('applies error class to specific field', async () => {
        const params = await helper.getParams({
          code: 'expiry-date',
          errors: [{ message: 'Invalid month', details: { field: 'month' } }],
        })
        expect(params.items[0].classes).toContain('govuk-input--error')
        expect(params.items[1].classes).not.toContain('govuk-input--error')
      })
    })

    describe('Template and context', () => {
      it('calls nunjucks with correct template path', async () => {
        const { template } = await helper.executeComponent({
          code: 'expiry-date',
        })
        expect(template).toBe('govuk/components/date-input/template.njk')
      })

      it('wraps params in context object', async () => {
        const { context } = (await helper.executeComponent({
          code: 'expiry-date',
        })) as { context: any }
        expect(context).toHaveProperty('params')
        expect(context.params).toHaveProperty('id')
        expect(context.params).toHaveProperty('items')
        expect(context.params.items).toHaveLength(2)
      })
    })

    describe('DOM rendering smoke test', () => {
      it('renders a valid year-month input component', async () => {
        const html = await helper.renderWithNunjucks({
          code: 'card-expiry',
          variant: 'govukDateInputYearMonth',
          label: 'Card expiry date',
          hint: 'For example, 03 2025',
          value: '2025-03',
        })

        expect(html).toContainText('govuk-date-input')
        expect(html).toContainText('card-expiry')
        expect(html).toContainText('Card expiry date')
        expect(html).toContainText('For example, 03 2025')
        expect(html).toContainText('value="03"')
        expect(html).toContainText('value="2025"')
        expect(html).not.toContainText('Day')
      })
    })
  })

  describe('govukDateInputMonthDay', () => {
    const helper = new GovukComponentTestHelper(govukDateInputMonthDay)

    describe('Data transformation', () => {
      it('creates only day and month fields', async () => {
        const params = await helper.getParams({ code: 'anniversary' })
        expect(params.items).toHaveLength(2)
        expect(params.items[0].name).toBe('anniversary[day]')
        expect(params.items[1].name).toBe('anniversary[month]')
        expect(params.items[0].label).toBe('Day')
        expect(params.items[1].label).toBe('Month')
      })

      it('parses month-day string correctly', async () => {
        const params = await helper.getParams({
          code: 'anniversary',
          value: '12-25',
        })
        expect(params.items[0].value).toBe('25')
        expect(params.items[1].value).toBe('12')
      })

      it('parses ISO 8601 recurring date format', async () => {
        const params = await helper.getParams({
          code: 'anniversary',
          value: '--12-25',
        })
        expect(params.items[0].value).toBe('25')
        expect(params.items[1].value).toBe('12')
      })

      it('sets correct width classes', async () => {
        const params = await helper.getParams({ code: 'anniversary' })
        expect(params.items[0].classes).toBe('govuk-input--width-2')
        expect(params.items[1].classes).toBe('govuk-input--width-2')
      })
    })

    describe('Error handling', () => {
      it('applies error class to specific field', async () => {
        const params = await helper.getParams({
          code: 'anniversary',
          errors: [{ message: 'Invalid day', details: { field: 'day' } }],
        })
        expect(params.items[0].classes).toContain('govuk-input--error')
        expect(params.items[1].classes).not.toContain('govuk-input--error')
      })
    })

    describe('Template and context', () => {
      it('calls nunjucks with correct template path', async () => {
        const { template } = await helper.executeComponent({
          code: 'anniversary',
        })
        expect(template).toBe('govuk/components/date-input/template.njk')
      })

      it('wraps params in context object', async () => {
        const { context } = (await helper.executeComponent({
          code: 'anniversary',
        })) as { context: any }
        expect(context).toHaveProperty('params')
        expect(context.params).toHaveProperty('id')
        expect(context.params).toHaveProperty('items')
        expect(context.params.items).toHaveLength(2)
      })
    })

    describe('DOM rendering smoke test', () => {
      // TODO: should probably render the other component variants
      it('renders a valid month-day input component', async () => {
        const html = await helper.renderWithNunjucks({
          code: 'birthday',
          variant: 'govukDateInputMonthDay',
          label: 'Birthday',
          hint: 'For example, 25 12 for Christmas',
          value: '12-25',
        })

        expect(html).toContainText('govuk-date-input')
        expect(html).toContainText('birthday')
        expect(html).toContainText('Birthday')
        expect(html).toContainText('For example, 25 12 for Christmas')
        expect(html).toContainText('value="25"')
        expect(html).toContainText('value="12"')
        expect(html).not.toContainText('Year')
      })
    })
  })
})
