import { expect, test } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-developer-guide/patterns/demos/edit-and-return'

test.describe('Edit and return journey', () => {
  let form: ForgeFormHelper

  test.beforeEach(async ({ page }) => {
    form = new ForgeFormHelper(page)
    await page.goto(`${basePath}/full-name`)
  })

  test.describe('happy path', () => {
    test('should complete the full journey and see confirmation', async () => {
      // Act — Name
      await form.expectHeading('What is your full name?')
      await form.fillTextInput('What is your full name?', 'Alice Smith')
      await form.clickButton('Continue')

      // Act — Email
      await form.expectHeading('What is your email address?')
      await form.fillTextInput('What is your email address?', 'alice@example.com')
      await form.clickButton('Continue')

      // Act — Contact preference
      await form.expectHeading('How would you prefer to be contacted?')
      await form.selectRadio('Email')
      await form.clickButton('Continue')

      // Assert — Check answers
      await form.expectHeading('Check your answers')
      await expect(form.getSummaryValue('Full name')).toContainText('Alice Smith')
      await expect(form.getSummaryValue('Email address')).toContainText('alice@example.com')
      await expect(form.getSummaryValue('Contact preference')).toContainText('Email')
      await form.clickButton('Confirm')

      // Assert — Confirmation
      await form.expectPanelTitle('Details submitted')
    })
  })

  test.describe('validation', () => {
    test('should show error when name is empty', async () => {
      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter your full name')
    })

    test('should show error when name exceeds 100 characters', async () => {
      // Act
      await form.fillTextInput('What is your full name?', 'A'.repeat(101))
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Full name must be 100 characters or less')
    })

    test('should show error when email is empty', async () => {
      // Arrange
      await form.fillTextInput('What is your full name?', 'Alice Smith')
      await form.clickButton('Continue')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter your email address')
    })

    test('should show error when contact preference is not selected', async () => {
      // Arrange
      await form.fillTextInput('What is your full name?', 'Alice Smith')
      await form.clickButton('Continue')
      await form.fillTextInput('What is your email address?', 'alice@example.com')
      await form.clickButton('Continue')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Select how you would prefer to be contacted')
    })
  })

  test.describe('edit and return', () => {
    test.beforeEach(async () => {
      // Arrange — complete the flow to reach check-answers
      await form.fillTextInput('What is your full name?', 'Alice Smith')
      await form.clickButton('Continue')
      await form.fillTextInput('What is your email address?', 'alice@example.com')
      await form.clickButton('Continue')
      await form.selectRadio('Email')
      await form.clickButton('Continue')
    })

    test('should return to check-answers after changing name', async () => {
      // Act
      await form.clickChangeLink('Full name')
      await form.expectHeading('What is your full name?')
      await form.fillTextInput('What is your full name?', 'Bob Jones')
      await form.clickButton('Continue')

      // Assert — returned to summary, not to email-address
      await form.expectHeading('Check your answers')
      await form.expectUrl(`${basePath}/check-answers`)
      await expect(form.getSummaryValue('Full name')).toContainText('Bob Jones')
    })

    test('should return to check-answers after changing email', async () => {
      // Act
      await form.clickChangeLink('Email address')
      await form.expectHeading('What is your email address?')
      await form.fillTextInput('What is your email address?', 'bob@example.com')
      await form.clickButton('Continue')

      // Assert — returned to summary, not to contact-preference
      await form.expectHeading('Check your answers')
      await form.expectUrl(`${basePath}/check-answers`)
      await expect(form.getSummaryValue('Email address')).toContainText('bob@example.com')
    })

    test('should return to check-answers after changing contact preference', async () => {
      // Act
      await form.clickChangeLink('Contact preference')
      await form.expectHeading('How would you prefer to be contacted?')
      await form.selectRadio('Post')
      await form.clickButton('Continue')

      // Assert — returned to summary
      await form.expectHeading('Check your answers')
      await form.expectUrl(`${basePath}/check-answers`)
      await expect(form.getSummaryValue('Contact preference')).toContainText('Post')
    })

    test('should include returnTo query parameter in change link URL', async ({ page }) => {
      // Assert
      const changeLink = page
        .locator('.govuk-summary-list__row', { hasText: 'Full name' })
        .getByRole('link', { name: /change/i })

      await expect(changeLink).toHaveAttribute('href', /returnTo=check-answers/)
    })

    test('should preserve other answers when changing one', async () => {
      // Act — change only the name
      await form.clickChangeLink('Full name')
      await form.fillTextInput('What is your full name?', 'Charlie Brown')
      await form.clickButton('Continue')

      // Assert — all other answers are preserved
      await expect(form.getSummaryValue('Full name')).toContainText('Charlie Brown')
      await expect(form.getSummaryValue('Email address')).toContainText('alice@example.com')
      await expect(form.getSummaryValue('Contact preference')).toContainText('Email')
    })
  })

  test.describe('restart', () => {
    test('should return to overview when clicking Restart pattern', async () => {
      // Arrange — complete the journey
      await form.fillTextInput('What is your full name?', 'Alice Smith')
      await form.clickButton('Continue')
      await form.fillTextInput('What is your email address?', 'alice@example.com')
      await form.clickButton('Continue')
      await form.selectRadio('Phone')
      await form.clickButton('Continue')
      await form.clickButton('Confirm')

      // Act
      await form.clickButton('Restart pattern')

      // Assert
      await form.expectHeading('Edit and return')
      await form.expectUrl(`${basePath}/overview`)
    })
  })
})
