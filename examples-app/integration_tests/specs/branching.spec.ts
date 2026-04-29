import { expect, test } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-developer-guide/patterns/demos/branching'

test.describe('Branching journey', () => {
  let form: ForgeFormHelper

  test.beforeEach(async ({ page }) => {
    form = new ForgeFormHelper(page)
    await page.goto(`${basePath}/visit-type`)
  })

  test.describe('happy path', () => {
    test('should complete the in-person branch', async () => {
      // Act — visit type
      await form.expectHeading('How would you like to meet?')
      await form.selectRadio('In person')
      await form.clickButton('Continue')

      // Act — location
      await form.expectHeading('Which office would you like to visit?')
      await form.selectRadio('Manchester')
      await form.clickButton('Continue')

      // Assert — check answers
      await form.expectHeading('Check your answers')
      await expect(form.getSummaryValue('How you would like to meet')).toContainText('In person')
      await expect(form.getSummaryValue('Office')).toContainText('Manchester')
      await form.clickButton('Confirm')

      // Assert — confirmation
      await form.expectPanelTitle('Visit booked')
    })

    test('should complete the video call branch', async () => {
      // Act — visit type
      await form.selectRadio('Video call')
      await form.clickButton('Continue')

      // Act — video email
      await form.expectHeading('What email should we send the invite to?')
      await form.fillTextInput('What email should we send the invite to?', 'jane@example.com')
      await form.clickButton('Continue')

      // Assert — check answers
      await expect(form.getSummaryValue('How you would like to meet')).toContainText('Video call')
      await expect(form.getSummaryValue('Invite email')).toContainText('jane@example.com')
      await form.clickButton('Confirm')
      await form.expectPanelTitle('Visit booked')
    })

    test('should complete the phone call branch', async () => {
      // Act — visit type
      await form.selectRadio('Phone call')
      await form.clickButton('Continue')

      // Act — phone number
      await form.expectHeading('What number should we call you on?')
      await form.fillTextInput('What number should we call you on?', '020 7946 0958')
      await form.clickButton('Continue')

      // Assert — check answers
      await expect(form.getSummaryValue('How you would like to meet')).toContainText('Phone call')
      await expect(form.getSummaryValue('Phone number')).toContainText('020 7946 0958')
      await form.clickButton('Confirm')
      await form.expectPanelTitle('Visit booked')
    })
  })

  test.describe('branching routes', () => {
    test('should route to location step for in-person', async () => {
      // Act
      await form.selectRadio('In person')
      await form.clickButton('Continue')

      // Assert
      await form.expectUrl(`${basePath}/location`)
    })

    test('should route to video email step for video call', async () => {
      // Act
      await form.selectRadio('Video call')
      await form.clickButton('Continue')

      // Assert
      await form.expectUrl(`${basePath}/video-email`)
    })

    test('should route to phone number step for phone call', async () => {
      // Act
      await form.selectRadio('Phone call')
      await form.clickButton('Continue')

      // Assert
      await form.expectUrl(`${basePath}/phone-number`)
    })
  })

  test.describe('validation', () => {
    test('should show error when no visit type is selected', async () => {
      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Select how you would like to meet')
    })

    test('should show error when no office is selected', async () => {
      // Arrange
      await form.selectRadio('In person')
      await form.clickButton('Continue')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Select an office')
    })

    test('should show error when email is empty', async () => {
      // Arrange
      await form.selectRadio('Video call')
      await form.clickButton('Continue')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter an email address')
    })

    test('should show error for invalid email', async () => {
      // Arrange
      await form.selectRadio('Video call')
      await form.clickButton('Continue')

      // Act
      await form.fillTextInput('What email should we send the invite to?', 'not-an-email')
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter a valid email address')
    })

    test('should show error when phone is empty', async () => {
      // Arrange
      await form.selectRadio('Phone call')
      await form.clickButton('Continue')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter a phone number')
    })
  })

  test.describe('check answers', () => {
    test('should show only the branch-specific row for in-person', async ({ page }) => {
      // Arrange
      await form.selectRadio('In person')
      await form.clickButton('Continue')
      await form.selectRadio('London')
      await form.clickButton('Continue')

      // Assert — office row visible, email and phone rows hidden
      await expect(form.getSummaryValue('Office')).toBeVisible()
      await expect(
        page.locator('.govuk-summary-list__row', { hasText: 'Invite email' }),
      ).not.toBeVisible()
      await expect(
        page.locator('.govuk-summary-list__row', { hasText: 'Phone number' }),
      ).not.toBeVisible()
    })

    test('should navigate to visit type when clicking Change on visit type row', async () => {
      // Arrange
      await form.selectRadio('In person')
      await form.clickButton('Continue')
      await form.selectRadio('Cardiff')
      await form.clickButton('Continue')

      // Act
      await form.clickChangeLink('How you would like to meet')

      // Assert
      await form.expectHeading('How would you like to meet?')
      await form.expectUrl(`${basePath}/visit-type`)
    })
  })

  test.describe('restart', () => {
    test('should return to overview when clicking Restart pattern', async () => {
      // Arrange — complete via phone branch
      await form.selectRadio('Phone call')
      await form.clickButton('Continue')
      await form.fillTextInput('What number should we call you on?', '020 7946 0958')
      await form.clickButton('Continue')
      await form.clickButton('Confirm')

      // Act
      await form.clickButton('Restart pattern')

      // Assert
      await form.expectHeading('Branching based on an earlier answer')
      await form.expectUrl(`${basePath}/overview`)
    })
  })
})
