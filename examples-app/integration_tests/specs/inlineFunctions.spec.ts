import { expect, test } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-developer-guide/patterns/demos/inline-functions'

test.describe('Inline functions journey', () => {
  let form: ForgeFormHelper

  test.beforeEach(async ({ page }) => {
    form = new ForgeFormHelper(page)
  })

  test.describe('before page (verbose expressions)', () => {
    test('should show the case heading with name and CRN', async ({ page }) => {
      // Act
      await page.goto(`${basePath}/before`)

      // Assert
      await form.expectHeading('Sam Jones')
      await expect(page.getByText('CRN: X123456')).toBeVisible()
    })

    test('should show all 6 risk scores with tags', async ({ page }) => {
      // Act
      await page.goto(`${basePath}/before`)

      // Assert
      await expect(form.getSummaryValue('Overall')).toContainText('High')
      await expect(form.getSummaryValue('Self-harm')).toContainText('Low')
      await expect(form.getSummaryValue('Public protection')).toContainText('Very high')
      await expect(form.getSummaryValue('Known adult')).toContainText('Medium')
    })

    test('should show sentence details', async ({ page }) => {
      // Act
      await page.goto(`${basePath}/before`)

      // Assert
      await expect(form.getSummaryValue('Type')).toContainText('Community Order')
      await expect(form.getSummaryValue('Start date')).toContainText('15 January 2025')
    })

    test('should show goals and compliance summaries', async ({ page }) => {
      // Act
      await page.goto(`${basePath}/before`)

      // Assert
      await expect(page.getByText('1 of 5 goals achieved')).toBeVisible()
      await expect(page.getByText('89% attendance rate')).toBeVisible()
    })

    test('should navigate to the refactored version', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/before`)

      // Act
      await form.clickButton('See the refactored version')

      // Assert
      await form.expectHeading('Sam Jones')
    })
  })

  test.describe('after page (inline functions)', () => {
    test('should show the same case heading', async ({ page }) => {
      // Act
      await page.goto(`${basePath}/after`)

      // Assert
      await form.expectHeading('Sam Jones')
      await expect(page.getByText('CRN: X123456')).toBeVisible()
    })

    test('should show the same risk scores', async ({ page }) => {
      // Act
      await page.goto(`${basePath}/after`)

      // Assert
      await expect(form.getSummaryValue('Overall')).toContainText('High')
      await expect(form.getSummaryValue('Self-harm')).toContainText('Low')
      await expect(form.getSummaryValue('Public protection')).toContainText('Very high')
      await expect(form.getSummaryValue('Known adult')).toContainText('Medium')
    })

    test('should show the same goals and compliance summaries', async ({ page }) => {
      // Act
      await page.goto(`${basePath}/after`)

      // Assert
      await expect(page.getByText('1 of 5 goals achieved')).toBeVisible()
      await expect(page.getByText('89% attendance rate')).toBeVisible()
    })

    test('should navigate back to the verbose version', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/after`)

      // Act
      await form.clickButton('Back to the verbose version')

      // Assert
      await form.expectHeading('Sam Jones')
      await expect(page.getByText('CRN: X123456')).toBeVisible()
    })
  })
})
