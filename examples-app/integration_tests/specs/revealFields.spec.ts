import { expect, test, type FrameLocator } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-guide-v2/patterns/reveal-fields'

test.describe('Reveal fields journey', () => {
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

  test.describe('happy path', () => {
    test('should complete the journey with search engine (no follow-up)', async () => {
      // Act
      await form.expectHeading('How did you hear about us?')
      await form.selectRadio('Search engine')
      await form.clickButton('Continue')

      // Assert — check answers
      await form.expectHeading('Check your answers')
      await expect(form.getSummaryValue('How you heard about us')).toContainText('Search engine')
      await form.clickButton('Confirm')
      await form.expectPanelTitle('Thanks for letting us know')
    })

    test('should complete the journey with social media follow-up', async () => {
      // Act
      await form.selectRadio('Social media')
      await form.fillTextInput('Which platform?', 'Twitter')
      await form.clickButton('Continue')

      // Assert
      await expect(form.getSummaryValue('How you heard about us')).toContainText('Social media')
      await expect(form.getSummaryValue('Platform')).toContainText('Twitter')
      await form.clickButton('Confirm')
      await form.expectPanelTitle('Thanks for letting us know')
    })

    test('should complete the journey with other follow-up', async () => {
      // Act
      await form.selectRadio('Other')
      await form.fillTextInput('Please specify', 'Conference talk')
      await form.clickButton('Continue')

      // Assert
      await expect(form.getSummaryValue('How you heard about us')).toContainText('Other')
      await expect(form.getSummaryValue('Details')).toContainText('Conference talk')
      await form.clickButton('Confirm')
      await form.expectPanelTitle('Thanks for letting us know')
    })

    test('should complete the journey with friend or colleague (no follow-up)', async () => {
      // Act
      await form.selectRadio('Friend or colleague')
      await form.clickButton('Continue')

      // Assert
      await expect(form.getSummaryValue('How you heard about us')).toContainText(
        'Friend or colleague',
      )
      await form.clickButton('Confirm')
      await form.expectPanelTitle('Thanks for letting us know')
    })
  })

  test.describe('conditional fields', () => {
    test('should show platform input when Social media is selected', async () => {
      // Act
      await form.selectRadio('Social media')

      // Assert
      await expect(preview.getByLabel('Which platform?')).toBeVisible()
    })

    test('should show specify input when Other is selected', async () => {
      // Act
      await form.selectRadio('Other')

      // Assert
      await expect(preview.getByLabel('Please specify')).toBeVisible()
    })

    test('should not show follow-up inputs for Search engine', async () => {
      // Act
      await form.selectRadio('Search engine')

      // Assert
      await expect(preview.getByLabel('Which platform?')).not.toBeVisible()
      await expect(preview.getByLabel('Please specify')).not.toBeVisible()
    })
  })

  test.describe('conditional summary rows', () => {
    test('should show Platform row only for social media', async () => {
      // Arrange
      await form.selectRadio('Social media')
      await form.fillTextInput('Which platform?', 'Instagram')
      await form.clickButton('Continue')

      // Assert
      await expect(form.getSummaryValue('Platform')).toBeVisible()
      await expect(
        preview.locator('.govuk-summary-list__row', { hasText: 'Details' }),
      ).not.toBeVisible()
    })

    test('should show Details row only for other', async () => {
      // Arrange
      await form.selectRadio('Other')
      await form.fillTextInput('Please specify', 'Newspaper')
      await form.clickButton('Continue')

      // Assert
      await expect(form.getSummaryValue('Details')).toBeVisible()
      await expect(
        preview.locator('.govuk-summary-list__row', { hasText: 'Platform' }),
      ).not.toBeVisible()
    })

    test('should show neither follow-up row for search engine', async () => {
      // Arrange
      await form.selectRadio('Search engine')
      await form.clickButton('Continue')

      // Assert
      await form.expectHeading('Check your answers')
      await expect(
        preview.locator('.govuk-summary-list__row', { hasText: 'Platform' }),
      ).not.toBeVisible()
      await expect(
        preview.locator('.govuk-summary-list__row', { hasText: 'Details' }),
      ).not.toBeVisible()
    })
  })

  test.describe('validation', () => {
    test('should show error when no option is selected', async () => {
      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Select how you heard about us')
    })

    test('should show error when social media platform is empty', async () => {
      // Act
      await form.selectRadio('Social media')
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter the platform where you saw us')
    })

    test('should show error when other source is empty', async () => {
      // Act
      await form.selectRadio('Other')
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter where you heard about us')
    })

    test('should not validate hidden follow-up when different option selected', async () => {
      // Act — select an option without a follow-up
      await form.selectRadio('Friend or colleague')
      await form.clickButton('Continue')

      // Assert — no validation error, proceeds to check answers
      await form.expectHeading('Check your answers')
    })
  })

  test.describe('restart', () => {
    test('should return to overview when clicking Restart pattern', async () => {
      // Arrange
      await form.selectRadio('Search engine')
      await form.clickButton('Continue')
      await form.clickButton('Confirm')

      // Act
      await form.clickButton('Restart pattern')

      // Assert
      await form.expectHeading('Reveal fields')
    })
  })
})
