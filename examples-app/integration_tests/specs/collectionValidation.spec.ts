import { expect, test } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-developer-guide/patterns/demos/collection-validation'

test.describe('Collection validation journey', () => {
  let form: ForgeFormHelper

  test.beforeEach(async ({ page }) => {
    form = new ForgeFormHelper(page)
  })

  test.describe('validation', () => {
    test('should show required error when no option is selected', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/agree-plan`)

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Select whether you agree this plan')
    })

    test('should show per-goal errors when agreeing without actions on all goals', async ({
      page,
    }) => {
      // Arrange
      await page.goto(`${basePath}/agree-plan`)

      // Act
      await form.selectRadio('Yes, I agree this plan')
      await form.clickButton('Continue')

      // Assert — at least the first failing goal's error appears
      await form.expectValidationError("Add actions to 'Find stable housing'")
    })
  })

  test.describe('editing goal actions', () => {
    test('should persist edited actions across page visits', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/manage-plan`)
      await form.expectHeading('Add actions to goals')

      // Act — fill in actions for the two empty goals
      await page.getByLabel('Action').nth(1).fill('Contact housing officer')
      await page.getByLabel('Action').nth(2).fill('Register for training course')
      await form.clickButton('Save and continue')

      // Assert — navigate back to manage-plan and check values persisted
      await page.goto(`${basePath}/manage-plan`)
      await expect(page.getByLabel('Action').nth(1)).toHaveValue('Contact housing officer')
      await expect(page.getByLabel('Action').nth(2)).toHaveValue('Register for training course')
    })
  })

  test.describe('happy path', () => {
    test('should reach confirmation after adding actions and agreeing the plan', async ({
      page,
    }) => {
      // Arrange — add actions to the goals that need them
      await page.goto(`${basePath}/manage-plan`)
      await page.getByLabel('Action').nth(1).fill('Contact housing officer')
      await page.getByLabel('Action').nth(2).fill('Register for training course')
      await form.clickButton('Save and continue')

      // Act — agree the plan
      await form.expectHeading('Agree sentence plan')
      await form.selectRadio('Yes, I agree this plan')
      await form.clickButton('Continue')

      // Assert — confirmation page
      await form.expectPanelTitle('Plan agreed')
    })
  })
})
