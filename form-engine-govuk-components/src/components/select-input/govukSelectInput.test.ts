import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { govukSelectInput, SelectItem } from './govukSelectInput'

jest.mock('nunjucks')

describe('govukSelectInput', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukSelectInput)

  describe('Data transformation', () => {
    it('sets default values correctly', async () => {
      // Arrange
      const block = {
        code: 'test-select',
        items: [{ value: 'option1', text: 'Option 1' }],
      }

      // Act
      const params = await helper.getParams(block)

      // Assert
      expect(params.id).toBe('test-select')
      expect(params.name).toBe('test-select')
      expect(params.items).toEqual([{ value: 'option1', text: 'Option 1' }])
      expect(params.value).toBeUndefined()
    })

    it('uses custom ID over code', async () => {
      // Arrange
      const block = {
        code: 'test-select',
        id: 'custom-id',
        items: [] as SelectItem[],
      }

      // Act
      const params = await helper.getParams(block)

      // Assert
      expect(params.id).toBe('custom-id')
      expect(params.name).toBe('test-select')
    })

    it('passes through value', async () => {
      // Arrange
      const block = {
        code: 'test-select',
        value: 'selected-value',
        items: [] as SelectItem[],
      }

      // Act
      const params = await helper.getParams(block)

      // Assert
      expect(params.value).toBe('selected-value')
    })

    it('passes through items array', async () => {
      // Arrange
      const items = [
        { value: '', text: 'Choose an option' },
        { value: 'uk', text: 'United Kingdom' },
        { value: 'fr', text: 'France', disabled: true },
      ]
      const block = {
        code: 'test-select',
        items,
      }

      // Act
      const params = await helper.getParams(block)

      // Assert
      expect(params.items).toEqual(items)
    })
  })

  describe('Label transformation', () => {
    it('converts string label to object format', async () => {
      // Arrange
      const block = {
        code: 'test-select',
        label: 'Select your country',
        items: [] as SelectItem[],
      }

      // Act
      const params = await helper.getParams(block)

      // Assert
      expect(params.label).toEqual({
        text: 'Select your country',
      })
    })

    it('passes through object label unchanged', async () => {
      // Arrange
      const labelObj = {
        text: 'Country',
        classes: 'govuk-label--l',
        isPageHeading: true,
      }
      const block = {
        code: 'test-select',
        label: labelObj,
        items: [] as SelectItem[],
      }

      // Act
      const params = await helper.getParams(block)

      // Assert
      expect(params.label).toEqual(labelObj)
    })

    it('passes through label with HTML', async () => {
      // Arrange
      const labelObj = {
        html: '<span>Country</span> <span class="govuk-caption-m">Required</span>',
      }
      const block = {
        code: 'test-select',
        label: labelObj,
        items: [] as SelectItem[],
      }

      // Act
      const params = await helper.getParams(block)

      // Assert
      expect(params.label).toEqual(labelObj)
    })
  })

  describe('Hint transformation', () => {
    it('converts string hint to object format', async () => {
      // Arrange
      const block = {
        code: 'test-select',
        hint: 'Select the country where you currently live',
        items: [] as SelectItem[],
      }

      // Act
      const params = await helper.getParams(block)

      // Assert
      expect(params.hint).toEqual({
        text: 'Select the country where you currently live',
      })
    })

    it('passes through object hint unchanged', async () => {
      // Arrange
      const hintObj = {
        text: 'This is the country where you pay tax',
        classes: 'custom-hint',
        id: 'country-hint',
      }
      const block = {
        code: 'test-select',
        hint: hintObj,
        items: [] as SelectItem[],
      }

      // Act
      const params = await helper.getParams(block)

      // Assert
      expect(params.hint).toEqual(hintObj)
    })

    it('passes undefined hint when not provided', async () => {
      // Arrange
      const block = {
        code: 'test-select',
        hint: undefined as undefined,
        items: [] as SelectItem[],
      }

      // Act
      const params = await helper.getParams(block)

      // Assert
      expect(params.hint).toBeUndefined()
    })
  })

  describe('Select attributes', () => {
    it('passes through disabled state', async () => {
      // Arrange
      const block = {
        code: 'test-select',
        disabled: true,
        items: [] as SelectItem[],
      }

      // Act
      const params = await helper.getParams(block)

      // Assert
      expect(params.disabled).toBe(true)
    })

    it('passes through classes', async () => {
      // Arrange
      const block = {
        code: 'test-select',
        classes: 'govuk-!-width-one-half',
        items: [] as SelectItem[],
      }

      // Act
      const params = await helper.getParams(block)

      // Assert
      expect(params.classes).toBe('govuk-!-width-one-half')
    })

    it('passes through attributes', async () => {
      // Arrange
      const block = {
        code: 'test-select',
        attributes: {
          'data-module': 'accessible-autocomplete',
          'aria-describedby': 'help-text',
        },
        items: [] as SelectItem[],
      }

      // Act
      const params = await helper.getParams(block)

      // Assert
      expect(params.attributes).toEqual({
        'data-module': 'accessible-autocomplete',
        'aria-describedby': 'help-text',
      })
    })

    it('passes through formGroup configuration', async () => {
      // Arrange
      const formGroup = {
        classes: 'custom-form-group',
        attributes: { 'data-test': 'value' },
        beforeInput: { text: 'Before text' },
        afterInput: { html: '<span>After HTML</span>' },
      }
      const block = {
        code: 'test-select',
        formGroup,
        items: [] as SelectItem[],
      }

      // Act
      const params = await helper.getParams(block)

      // Assert
      expect(params.formGroup).toEqual(formGroup)
    })
  })

  describe('Error message transformation', () => {
    it('transforms error array to error message object', async () => {
      // Arrange
      const block = {
        code: 'test-select',
        errors: [{ message: 'Select an option' }],
        items: [] as SelectItem[],
      }

      // Act
      const params = await helper.getParams(block)

      // Assert
      expect(params.errorMessage).toEqual({
        text: 'Select an option',
      })
    })

    it('uses first error when multiple provided', async () => {
      // Arrange
      const block = {
        code: 'test-select',
        errors: [{ message: 'First error' }, { message: 'Second error' }],
        items: [] as SelectItem[],
      }

      // Act
      const params = await helper.getParams(block)

      // Assert
      expect(params.errorMessage).toEqual({
        text: 'First error',
      })
    })

    it('sets errorMessage to undefined when no errors', async () => {
      // Arrange
      const block = {
        code: 'test-select',
        items: [] as SelectItem[],
      }

      // Act
      const params = await helper.getParams(block)

      // Assert
      expect(params.errorMessage).toBeUndefined()
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      // Arrange
      const block = {
        code: 'test-select',
        items: [] as SelectItem[],
      }

      // Act
      const { template } = await helper.executeComponent(block)

      // Assert
      expect(template).toBe('govuk/components/select/template.njk')
    })

    it('wraps params in context object', async () => {
      // Arrange
      const block = {
        code: 'test-select',
        items: [] as SelectItem[],
      }

      // Act
      const { context } = (await helper.executeComponent(block)) as { context: any }

      // Assert
      expect(context).toHaveProperty('params')
      expect(context.params).toHaveProperty('id')
      expect(context.params).toHaveProperty('name')
      expect(context.params).toHaveProperty('items')
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders a valid select component', async () => {
      // Arrange
      const block = {
        variant: 'govukSelectInput' as const,
        code: 'country-select',
        label: 'Select your country',
        hint: 'Select the country where you currently live',
        value: 'uk',
        items: [
          { value: '', text: 'Choose an option' },
          { value: 'uk', text: 'United Kingdom' },
          { value: 'fr', text: 'France' },
          { value: 'de', text: 'Germany' },
        ],
        errors: [{ message: 'Select a country' }],
      }

      // Act
      const html = await helper.renderWithNunjucks(block)

      // Assert
      expect(html).toContainText('govuk-select')
      expect(html).toContainText('country-select')
      expect(html).toContainText('Select your country')
      expect(html).toContainText('Select the country where you currently live')
      expect(html).toContainText('Select a country')
      expect(html).toContainText('Choose an option')
      expect(html).toContainText('United Kingdom')
      expect(html).toContainText('France')
      expect(html).toContainText('Germany')
    })
  })
})
