import { expect, test, type FrameLocator } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-guide-v2/patterns/repeating-fieldsets'

test.describe('Repeating fieldsets journey', () => {
  let form: ForgeFormHelper
  let preview: FrameLocator

  test.beforeEach(async ({ page }) => {
    // Arrange
    preview = page.frameLocator('iframe[title="Journey preview"]')
    form = new ForgeFormHelper(page, preview)
    await page.goto(basePath)
    await form.clickButton('Start the pattern')
  })

  test.describe('happy path', () => {
    test('should complete the journey with one household member', async () => {
      // Arrange
      await form.expectHeading('Household members')
      await form.clickButton('Add another person')

      // Act — fill in member details
      await form.fillTextInput('Name', 'Jane Smith')
      await form.fillTextInput('Age', '30')
      await form.clickButton('Continue')

      // Assert — Check answers with summary card
      await form.expectHeading('Check your answers')
      await expect(form.getSummaryCard('Jane Smith')).toBeVisible()
      await expect(form.getSummaryCardValue('Jane Smith', 'Age')).toContainText('30')
      await form.clickButton('Confirm')

      // Assert — Confirmation
      await form.expectPanelTitle('Household saved')
    })

    test('should complete the journey with multiple household members', async () => {
      // Arrange — add and fill first member
      await form.clickButton('Add another person')
      await form.fillTextInput('Name', 'Jane Smith')
      await form.fillTextInput('Age', '30')

      // Add and fill second member
      await form.clickButton('Add another person')
      await preview.getByLabel('Name').nth(1).fill('John Doe')
      await preview.getByLabel('Age').nth(1).fill('25')
      await form.clickButton('Continue')

      // Assert — Check answers with two summary cards
      await form.expectHeading('Check your answers')
      await form.expectSummaryCardCount(2)
      await expect(form.getSummaryCardValue('Jane Smith', 'Age')).toContainText('30')
      await expect(form.getSummaryCardValue('John Doe', 'Age')).toContainText('25')
      await form.clickButton('Confirm')

      // Assert — Confirmation
      await form.expectPanelTitle('Household saved')
    })
  })

  test.describe('add and remove members', () => {
    test('should show empty state message when no members are added', async () => {
      // Assert
      await form.expectInsetText('You have not added any household members yet.')
    })

    test('should show name and age fields after adding a person', async () => {
      // Act
      await form.clickButton('Add another person')

      // Assert
      await expect(preview.getByLabel('Name')).toBeVisible()
      await expect(preview.getByLabel('Age')).toBeVisible()
    })

    test('should add multiple sets of fields', async () => {
      // Act
      await form.clickButton('Add another person')
      await form.clickButton('Add another person')

      // Assert
      await expect(preview.getByLabel('Name')).toHaveCount(2)
      await expect(preview.getByLabel('Age')).toHaveCount(2)
    })

    test('should remove a member when clicking Remove', async () => {
      // Arrange — add two members
      await form.clickButton('Add another person')
      await form.fillTextInput('Name', 'Jane Smith')
      await form.fillTextInput('Age', '30')
      await form.clickButton('Add another person')
      await preview.getByLabel('Name').nth(1).fill('John Doe')
      await preview.getByLabel('Age').nth(1).fill('25')

      // Act — remove first member
      await preview.getByRole('button', { name: 'Remove' }).first().click()

      // Assert — only second member remains
      await expect(preview.getByLabel('Name')).toHaveCount(1)
      await expect(preview.getByLabel('Name')).toHaveValue('John Doe')
      await expect(preview.getByLabel('Age')).toHaveValue('25')
    })

    test('should show empty state after removing all members', async () => {
      // Arrange
      await form.clickButton('Add another person')

      // Act
      await form.clickButton('Remove')

      // Assert
      await form.expectInsetText('You have not added any household members yet.')
    })
  })

  test.describe('validation', () => {
    test('should show error when continuing with no members', async () => {
      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectStepError('Add at least one household member')
      await form.expectHeading('Household members')
    })

    test('should show error when name is empty', async () => {
      // Arrange
      await form.clickButton('Add another person')
      await form.fillTextInput('Age', '30')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter a name')
    })

    test('should show error when age is empty', async () => {
      // Arrange
      await form.clickButton('Add another person')
      await form.fillTextInput('Name', 'Jane Smith')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter an age')
    })

    test('should show error when age is not a number', async () => {
      // Arrange
      await form.clickButton('Add another person')
      await form.fillTextInput('Name', 'Jane Smith')
      await form.fillTextInput('Age', 'abc')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter a number')
    })
  })

  test.describe('check answers', () => {
    test.beforeEach(async () => {
      await form.clickButton('Add another person')
      await form.fillTextInput('Name', 'Jane Smith')
      await form.fillTextInput('Age', '30')
      await form.clickButton('Continue')
    })

    test('should navigate back when clicking Change household members', async () => {
      // Act
      await form.clickButton('Change household members')

      // Assert
      await form.expectHeading('Household members')
    })

    test('should preserve members after navigating back and returning', async () => {
      // Act — go back and continue without changes
      await form.clickButton('Change household members')
      await form.clickButton('Continue')

      // Assert — check answers still shows the member
      await form.expectHeading('Check your answers')
      await expect(form.getSummaryCard('Jane Smith')).toBeVisible()
    })
  })

  test.describe('restart', () => {
    test('should return to overview when clicking Restart pattern', async () => {
      // Arrange — complete the journey
      await form.clickButton('Add another person')
      await form.fillTextInput('Name', 'Jane Smith')
      await form.fillTextInput('Age', '30')
      await form.clickButton('Continue')
      await form.clickButton('Confirm')

      // Act
      await form.clickButton('Restart pattern')

      // Assert
      await form.expectHeading('Repeating fieldsets')
    })
  })
})
