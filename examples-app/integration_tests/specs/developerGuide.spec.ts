import { expect, test } from '@playwright/test'

test.describe('Developer guide', () => {
  test.describe('document pages', () => {
    test('should show the page title in the browser tab when opening a guide page', async ({
      page,
    }) => {
      // Act
      await page.goto('/forge-developer-guide/get-started/creating-your-first-journey')

      // Assert
      await expect(page).toHaveTitle('Creating your first journey - Forge Developer Guide')
    })
  })
})
