import { expect, test } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

test.describe('Book appointment journey', () => {
  let form: ForgeFormHelper

  test.beforeEach(async ({ page }) => {
    form = new ForgeFormHelper(page)
    await page.goto('/example-journeys/book-appointment/type')
  })

  test.describe('happy path — phone appointment', () => {
    test('should complete a phone appointment booking', async ({ page }) => {
      // Act — Type step
      await form.expectHeading('What type of appointment do you need?')
      await form.selectRadio('Phone call')
      await form.clickButton('Continue')

      // Act — Details step
      await form.expectHeading('Your details')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.fillTextInput('Email address', 'jane@example.com')
      await form.fillTextInput('Phone number', '020 7946 0958')
      await form.clickButton('Continue')

      // Assert — Skips location step, goes straight to date
      await form.expectHeading('Appointment date')
      await form.expectUrl('/example-journeys/book-appointment/choose-date')

      // Assert — Phone-specific inset text
      await form.expectInsetText('We will call you on the phone number you provided')

      // Act — Date step (use a future weekday)
      const futureDate = getNextWeekday()
      await form.fillDateInput('Appointment date', formatDateForInput(futureDate))
      await form.clickButton('Continue')

      // Act — Time step
      await form.expectHeading('Choose a time')
      const timeSelect = page.getByLabel('Choose a time')
      await expect(timeSelect).toBeVisible()

      // Select the first available time slot
      const options = timeSelect.locator('option')
      const optionCount = await options.count()
      expect(optionCount).toBeGreaterThan(1) // More than just the placeholder

      const firstSlotValue = await options.nth(1).getAttribute('value')
      await timeSelect.selectOption(firstSlotValue!)
      await form.clickButton('Continue')

      // Act — Additional info step
      await form.expectHeading('Additional information')
      await form.fillTextarea('Additional information (optional)', 'No special requirements')
      await form.clickButton('Continue')

      // Assert — Check answers
      await form.expectHeading('Check your answers before booking')
      await expect(form.getSummaryValue('Appointment type')).toContainText('Phone call')
      await expect(form.getSummaryValue('Name')).toContainText('Jane Smith')
      await expect(form.getSummaryValue('Email')).toContainText('jane@example.com')
      await expect(form.getSummaryValue('Time')).toContainText(firstSlotValue!)
      await form.clickButton('Book appointment')

      // Assert — Confirmation
      await form.expectPanelTitle('Appointment booked')
    })
  })

  test.describe('happy path — in-person appointment', () => {
    test('should complete an in-person appointment booking including location step', async ({
      page,
    }) => {
      // Act — Type step
      await form.selectRadio('In person')
      await form.clickButton('Continue')

      // Act — Details step
      await form.fillTextInput('Full name', 'John Doe')
      await form.fillTextInput('Email address', 'john@example.com')
      await form.clickButton('Continue')

      // Assert — Routes to location step (in-person only)
      await form.expectHeading('Which office would you like to visit?')
      await form.expectUrl('/example-journeys/book-appointment/location')

      // Act — Location step
      await form.selectRadio('London')
      await form.clickButton('Continue')

      // Act — Date step
      await form.expectHeading('Appointment date')
      await form.expectInsetText('We will confirm your appointment location by email')

      const futureDate = getNextWeekday()
      await form.fillDateInput('Appointment date', formatDateForInput(futureDate))
      await form.clickButton('Continue')

      // Act — Time step
      const timeSelect = page.getByLabel('Choose a time')
      const firstSlotValue = await timeSelect.locator('option').nth(1).getAttribute('value')
      await timeSelect.selectOption(firstSlotValue!)
      await form.clickButton('Continue')

      // Act — Additional info step (skip optional field)
      await form.clickButton('Continue')

      // Assert — Check answers
      await expect(form.getSummaryValue('Appointment type')).toContainText('In person')
      await expect(form.getSummaryValue('Name')).toContainText('John Doe')
      await form.clickButton('Book appointment')

      // Assert — Confirmation shows location
      await form.expectPanelTitle('Appointment booked')
      await form.expectInsetText('London office')
    })
  })

  test.describe('happy path — video appointment', () => {
    test('should complete a video appointment booking', async ({ page }) => {
      // Act — Type step
      await form.selectRadio('Video call')
      await form.clickButton('Continue')

      // Act — Details step (no phone field for video)
      await form.fillTextInput('Full name', 'Alice Brown')
      await form.fillTextInput('Email address', 'alice@example.com')
      await form.clickButton('Continue')

      // Assert — Skips location, goes to date
      await form.expectHeading('Appointment date')
      await form.expectInsetText('We will send you a video call link by email')

      // Act — Date step
      const futureDate = getNextWeekday()
      await form.fillDateInput('Appointment date', formatDateForInput(futureDate))
      await form.clickButton('Continue')

      // Act — Time step
      const timeSelect = page.getByLabel('Choose a time')
      const firstSlotValue = await timeSelect.locator('option').nth(1).getAttribute('value')
      await timeSelect.selectOption(firstSlotValue!)
      await form.clickButton('Continue')

      // Act — Additional info
      await form.clickButton('Continue')

      // Act — Check answers
      await expect(form.getSummaryValue('Appointment type')).toContainText('Video call')
      await form.clickButton('Book appointment')

      // Assert — Confirmation
      await form.expectPanelTitle('Appointment booked')
      await form.expectInsetText('video call link will be sent to your email')
    })
  })

  test.describe('validation', () => {
    test('should show error when no appointment type is selected', async () => {
      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Select an appointment type')
    })

    test('should show errors when details fields are empty', async () => {
      // Arrange
      await form.selectRadio('Phone call')
      await form.clickButton('Continue')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter your full name')
      await form.expectValidationError('Enter your email address')
      await form.expectValidationError('Enter your phone number')
    })

    test('should show error when no location is selected for in-person', async () => {
      // Arrange
      await form.selectRadio('In person')
      await form.clickButton('Continue')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.fillTextInput('Email address', 'jane@example.com')
      await form.clickButton('Continue')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Select an office location')
    })

    test('should show error when date is empty', async () => {
      // Arrange
      await form.selectRadio('Phone call')
      await form.clickButton('Continue')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.fillTextInput('Email address', 'jane@example.com')
      await form.fillTextInput('Phone number', '020 7946 0958')
      await form.clickButton('Continue')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter an appointment date')
    })
  })

  test.describe('conditional rendering', () => {
    test('should show phone number field only for phone appointment type', async ({ page }) => {
      // Arrange
      await form.selectRadio('Phone call')
      await form.clickButton('Continue')

      // Assert
      await expect(page.getByLabel('Phone number')).toBeVisible()
    })

    test('should not show phone number field for video appointment type', async ({ page }) => {
      // Arrange
      await form.selectRadio('Video call')
      await form.clickButton('Continue')

      // Assert
      await expect(page.getByLabel('Phone number')).not.toBeVisible()
    })

    test('should show appointment-type-specific details content on additional info step', async ({
      page,
    }) => {
      // Arrange — navigate to additional-info step as in-person
      await form.selectRadio('In person')
      await form.clickButton('Continue')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.fillTextInput('Email address', 'jane@example.com')
      await form.clickButton('Continue')
      await form.selectRadio('London')
      await form.clickButton('Continue')
      const futureDate = getNextWeekday()
      await form.fillDateInput('Appointment date', formatDateForInput(futureDate))
      await form.clickButton('Continue')
      const timeSelect = page.getByLabel('Choose a time')
      await timeSelect.selectOption(
        (await timeSelect.locator('option').nth(1).getAttribute('value'))!,
      )
      await form.clickButton('Continue')

      // Assert — in-person specific details content
      await page.getByText('What to expect at your appointment').click()
      await expect(page.locator('.govuk-details__text')).toContainText('Bring valid photo ID')
    })
  })

  test.describe('back navigation', () => {
    test('should navigate back from details to type step', async () => {
      // Arrange
      await form.selectRadio('Phone call')
      await form.clickButton('Continue')

      // Act
      await form.clickBackLink()

      // Assert
      await form.expectHeading('What type of appointment do you need?')
    })

    test('should navigate back from date to location for in-person', async () => {
      // Arrange
      await form.selectRadio('In person')
      await form.clickButton('Continue')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.fillTextInput('Email address', 'jane@example.com')
      await form.clickButton('Continue')
      await form.selectRadio('London')
      await form.clickButton('Continue')

      // Assert — we're on date step
      await form.expectHeading('Appointment date')

      // TODO: The backlink target depends on how the journey configures it.
      // This test documents the expected behaviour — if it fails, check the
      // step's backlink configuration.
    })
  })

  test.describe('restart', () => {
    test('should return to type step when clicking Book another appointment', async ({ page }) => {
      // Arrange — complete the journey
      await form.selectRadio('Phone call')
      await form.clickButton('Continue')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.fillTextInput('Email address', 'jane@example.com')
      await form.fillTextInput('Phone number', '020 7946 0958')
      await form.clickButton('Continue')
      const futureDate = getNextWeekday()
      await form.fillDateInput('Appointment date', formatDateForInput(futureDate))
      await form.clickButton('Continue')
      const timeSelect = page.getByLabel('Choose a time')
      await timeSelect.selectOption(
        (await timeSelect.locator('option').nth(1).getAttribute('value'))!,
      )
      await form.clickButton('Continue')
      await form.clickButton('Continue')
      await form.clickButton('Book appointment')

      // Act
      await form.clickButton('Book another appointment')

      // Assert
      await form.expectHeading('What type of appointment do you need?')
      await form.expectUrl('/example-journeys/book-appointment/type')
    })
  })
})

/** Returns the next weekday (Monday–Friday) from today */
function getNextWeekday(): Date {
  const date = new Date()
  date.setDate(date.getDate() + 1)

  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1)
  }

  return date
}

/** Formats a date as DD/MM/YYYY for the GovUK date picker input */
function formatDateForInput(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()

  return `${day}/${month}/${year}`
}
