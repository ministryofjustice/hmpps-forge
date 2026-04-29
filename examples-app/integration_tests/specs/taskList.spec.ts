import { expect, test } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-developer-guide/patterns/demos/task-list'

test.describe('Task list journey', () => {
  let form: ForgeFormHelper

  test.beforeEach(async ({ page }) => {
    form = new ForgeFormHelper(page)
    await page.goto(`${basePath}/tasks`)
  })

  test.describe('happy path', () => {
    test('should complete all tasks and submit the application', async () => {
      // Act — Your details: name
      await form.expectHeading('Book a prison visit')
      await form.clickLink('Your details')
      await form.expectHeading('What is your full name?')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.clickButton('Continue')

      // Act — Your details: relationship
      await form.expectHeading('What is your relationship to the prisoner?')
      await form.selectOption('Relationship', 'friend')
      await form.clickButton('Save and return')

      // Assert — back on task list
      await form.expectHeading('Book a prison visit')

      // Act — Visit preferences: preferred day
      await form.clickLink('Visit preferences')
      await form.expectHeading('Which day would you prefer to visit?')
      await form.selectRadio('Saturday')
      await form.clickButton('Continue')

      // Act — Visit preferences: visit type
      await form.expectHeading('What type of visit do you want?')
      await form.selectRadio('In person')
      await form.clickButton('Save and return')

      // Assert — back on task list
      await form.expectHeading('Book a prison visit')

      // Act — Additional needs (now unlocked)
      await form.clickLink('Additional needs')
      await form.expectHeading('Do you have any additional needs?')
      await form.fillTextarea('Additional needs', 'Wheelchair access required')
      await form.clickButton('Save and return')

      // Assert — back on task list
      await form.expectHeading('Book a prison visit')

      // Act — Check and submit (now unlocked)
      await form.clickLink('Check and submit')
      await form.expectHeading('Check your answers')

      // Assert — summary cards show correct data
      await expect(form.getSummaryCardValue('Your details', 'Full name')).toContainText(
        'Jane Smith',
      )
      await expect(form.getSummaryCardValue('Your details', 'Relationship')).toContainText('Friend')
      await expect(form.getSummaryCardValue('Visit preferences', 'Preferred day')).toContainText(
        'Saturday',
      )
      await expect(form.getSummaryCardValue('Visit preferences', 'Type of visit')).toContainText(
        'In person',
      )
      await expect(form.getSummaryCardValue('Additional needs', 'Requirements')).toContainText(
        'Wheelchair access required',
      )

      await form.clickButton('Submit application')

      // Assert — confirmation
      await form.expectPanelTitle('Application submitted')
    })
  })

  test.describe('task statuses', () => {
    test('should show all tasks as not yet started initially', async ({ page }) => {
      // Assert
      const yourDetails = page.locator('.govuk-task-list__item', { hasText: 'Your details' })
      await expect(yourDetails.locator('.govuk-tag')).toContainText('Not yet started')

      const visitPrefs = page.locator('.govuk-task-list__item', { hasText: 'Visit preferences' })
      await expect(visitPrefs.locator('.govuk-tag')).toContainText('Not yet started')
    })

    test('should show Additional needs as locked when prerequisites are incomplete', async ({
      page,
    }) => {
      // Assert
      const additionalNeeds = page.locator('.govuk-task-list__item', {
        hasText: 'Additional needs',
      })
      await expect(additionalNeeds.locator('.govuk-tag')).toContainText('Cannot start yet')
    })

    test('should show in progress after partially completing a section', async ({ page }) => {
      // Arrange — complete only the name step (first of two in Your details)
      await form.clickLink('Your details')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.clickButton('Continue')

      // Go back to hub without completing relationship
      await page.goto(`${basePath}/tasks`)

      // Assert
      const yourDetails = page.locator('.govuk-task-list__item', { hasText: 'Your details' })
      await expect(yourDetails.locator('.govuk-tag')).toContainText('In progress')
    })

    test('should show completed after finishing a section', async ({ page }) => {
      // Arrange — complete Your details fully
      await form.clickLink('Your details')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.clickButton('Continue')
      await form.selectOption('Relationship', 'friend')
      await form.clickButton('Save and return')

      // Assert
      const yourDetails = page.locator('.govuk-task-list__item', { hasText: 'Your details' })
      await expect(yourDetails.locator('.govuk-tag')).toContainText('Completed')
    })

    test('should unlock Additional needs after completing prerequisites', async ({ page }) => {
      // Arrange — complete Your details
      await form.clickLink('Your details')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.clickButton('Continue')
      await form.selectOption('Relationship', 'friend')
      await form.clickButton('Save and return')

      // Complete Visit preferences
      await form.clickLink('Visit preferences')
      await form.selectRadio('Monday')
      await form.clickButton('Continue')
      await form.selectRadio('Video call')
      await form.clickButton('Save and return')

      // Assert — Additional needs is now clickable
      const additionalNeeds = page.locator('.govuk-task-list__item', {
        hasText: 'Additional needs',
      })
      await expect(additionalNeeds.locator('.govuk-tag')).toContainText('Not yet started')
      await expect(additionalNeeds.getByRole('link', { name: 'Additional needs' })).toBeVisible()
    })
  })

  test.describe('validation', () => {
    test('should show error when name is empty', async () => {
      // Arrange
      await form.clickLink('Your details')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter your full name')
    })

    test('should show error when relationship is not selected', async () => {
      // Arrange
      await form.clickLink('Your details')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.clickButton('Continue')

      // Act
      await form.clickButton('Save and return')

      // Assert
      await form.expectValidationError('Select your relationship to the prisoner')
    })

    test('should show error when preferred day is not selected', async () => {
      // Arrange
      await form.clickLink('Visit preferences')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Select a preferred day')
    })

    test('should show error when additional needs is empty', async () => {
      // Arrange — complete prerequisites first
      await form.clickLink('Your details')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.clickButton('Continue')
      await form.selectOption('Relationship', 'friend')
      await form.clickButton('Save and return')
      await form.clickLink('Visit preferences')
      await form.selectRadio('Monday')
      await form.clickButton('Continue')
      await form.selectRadio('In person')
      await form.clickButton('Save and return')

      // Act
      await form.clickLink('Additional needs')
      await form.clickButton('Save and return')

      // Assert
      await form.expectValidationError('Enter your additional needs or "None"')
    })
  })

  test.describe('restart', () => {
    test('should return to overview when starting a new application', async () => {
      // Arrange — complete everything
      await form.clickLink('Your details')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.clickButton('Continue')
      await form.selectOption('Relationship', 'friend')
      await form.clickButton('Save and return')
      await form.clickLink('Visit preferences')
      await form.selectRadio('Monday')
      await form.clickButton('Continue')
      await form.selectRadio('In person')
      await form.clickButton('Save and return')
      await form.clickLink('Additional needs')
      await form.fillTextarea('Additional needs', 'None')
      await form.clickButton('Save and return')
      await form.clickLink('Check and submit')
      await form.clickButton('Submit application')

      // Act
      await form.clickButton('Start a new application')

      // Assert
      await form.expectHeading('Task list')
      await form.expectUrl(`${basePath}/overview`)
    })
  })
})
