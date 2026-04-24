import { expect, test } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-developer-guide/patterns/demos/single-question-per-page'

test.describe('Single question per page journey', () => {
  let form: ForgeFormHelper

  test.beforeEach(async ({ page }) => {
    form = new ForgeFormHelper(page)
    await page.goto(`${basePath}/your-name`)
  })

  test.describe('happy path', () => {
    test('should complete the full journey and see confirmation', async () => {
      // Act — Name step
      await form.expectHeading('What is your name?')
      await form.fillTextInput('What is your name?', 'Jane Smith')
      await form.clickButton('Continue')

      // Act — Role step
      await form.expectHeading('What is your role?')
      await form.fillTextInput('What is your role?', 'Developer')
      await form.clickButton('Continue')

      // Assert — Check answers
      await form.expectHeading('Check your answers')
      await expect(form.getSummaryValue('Name')).toContainText('Jane Smith')
      await expect(form.getSummaryValue('Role')).toContainText('Developer')
      await form.clickButton('Confirm')

      // Assert — Confirmation
      await form.expectPanelTitle('Answers saved')
    })
  })

  test.describe('validation', () => {
    test('should show error when name is empty', async () => {
      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter your name')
      await form.expectUrl(`${basePath}/your-name`)
    })

    test('should show error when name exceeds 100 characters', async () => {
      // Act
      await form.fillTextInput('What is your name?', 'A'.repeat(101))
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Name must be 100 characters or less')
    })

    test('should show error when role is empty', async () => {
      // Arrange
      await form.fillTextInput('What is your name?', 'Jane Smith')
      await form.clickButton('Continue')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter your role')
      await form.expectUrl(`${basePath}/your-role`)
    })

    test('should show error when role exceeds 100 characters', async () => {
      // Arrange
      await form.fillTextInput('What is your name?', 'Jane Smith')
      await form.clickButton('Continue')

      // Act
      await form.fillTextInput('What is your role?', 'B'.repeat(101))
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Role must be 100 characters or less')
    })
  })

  test.describe('check answers', () => {
    test.beforeEach(async () => {
      await form.fillTextInput('What is your name?', 'Jane Smith')
      await form.clickButton('Continue')
      await form.fillTextInput('What is your role?', 'Developer')
      await form.clickButton('Continue')
    })

    test('should display submitted answers in the summary list', async () => {
      // Assert
      await expect(form.getSummaryValue('Name')).toContainText('Jane Smith')
      await expect(form.getSummaryValue('Role')).toContainText('Developer')
    })

    test('should navigate to name step when clicking Change on name row', async () => {
      // Act
      await form.clickChangeLink('Name')

      // Assert
      await form.expectHeading('What is your name?')
      await form.expectUrl(`${basePath}/your-name`)
    })

    test('should navigate to role step when clicking Change on role row', async () => {
      // Act
      await form.clickChangeLink('Role')

      // Assert
      await form.expectHeading('What is your role?')
      await form.expectUrl(`${basePath}/your-role`)
    })

    test('should preserve updated name after change', async () => {
      // Act
      await form.clickChangeLink('Name')
      await form.fillTextInput('What is your name?', 'John Doe')
      await form.clickButton('Continue')

      // Journey continues through role step after name change
      await form.expectHeading('What is your role?')
      await form.clickButton('Continue')

      // Assert — check answers shows updated name, original role
      await form.expectHeading('Check your answers')
      await expect(form.getSummaryValue('Name')).toContainText('John Doe')
      await expect(form.getSummaryValue('Role')).toContainText('Developer')
    })
  })

  test.describe('restart', () => {
    test('should return to overview when clicking Restart pattern on confirmation', async () => {
      // Arrange — complete the journey
      await form.fillTextInput('What is your name?', 'Jane Smith')
      await form.clickButton('Continue')
      await form.fillTextInput('What is your role?', 'Designer')
      await form.clickButton('Continue')
      await form.clickButton('Confirm')

      // Act
      await form.clickButton('Restart pattern')

      // Assert
      await form.expectHeading('Single question per page')
      await form.expectUrl(`${basePath}/overview`)
    })
  })
})
