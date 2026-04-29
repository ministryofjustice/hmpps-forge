import { expect, test } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-developer-guide/patterns/demos/pagination'

test.describe('Pagination journey', () => {
  let form: ForgeFormHelper

  test.beforeEach(async ({ page }) => {
    form = new ForgeFormHelper(page)
  })

  test.describe('list page', () => {
    test('should show the first page of stations by default', async ({ page }) => {
      // Act
      await page.goto(`${basePath}/list`)

      // Assert
      await form.expectHeading('Stations')
      await expect(page.getByText('Page 1 of 4')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Baker Street' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Brixton' })).toBeVisible()
    })

    test('should not show Previous link on the first page', async ({ page }) => {
      // Act
      await page.goto(`${basePath}/list`)

      // Assert
      await expect(page.locator('.govuk-pagination__prev')).not.toBeVisible()
      await expect(page.locator('.govuk-pagination__next')).toBeVisible()
    })

    test('should show the second page when navigating', async ({ page }) => {
      // Act
      await page.goto(`${basePath}/list?page=2`)

      // Assert
      await expect(page.getByText('Page 2 of 4')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Canary Wharf' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Waterloo' })).toBeVisible()
    })

    test('should show both Previous and Next on middle pages', async ({ page }) => {
      // Act
      await page.goto(`${basePath}/list?page=2`)

      // Assert
      await expect(page.locator('.govuk-pagination__prev')).toBeVisible()
      await expect(page.locator('.govuk-pagination__next')).toBeVisible()
    })

    test('should not show Next link on the last page', async ({ page }) => {
      // Act
      await page.goto(`${basePath}/list?page=4`)

      // Assert
      await expect(page.getByText('Page 4 of 4')).toBeVisible()
      await expect(page.locator('.govuk-pagination__prev')).toBeVisible()
      await expect(page.locator('.govuk-pagination__next')).not.toBeVisible()
    })

    test('should show numbered page links with current page highlighted', async ({ page }) => {
      // Act
      await page.goto(`${basePath}/list?page=2`)

      // Assert
      const paginationItems = page.locator('.govuk-pagination__item')
      await expect(paginationItems).toHaveCount(4)
      await expect(page.locator('.govuk-pagination__item--current')).toContainText('2')
    })

    test('should navigate to a specific page via numbered link', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/list`)

      // Act
      await page.locator('.govuk-pagination__item a', { hasText: '3' }).click()

      // Assert
      await expect(page.getByText('Page 3 of 4')).toBeVisible()
    })

    test('should navigate to the next page via the Next link', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/list`)

      // Act
      await page.locator('.govuk-pagination__next a').click()

      // Assert
      await expect(page.getByText('Page 2 of 4')).toBeVisible()
    })

    test('should navigate back via the Previous link', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/list?page=2`)

      // Act
      await page.locator('.govuk-pagination__prev a').click()

      // Assert
      await expect(page.getByText('Page 1 of 4')).toBeVisible()
    })
  })

  test.describe('station detail page', () => {
    test('should show station details when clicking a station', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/list`)

      // Act
      await page.getByRole('link', { name: 'Baker Street' }).click()

      // Assert
      await form.expectHeading('Baker Street')
      await expect(form.getSummaryValue('Lines')).toContainText('Metropolitan')
      await expect(form.getSummaryValue('Zone')).toContainText('1')
    })

    test('should navigate back to the list from detail', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/detail/0`)

      // Act
      await form.clickButton('Back to list')

      // Assert
      await form.expectHeading('Stations')
    })

    test('should return to the correct page when navigating back', async ({ page }) => {
      // Arrange — Kennington is station index 15, which is on page 4
      await page.goto(`${basePath}/detail/15`)

      // Act
      await form.clickButton('Back to list')

      // Assert
      await expect(page.getByText('Page 4 of 4')).toBeVisible()
    })
  })
})
