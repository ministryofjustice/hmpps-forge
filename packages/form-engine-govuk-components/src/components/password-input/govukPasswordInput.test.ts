import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { govukPasswordInput } from './govukPasswordInput'

jest.mock('nunjucks')

describe('govukPasswordInput', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukPasswordInput)

  describe('Data transformation', () => {
    it('sets default values correctly', async () => {
      // Arrange
      // Act
      const params = await helper.getParams({ code: 'password-field' })

      // Assert
      expect(params.id).toBe('password-field')
      expect(params.name).toBe('password-field')
      expect(params.value).toBeUndefined()
    })

    it('uses custom ID over code', async () => {
      // Arrange
      // Act
      const params = await helper.getParams({
        code: 'password-field',
        id: 'custom-password-id',
      })

      // Assert
      expect(params.id).toBe('custom-password-id')
      expect(params.name).toBe('password-field')
    })

    it('passes through value', async () => {
      // Arrange
      // Act
      const params = await helper.getParams({
        code: 'password-field',
        value: 'initial-password-value',
      })

      // Assert
      expect(params.value).toBe('initial-password-value')
    })
  })

  describe('Label transformation', () => {
    it('converts string label to object format', async () => {
      // Arrange
      // Act
      const params = await helper.getParams({
        code: 'password-field',
        label: 'Password',
      })

      // Assert
      expect(params.label).toEqual({
        text: 'Password',
      })
    })

    it('passes through object label unchanged', async () => {
      // Arrange
      const labelObj = {
        text: 'Create a password',
        classes: 'govuk-label--l',
        isPageHeading: true,
      }

      // Act
      const params = await helper.getParams({
        code: 'password-field',
        label: labelObj,
      })

      // Assert
      expect(params.label).toEqual(labelObj)
    })

    it('passes through label with HTML', async () => {
      // Arrange
      const labelObj = {
        html: '<span>Password</span> <span class="govuk-caption-m">Required</span>',
      }

      // Act
      const params = await helper.getParams({
        code: 'password-field',
        label: labelObj,
      })

      // Assert
      expect(params.label).toEqual(labelObj)
    })
  })

  describe('Hint transformation', () => {
    it('converts string hint to object format', async () => {
      // Arrange
      // Act
      const params = await helper.getParams({
        code: 'password-field',
        hint: 'Your password must be at least 8 characters',
      })

      // Assert
      expect(params.hint).toEqual({
        text: 'Your password must be at least 8 characters',
      })
    })

    it('passes through object hint unchanged', async () => {
      // Arrange
      const hintObj = {
        text: 'Include numbers and special characters',
        classes: 'custom-hint',
      }

      // Act
      const params = await helper.getParams({
        code: 'password-field',
        hint: hintObj,
      })

      // Assert
      expect(params.hint).toEqual(hintObj)
    })

    it('passes undefined hint when not provided', async () => {
      // Arrange
      // Act
      const params = await helper.getParams({
        code: 'password-field',
        hint: undefined,
      })

      // Assert
      expect(params.hint).toBeUndefined()
    })
  })

  describe('Password-specific options', () => {
    it('passes through showPasswordText', async () => {
      // Arrange
      // Act
      const params = await helper.getParams({
        code: 'password-field',
        showPasswordText: 'Show password',
      })

      // Assert
      expect(params.showPasswordText).toBe('Show password')
    })

    it('passes through hidePasswordText', async () => {
      // Arrange
      // Act
      const params = await helper.getParams({
        code: 'password-field',
        hidePasswordText: 'Hide password',
      })

      // Assert
      expect(params.hidePasswordText).toBe('Hide password')
    })

    it('passes through showPasswordAriaLabelText', async () => {
      // Arrange
      // Act
      const params = await helper.getParams({
        code: 'password-field',
        showPasswordAriaLabelText: 'Show your password',
      })

      // Assert
      expect(params.showPasswordAriaLabelText).toBe('Show your password')
    })

    it('passes through hidePasswordAriaLabelText', async () => {
      // Arrange
      // Act
      const params = await helper.getParams({
        code: 'password-field',
        hidePasswordAriaLabelText: 'Hide your password',
      })

      // Assert
      expect(params.hidePasswordAriaLabelText).toBe('Hide your password')
    })

    it('passes through passwordShownAnnouncementText', async () => {
      // Arrange
      // Act
      const params = await helper.getParams({
        code: 'password-field',
        passwordShownAnnouncementText: 'Password shown',
      })

      // Assert
      expect(params.passwordShownAnnouncementText).toBe('Password shown')
    })

    it('passes through passwordHiddenAnnouncementText', async () => {
      // Arrange
      // Act
      const params = await helper.getParams({
        code: 'password-field',
        passwordHiddenAnnouncementText: 'Password hidden',
      })

      // Assert
      expect(params.passwordHiddenAnnouncementText).toBe('Password hidden')
    })

    it('passes through button customization options', async () => {
      // Arrange
      const buttonObj = {
        classes: 'custom-button-class',
      }

      // Act
      const params = await helper.getParams({
        code: 'password-field',
        button: buttonObj,
      })

      // Assert
      expect(params.button).toEqual(buttonObj)
    })

    it('passes through all password options together', async () => {
      // Arrange
      // Act
      const params = await helper.getParams({
        code: 'password-field',
        showPasswordText: 'Show',
        hidePasswordText: 'Hide',
        showPasswordAriaLabelText: 'Show your password',
        hidePasswordAriaLabelText: 'Hide your password',
        passwordShownAnnouncementText: 'Your password is visible',
        passwordHiddenAnnouncementText: 'Your password is hidden',
        button: { classes: 'custom-toggle-button' },
      })

      // Assert
      expect(params.showPasswordText).toBe('Show')
      expect(params.hidePasswordText).toBe('Hide')
      expect(params.showPasswordAriaLabelText).toBe('Show your password')
      expect(params.hidePasswordAriaLabelText).toBe('Hide your password')
      expect(params.passwordShownAnnouncementText).toBe('Your password is visible')
      expect(params.passwordHiddenAnnouncementText).toBe('Your password is hidden')
      expect(params.button).toEqual({ classes: 'custom-toggle-button' })
    })
  })

  describe('Input attributes', () => {
    it('passes through all input attributes without transformation', async () => {
      // Arrange
      // Act
      const params = await helper.getParams({
        code: 'password-field',
        disabled: true,
        autocomplete: 'current-password',
        describedBy: 'password-requirements',
        formGroup: {
          classes: 'custom-form-group',
          beforeInput: { text: 'Before text' },
          afterInput: { html: '<span>After HTML</span>' },
        },
        classes: 'govuk-input--width-20',
        attributes: {
          'data-testid': 'password-input',
          'aria-describedby': 'help-text',
        },
      })

      // Assert
      expect(params.disabled).toBe(true)
      expect(params.autocomplete).toBe('current-password')
      expect(params.describedBy).toBe('password-requirements')
      expect(params.formGroup).toEqual({
        classes: 'custom-form-group',
        beforeInput: { text: 'Before text' },
        afterInput: { html: '<span>After HTML</span>' },
      })
      expect(params.classes).toBe('govuk-input--width-20')
      expect(params.attributes).toEqual({
        'data-testid': 'password-input',
        'aria-describedby': 'help-text',
      })
    })
  })

  describe('Error message transformation', () => {
    it('transforms error array to error message object', async () => {
      // Arrange
      // Act
      const params = await helper.getParams({
        code: 'password-field',
        errors: [{ message: 'Enter your password' }],
      })

      // Assert
      expect(params.errorMessage).toEqual({
        text: 'Enter your password',
      })
    })

    it('uses first error when multiple provided', async () => {
      // Arrange
      // Act
      const params = await helper.getParams({
        code: 'password-field',
        errors: [{ message: 'First error' }, { message: 'Second error' }],
      })

      // Assert
      expect(params.errorMessage).toEqual({
        text: 'First error',
      })
    })

    it('sets errorMessage to undefined when no errors', async () => {
      // Arrange
      // Act
      const params = await helper.getParams({ code: 'password-field' })

      // Assert
      expect(params.errorMessage).toBeUndefined()
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      // Arrange
      // Act
      const { template } = await helper.executeComponent({
        code: 'password-field',
      })

      // Assert
      expect(template).toBe('govuk/components/password-input/template.njk')
    })

    it('wraps params in context object', async () => {
      // Arrange
      // Act
      const { context } = (await helper.executeComponent({
        code: 'password-field',
      })) as { context: any }

      // Assert
      expect(context).toHaveProperty('params')
      expect(context.params).toHaveProperty('id')
      expect(context.params).toHaveProperty('name')
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders a valid password input component', async () => {
      // Arrange
      // Act
      const html = await helper.renderWithNunjucks({
        code: 'user-password',
        variant: 'govukPasswordInput',
        label: 'Password',
        hint: 'Your password must be at least 8 characters',
        value: 'test-password-value',
        autocomplete: 'current-password',
        errors: [{ message: 'Enter your password' }],
        showPasswordText: 'Show',
        hidePasswordText: 'Hide',
      })

      // Assert
      expect(html).toContainText('govuk-password-input')
      expect(html).toContainText('user-password')
      expect(html).toContainText('Password')
      expect(html).toContainText('Your password must be at least 8 characters')
      expect(html).toContainText('Enter your password')
      expect(html).toContainText('test-password-value')
      expect(html).toContainText('autocomplete="current-password"')
      expect(html).toContainText('Show')
    })
  })
})
