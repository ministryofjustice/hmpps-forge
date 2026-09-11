import { expect, test, type FrameLocator } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

test.describe('Inline functions journey', () => {
  let preview: FrameLocator
  let form: ForgeFormHelper

  test.beforeEach(async ({ page }) => {
    preview = page.frameLocator('iframe[title="Journey preview"]')
    form = new ForgeFormHelper(page, preview)
    await page.goto('/forge-guide-v2/patterns/inline-functions')
  })

  test.describe('before page (verbose expressions)', () => {
    test('should show the case heading with name and CRN', async () => {
      // Arrange
      await form.expectHeading('Shaping data inline')

      // Act
      await form.clickButton('Start with the verbose version')

      // Assert
      await form.expectHeading('Sam Jones')
      await expect(preview.getByText('CRN: X123456')).toBeVisible()
    })

    test('should show all 6 risk scores with tags', async () => {
      // Arrange
      await form.expectHeading('Shaping data inline')

      // Act
      await form.clickButton('Start with the verbose version')

      // Assert
      await expect(form.getSummaryValue('Overall')).toContainText('High')
      await expect(form.getSummaryValue('Self-harm')).toContainText('Low')
      await expect(form.getSummaryValue('Public protection')).toContainText('Very high')
      await expect(form.getSummaryValue('Known adult')).toContainText('Medium')
    })

    test('should show sentence details', async () => {
      // Arrange
      await form.expectHeading('Shaping data inline')

      // Act
      await form.clickButton('Start with the verbose version')

      // Assert
      await expect(form.getSummaryValue('Type')).toContainText('Community Order')
      await expect(form.getSummaryValue('Start date')).toContainText('15 January 2025')
    })

    test('should show goals and compliance summaries', async () => {
      // Arrange
      await form.expectHeading('Shaping data inline')

      // Act
      await form.clickButton('Start with the verbose version')

      // Assert
      await expect(preview.getByText('1 of 5 goals achieved')).toBeVisible()
      await expect(preview.getByText('89% attendance rate')).toBeVisible()
    })

    test('should navigate to the refactored version', async () => {
      // Arrange
      await form.clickButton('Start with the verbose version')

      // Act
      await form.clickButton('See the refactored version')

      // Assert
      await form.expectHeading('Sam Jones')
    })
  })

  test.describe('after page (inline functions)', () => {
    test('should show the same case heading', async () => {
      // Arrange
      await form.clickButton('Start with the verbose version')

      // Act
      await form.clickButton('See the refactored version')

      // Assert
      await form.expectHeading('Sam Jones')
      await expect(preview.getByText('CRN: X123456')).toBeVisible()
    })

    test('should show the same risk scores', async () => {
      // Arrange
      await form.clickButton('Start with the verbose version')

      // Act
      await form.clickButton('See the refactored version')

      // Assert
      await expect(form.getSummaryValue('Overall')).toContainText('High')
      await expect(form.getSummaryValue('Self-harm')).toContainText('Low')
      await expect(form.getSummaryValue('Public protection')).toContainText('Very high')
      await expect(form.getSummaryValue('Known adult')).toContainText('Medium')
      await expect(preview.locator('.govuk-tag')).toHaveText([
        'High',
        'Low',
        'Very high',
        'Medium',
        'Low',
        'Low',
      ])
      await expect(preview.locator('.govuk-tag')).toHaveClass([
        /govuk-tag--red/,
        /govuk-tag--green/,
        /govuk-tag--red/,
        /govuk-tag--yellow/,
        /govuk-tag--green/,
        /govuk-tag--green/,
      ])
    })

    test('should show the same goals and compliance summaries', async () => {
      // Arrange
      await form.clickButton('Start with the verbose version')

      // Act
      await form.clickButton('See the refactored version')

      // Assert
      await expect(preview.getByText('1 of 5 goals achieved')).toBeVisible()
      await expect(preview.getByText('89% attendance rate')).toBeVisible()
    })

    test('should navigate back to the verbose version', async () => {
      // Arrange
      await form.clickButton('Start with the verbose version')
      await form.clickButton('See the refactored version')

      // Act
      await form.clickButton('Back to the verbose version')

      // Assert
      await form.expectHeading('Sam Jones')
      await expect(preview.getByText('CRN: X123456')).toBeVisible()
    })
  })
})
