import { expect, test, type FrameLocator } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-guide-v2/patterns/collection-validation'

test.describe('Collection validation journey', () => {
  let form: ForgeFormHelper
  let preview: FrameLocator

  test.beforeEach(async ({ page }) => {
    // Arrange
    preview = page.frameLocator('iframe[title="Journey preview"]')
    form = new ForgeFormHelper(page, preview)
    await page.goto(basePath)
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await form.clickButton('Start the pattern')
  })

  test.describe('validation', () => {
    test('should show required error when no option is selected', async () => {
      // Arrange
      await form.expectHeading('Agree sentence plan')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Select whether you agree this plan')
    })

    test('should show per-goal errors when agreeing without actions on all goals', async () => {
      // Arrange
      await form.expectHeading('Agree sentence plan')

      // Act
      await form.selectRadio('Yes, I agree this plan')
      await form.clickButton('Continue')

      // Assert — at least the first failing goal's error appears
      await form.expectValidationError("Add actions to 'Find stable housing'")
    })
  })

  test.describe('editing goal actions', () => {
    test('should persist edited actions across page visits', async () => {
      // Arrange
      await form.clickButton('Add actions to goals')
      await form.expectHeading('Add actions to goals')

      // Act — fill in actions for the two empty goals
      await preview.getByLabel('Action').nth(1).fill('Contact housing officer')
      await preview.getByLabel('Action').nth(2).fill('Register for training course')
      await form.clickButton('Save and continue')

      // Assert — navigate back to manage-plan and check values persisted
      await form.clickButton('Add actions to goals')
      await expect(preview.getByLabel('Action').nth(1)).toHaveValue('Contact housing officer')
      await expect(preview.getByLabel('Action').nth(2)).toHaveValue('Register for training course')
    })
  })

  test.describe('happy path', () => {
    test('should reach confirmation after adding actions and agreeing the plan', async () => {
      // Arrange — add actions to the goals that need them
      await form.clickButton('Add actions to goals')
      await preview.getByLabel('Action').nth(1).fill('Contact housing officer')
      await preview.getByLabel('Action').nth(2).fill('Register for training course')
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
