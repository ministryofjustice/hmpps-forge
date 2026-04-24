import { expect, test } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-developer-guide/patterns/demos/resuming'

test.describe('Resuming journey', () => {
  let form: ForgeFormHelper

  test.beforeEach(async ({ page }) => {
    form = new ForgeFormHelper(page)
    await page.goto(`${basePath}/overview`)
  })

  test.describe('happy path', () => {
    test('should complete the full journey from the start button', async () => {
      // Act — start and fill name
      await form.clickButton('Start the pattern')
      await form.expectHeading('What is your name?')
      await form.fillTextInput('What is your name?', 'Jane Smith')
      await form.clickButton('Continue')

      // Act — fill role
      await form.expectHeading('What is your role?')
      await form.fillTextInput('What is your role?', 'Developer')
      await form.clickButton('Continue')

      // Assert — check answers
      await form.expectHeading('Check your answers')
      await expect(form.getSummaryValue('Name')).toContainText('Jane Smith')
      await expect(form.getSummaryValue('Role')).toContainText('Developer')
      await form.clickButton('Confirm')

      // Assert — confirmation
      await form.expectPanelTitle('Answers submitted')
    })
  })

  test.describe('overview state', () => {
    test('should show start button when no saved progress exists', async ({ page }) => {
      // Assert
      await expect(page.getByRole('button', { name: 'Start the pattern' })).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Continue where you left off' }),
      ).not.toBeVisible()
    })

    test('should show continue button after seeding partial progress', async ({ page }) => {
      // Act
      await form.clickButton('Seed partial progress')

      // Assert
      await expect(page.getByRole('button', { name: 'Continue where you left off' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Start the pattern' })).not.toBeVisible()
      await form.expectInsetText('You have saved answers from a previous visit')
    })

    test('should show start button after clearing saved answers', async ({ page }) => {
      // Arrange
      await form.clickButton('Seed partial progress')
      await expect(page.getByRole('button', { name: 'Continue where you left off' })).toBeVisible()

      // Act
      await form.clickButton('Clear saved answers')

      // Assert
      await expect(page.getByRole('button', { name: 'Start the pattern' })).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Continue where you left off' }),
      ).not.toBeVisible()
    })
  })

  test.describe('resume flow', () => {
    test('should resume to role step when only name is saved', async () => {
      // Arrange
      await form.clickButton('Seed partial progress')

      // Act
      await form.clickButton('Continue where you left off')

      // Assert — lands on role step (name already filled)
      await form.expectHeading('What is your role?')
      await form.expectUrl(`${basePath}/your-role`)
    })

    test('should resume to check answers when all fields are saved', async () => {
      // Arrange
      await form.clickButton('Seed complete progress')

      // Act
      await form.clickButton('Continue where you left off')

      // Assert — lands on check answers
      await form.expectHeading('Check your answers')
      await expect(form.getSummaryValue('Name')).toContainText('Ada Lovelace')
      await expect(form.getSummaryValue('Role')).toContainText('Developer')
    })

    test('should resume after partially completing and navigating away', async ({ page }) => {
      // Arrange — fill name only then go back to overview
      await form.clickButton('Start the pattern')
      await form.fillTextInput('What is your name?', 'Jane Smith')
      await form.clickButton('Continue')
      await page.goto(`${basePath}/overview`)

      // Act
      await form.clickButton('Continue where you left off')

      // Assert — resumes at role step
      await form.expectHeading('What is your role?')
      await form.expectUrl(`${basePath}/your-role`)
    })
  })

  test.describe('validation', () => {
    test('should show error when name is empty', async () => {
      // Arrange
      await form.clickButton('Start the pattern')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter your name')
    })

    test('should show error when role is empty', async () => {
      // Arrange
      await form.clickButton('Seed partial progress')
      await form.clickButton('Continue where you left off')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter your role')
    })
  })

  test.describe('check answers', () => {
    test.beforeEach(async () => {
      await form.clickButton('Seed complete progress')
      await form.clickButton('Continue where you left off')
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
  })

  test.describe('restart', () => {
    test('should return to overview when clicking Restart pattern', async ({ page }) => {
      // Arrange — complete the journey
      await form.clickButton('Seed complete progress')
      await form.clickButton('Continue where you left off')
      await form.clickButton('Confirm')

      // Act
      await form.clickButton('Restart pattern')

      // Assert
      await form.expectHeading('Resuming a partially-completed journey')
      await form.expectUrl(`${basePath}/overview`)
      await expect(page.getByRole('button', { name: 'Start the pattern' })).toBeVisible()
    })
  })
})
