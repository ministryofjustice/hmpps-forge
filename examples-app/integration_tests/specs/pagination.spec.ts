import { expect, test, type FrameLocator } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-guide-v2/patterns/pagination'

test.describe('Pagination journey', () => {
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

  test.describe('list page', () => {
    test('should show the first page of stations by default', async () => {
      // Act
      await form.expectHeading('Stations')

      // Assert
      await expect(preview.getByText('Page 1 of 4')).toBeVisible()
      await expect(preview.getByRole('link', { name: 'Baker Street' })).toBeVisible()
      await expect(preview.getByRole('link', { name: 'Brixton' })).toBeVisible()
    })

    test('should not show Previous link on the first page', async () => {
      // Act
      await form.expectHeading('Stations')

      // Assert
      await expect(preview.locator('.govuk-pagination__prev')).not.toBeVisible()
      await expect(preview.locator('.govuk-pagination__next')).toBeVisible()
    })

    test('should show the second page when navigating', async () => {
      // Act
      await preview.locator('.govuk-pagination__item a', { hasText: '2' }).click()

      // Assert
      await expect(preview.getByText('Page 2 of 4')).toBeVisible()
      await expect(preview.getByRole('link', { name: 'Canary Wharf' })).toBeVisible()
      await expect(preview.getByRole('link', { name: 'Waterloo' })).toBeVisible()
    })

    test('should show both Previous and Next on middle pages', async () => {
      // Act
      await preview.locator('.govuk-pagination__item a', { hasText: '2' }).click()

      // Assert
      await expect(preview.locator('.govuk-pagination__prev')).toBeVisible()
      await expect(preview.locator('.govuk-pagination__next')).toBeVisible()
    })

    test('should not show Next link on the last page', async () => {
      // Act
      await preview.locator('.govuk-pagination__item a', { hasText: '4' }).click()

      // Assert
      await expect(preview.getByText('Page 4 of 4')).toBeVisible()
      await expect(preview.locator('.govuk-pagination__prev')).toBeVisible()
      await expect(preview.locator('.govuk-pagination__next')).not.toBeVisible()
    })

    test('should show numbered page links with current page highlighted', async () => {
      // Act
      await preview.locator('.govuk-pagination__item a', { hasText: '2' }).click()

      // Assert
      const paginationItems = preview.locator('.govuk-pagination__item')

      await expect(paginationItems).toHaveCount(4)
      await expect(preview.locator('.govuk-pagination__item--current')).toContainText('2')
    })

    test('should navigate to a specific page via numbered link', async () => {
      // Arrange
      await form.expectHeading('Stations')

      // Act
      await preview.locator('.govuk-pagination__item a', { hasText: '3' }).click()

      // Assert
      await expect(preview.getByText('Page 3 of 4')).toBeVisible()
    })

    test('should navigate to the next page via the Next link', async () => {
      // Arrange
      await form.expectHeading('Stations')

      // Act
      await preview.locator('.govuk-pagination__next a').click()

      // Assert
      await expect(preview.getByText('Page 2 of 4')).toBeVisible()
    })

    test('should navigate back via the Previous link', async () => {
      // Arrange
      await preview.locator('.govuk-pagination__item a', { hasText: '2' }).click()

      // Act
      await preview.locator('.govuk-pagination__prev a').click()

      // Assert
      await expect(preview.getByText('Page 1 of 4')).toBeVisible()
    })
  })

  test.describe('station detail page', () => {
    test('should show station details when clicking a station', async () => {
      // Arrange
      await form.expectHeading('Stations')

      // Act
      await preview.getByRole('link', { name: 'Baker Street' }).click()

      // Assert
      await form.expectHeading('Baker Street')
      await expect(form.getSummaryValue('Lines')).toContainText('Metropolitan')
      await expect(form.getSummaryValue('Zone')).toContainText('1')
    })

    test('should navigate back to the list from detail', async () => {
      // Arrange
      await preview.getByRole('link', { name: 'Baker Street' }).click()

      // Act
      await form.clickButton('Back to list')

      // Assert
      await form.expectHeading('Stations')
    })

    test('should return to the correct page when navigating back', async () => {
      // Arrange — Kennington is station index 15, which is on page 4
      await preview.locator('.govuk-pagination__item a', { hasText: '4' }).click()
      await preview.getByRole('link', { name: 'Kennington' }).click()
      await expect(preview.getByRole('button', { name: 'Back to list' })).toHaveAttribute(
        'href',
        '/pagination/list?page=4',
      )

      // Act
      await form.clickButton('Back to list')

      // Assert
      await expect(preview.getByText('Page 4 of 4')).toBeVisible()
    })
  })
})
