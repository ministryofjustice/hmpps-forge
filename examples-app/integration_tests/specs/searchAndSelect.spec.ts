import { expect, test } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-developer-guide/patterns/demos/search-and-select'

test.describe('Search and select journey', () => {
  let form: ForgeFormHelper

  test.beforeEach(async ({ page }) => {
    form = new ForgeFormHelper(page)
    await page.goto(`${basePath}/search`)
  })

  async function clickSearch(page: import('@playwright/test').Page) {
    await page.getByRole('button', { name: 'Search', exact: true }).click()
  }

  test.describe('search page', () => {
    test('should show the search heading', async () => {
      await form.expectHeading('Search stations')
    })

    test('should show no results before searching', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Results' })).not.toBeVisible()
      await expect(page.locator('.govuk-inset-text')).not.toBeVisible()
    })

    test('should show matching stations when searching', async ({ page }) => {
      // Act
      await form.fillTextInput('Station name', 'King')
      await clickSearch(page)

      // Assert
      await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible()
      await expect(page.getByRole('heading', { name: "King's Cross St Pancras" })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Kingsbury' })).toBeVisible()
    })

    test('should show a single result for a specific search', async ({ page }) => {
      // Act
      await form.fillTextInput('Station name', 'Brixton')
      await clickSearch(page)

      // Assert
      await expect(page.getByRole('heading', { name: 'Brixton' })).toBeVisible()
      await expect(page.getByText('Lines: Victoria')).toBeVisible()
    })

    test('should show no results for an unknown station', async ({ page }) => {
      // Act
      await form.fillTextInput('Station name', 'Hogwarts')
      await clickSearch(page)

      // Assert
      await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible()
      await expect(page.locator('.govuk-inset-text')).toContainText('No matching stations found')
    })

    test('should preserve the search query after submitting', async ({ page }) => {
      // Act
      await form.fillTextInput('Station name', 'Camden')
      await clickSearch(page)

      // Assert
      await expect(page.getByLabel('Station name')).toHaveValue('Camden')
    })
  })

  test.describe('station detail page', () => {
    test('should show station details when selecting a result', async ({ page }) => {
      // Arrange
      await form.fillTextInput('Station name', 'Baker')
      await clickSearch(page)

      // Act
      await page.getByRole('link', { name: 'View station details' }).click()

      // Assert
      await form.expectHeading('Baker Street')
      await expect(form.getSummaryValue('Lines')).toContainText('Metropolitan')
      await expect(form.getSummaryValue('Zone')).toContainText('1')
      await expect(form.getSummaryValue('Opened')).toContainText('1863')
    })

    test('should navigate back to search from station detail', async ({ page }) => {
      // Arrange
      await form.fillTextInput('Station name', 'Angel')
      await clickSearch(page)
      await page.getByRole('link', { name: 'View station details' }).click()

      // Act
      await form.clickButton('Back to search')

      // Assert
      await form.expectHeading('Search stations')
    })

    test('should show different station details', async ({ page }) => {
      // Arrange
      await form.fillTextInput('Station name', 'Piccadilly Circus')
      await clickSearch(page)
      await page.getByRole('link', { name: 'View station details' }).click()

      // Assert
      await form.expectHeading('Piccadilly Circus')
      await expect(form.getSummaryValue('Lines')).toContainText('Bakerloo, Piccadilly')
      await expect(page.getByText('Charles Holden')).toBeVisible()
    })
  })
})
