import { expect, test } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

test.describe('Feedback journey', () => {
  let form: ForgeFormHelper

  test.beforeEach(async ({ page }) => {
    form = new ForgeFormHelper(page)
    await page.goto('/example-journeys/feedback/name')
  })

  test.describe('happy path', () => {
    test('should complete the full feedback journey with email contact', async () => {
      // Arrange & Act — Name step
      await form.expectHeading('What is your name?')
      await form.fillTextInput('What is your name?', 'Jane Smith')
      await form.clickButton('Continue')

      // Act — Feedback step
      await form.expectHeading('Your feedback')
      await form.fillTextarea('Your feedback', 'Great service, very helpful.')
      await form.clickButton('Continue')

      // Act — Contact method step
      await form.expectHeading('How should we contact you?')
      await form.selectRadio('Email')
      await form.fillTextInput('Email address', 'jane@example.com')
      await form.clickButton('Continue')

      // Assert — Check answers
      await form.expectHeading('Check your answers before sending your feedback')
      await expect(form.getSummaryValue('Name')).toContainText('Jane Smith')
      await expect(form.getSummaryValue('Feedback')).toContainText('Great service, very helpful.')
      await expect(form.getSummaryValue('Contact method')).toContainText('Email (jane@example.com)')
      await form.clickButton('Send feedback')

      // Assert — Confirmation
      await form.expectPanelTitle('Feedback sent')
      await form.expectInsetText('You selected to be contacted by email.')
    })

    test('should complete the journey with phone contact', async () => {
      // Arrange
      await form.fillTextInput('What is your name?', 'John Doe')
      await form.clickButton('Continue')
      await form.fillTextarea('Your feedback', 'Some feedback')
      await form.clickButton('Continue')

      // Act
      await form.selectRadio('Phone')
      await form.fillTextInput('Phone number', '020 7946 0958')
      await form.clickButton('Continue')

      // Assert
      await expect(form.getSummaryValue('Contact method')).toContainText('Phone')
    })

    test('should complete the journey with text message contact', async () => {
      // Arrange
      await form.fillTextInput('What is your name?', 'John Doe')
      await form.clickButton('Continue')
      await form.fillTextarea('Your feedback', 'Some feedback')
      await form.clickButton('Continue')

      // Act
      await form.selectRadio('Text message')
      await form.fillTextInput('Mobile number', '07700900000')
      await form.clickButton('Continue')

      // Assert
      await expect(form.getSummaryValue('Contact method')).toContainText(
        'Text message (07700900000)',
      )
    })
  })

  test.describe('validation', () => {
    test('should show error when name is empty', async () => {
      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter your full name')
      await form.expectUrl('/example-journeys/feedback/name')
    })

    test('should show error when name contains invalid characters', async () => {
      // Act
      await form.fillTextInput('What is your name?', 'Jane123')
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError(
        'Full name must only include letters, spaces, hyphens and apostrophes',
      )
    })

    test('should show error when feedback is empty', async () => {
      // Arrange
      await form.fillTextInput('What is your name?', 'Jane Smith')
      await form.clickButton('Continue')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter your feedback')
      await form.expectUrl('/example-journeys/feedback/your-feedback')
    })

    test('should show error when no contact method is selected', async () => {
      // Arrange
      await form.fillTextInput('What is your name?', 'Jane Smith')
      await form.clickButton('Continue')
      await form.fillTextarea('Your feedback', 'Good stuff')
      await form.clickButton('Continue')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Select how you would like to be contacted')
    })

    test('should show error for invalid email format', async () => {
      // Arrange
      await form.fillTextInput('What is your name?', 'Jane Smith')
      await form.clickButton('Continue')
      await form.fillTextarea('Your feedback', 'Good stuff')
      await form.clickButton('Continue')

      // Act
      await form.selectRadio('Email')
      await form.fillTextInput('Email address', 'not-an-email')
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter a valid email address')
    })

    test('should show error for empty email when email contact selected', async () => {
      // Arrange
      await form.fillTextInput('What is your name?', 'Jane Smith')
      await form.clickButton('Continue')
      await form.fillTextarea('Your feedback', 'Good stuff')
      await form.clickButton('Continue')

      // Act
      await form.selectRadio('Email')
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter your email address')
    })
  })

  test.describe('conditional fields', () => {
    test.beforeEach(async () => {
      await form.fillTextInput('What is your name?', 'Jane Smith')
      await form.clickButton('Continue')
      await form.fillTextarea('Your feedback', 'Some feedback')
      await form.clickButton('Continue')
    })

    test('should show email input when Email is selected', async ({ page }) => {
      // Act
      await form.selectRadio('Email')

      // Assert
      await expect(page.getByLabel('Email address')).toBeVisible()
    })

    test('should show phone input when Phone is selected', async ({ page }) => {
      // Act
      await form.selectRadio('Phone')

      // Assert
      await expect(page.getByLabel('Phone number')).toBeVisible()
    })

    test('should show mobile input when Text message is selected', async ({ page }) => {
      // Act
      await form.selectRadio('Text message')

      // Assert
      await expect(page.getByLabel('Mobile number')).toBeVisible()
    })
  })

  test.describe('check answers change links', () => {
    test.beforeEach(async () => {
      await form.fillTextInput('What is your name?', 'Jane Smith')
      await form.clickButton('Continue')
      await form.fillTextarea('Your feedback', 'Original feedback')
      await form.clickButton('Continue')
      await form.selectRadio('Email')
      await form.fillTextInput('Email address', 'jane@example.com')
      await form.clickButton('Continue')
    })

    test('should navigate to name step when clicking Change on name row', async () => {
      // Act
      await form.clickChangeLink('Name')

      // Assert
      await form.expectHeading('What is your name?')
      await form.expectUrl('/example-journeys/feedback/name')
    })

    test('should navigate to feedback step when clicking Change on feedback row', async () => {
      // Act
      await form.clickChangeLink('Feedback')

      // Assert
      await form.expectHeading('Your feedback')
      await form.expectUrl('/example-journeys/feedback/your-feedback')
    })

    test('should navigate to contact method step when clicking Change on contact method row', async () => {
      // Act
      await form.clickChangeLink('Contact method')

      // Assert
      await form.expectHeading('How should we contact you?')
      await form.expectUrl('/example-journeys/feedback/contact-method')
    })
  })

  test.describe('restart', () => {
    test('should return to name step when clicking Start again on confirmation', async () => {
      // Arrange — complete the journey
      await form.fillTextInput('What is your name?', 'Jane Smith')
      await form.clickButton('Continue')
      await form.fillTextarea('Your feedback', 'Great service')
      await form.clickButton('Continue')
      await form.selectRadio('Email')
      await form.fillTextInput('Email address', 'jane@example.com')
      await form.clickButton('Continue')
      await form.clickButton('Send feedback')

      // Act
      await form.clickButton('Start again')

      // Assert
      await form.expectHeading('What is your name?')
      await form.expectUrl('/example-journeys/feedback/name')
    })
  })
})
