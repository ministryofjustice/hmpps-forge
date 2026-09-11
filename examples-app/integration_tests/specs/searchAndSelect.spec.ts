import { expect, test, type FrameLocator } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-guide-v2/patterns/search-and-select'

test.describe('Search and select journey', () => {
  let form: ForgeFormHelper
  let preview: FrameLocator

  test.beforeEach(async ({ page }) => {
    // Arrange
    preview = page.frameLocator('iframe[title="Journey preview"]')
    form = new ForgeFormHelper(page, preview)
    await page.goto(basePath)
    await form.clickButton('Start the pattern')
  })

  async function clickSearch() {
    await preview.getByRole('button', { name: 'Search', exact: true }).click()
  }

  test.describe('search page', () => {
    test('should show the search heading', async () => {
      await form.expectHeading('Search stations')
    })

    test('should show no results before searching', async () => {
      await expect(preview.getByRole('heading', { name: 'Results' })).not.toBeVisible()
      await expect(preview.locator('.govuk-inset-text')).not.toBeVisible()
    })

    test('should show matching stations when searching', async () => {
      // Act
      await form.fillTextInput('Station name', 'King')
      await clickSearch()

      // Assert
      await expect(preview.getByRole('heading', { name: 'Results' })).toBeVisible()
      await expect(preview.getByRole('heading', { name: "King's Cross St Pancras" })).toBeVisible()
      await expect(preview.getByRole('heading', { name: 'Kingsbury' })).toBeVisible()
    })

    test('should show a single result for a specific search', async () => {
      // Act
      await form.fillTextInput('Station name', 'Brixton')
      await clickSearch()

      // Assert
      await expect(preview.getByRole('heading', { name: 'Brixton' })).toBeVisible()
      await expect(preview.getByText('Lines: Victoria')).toBeVisible()
    })

    test('should show no results for an unknown station', async () => {
      // Act
      await form.fillTextInput('Station name', 'Hogwarts')
      await clickSearch()

      // Assert
      await expect(preview.getByRole('heading', { name: 'Results' })).toBeVisible()
      await expect(preview.locator('.govuk-inset-text')).toContainText('No matching stations found')
    })

    test('should preserve the search query after submitting', async () => {
      // Act
      await form.fillTextInput('Station name', 'Camden')
      await clickSearch()

      // Assert
      await expect(preview.getByLabel('Station name')).toHaveValue('Camden')
    })
  })

  test.describe('station detail page', () => {
    test('should show station details when selecting a result', async () => {
      // Arrange
      await form.fillTextInput('Station name', 'Baker')
      await clickSearch()

      // Act
      await preview.getByRole('link', { name: 'View station details' }).click()

      // Assert
      await form.expectHeading('Baker Street')
      await expect(form.getSummaryValue('Lines')).toContainText('Metropolitan')
      await expect(form.getSummaryValue('Zone')).toContainText('1')
      await expect(form.getSummaryValue('Opened')).toContainText('1863')
    })

    test('should navigate back to search from station detail', async () => {
      // Arrange
      await form.fillTextInput('Station name', 'Angel')
      await clickSearch()
      await preview.getByRole('link', { name: 'View station details' }).click()

      // Act
      await form.clickButton('Back to search')

      // Assert
      await form.expectHeading('Search stations')
    })

    test('should show different station details', async () => {
      // Arrange
      await form.fillTextInput('Station name', 'Piccadilly Circus')
      await clickSearch()
      await preview.getByRole('link', { name: 'View station details' }).click()

      // Assert
      await form.expectHeading('Piccadilly Circus')
      await expect(form.getSummaryValue('Lines')).toContainText('Bakerloo, Piccadilly')
      await expect(preview.getByText('Charles Holden')).toBeVisible()
    })
  })
})
