import { expect, test } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-developer-guide/patterns/demos/auth-role'

test.describe('Auth role journey', () => {
  let form: ForgeFormHelper

  test.beforeEach(async ({ page }) => {
    form = new ForgeFormHelper(page)
  })

  test.describe('authentication redirect', () => {
    test('should redirect to login when accessing dashboard without auth', async ({ page }) => {
      // Act
      await page.goto(`${basePath}/dashboard`)

      // Assert
      await form.expectUrl(`${basePath}/login`)
    })

    test('should redirect to login when accessing admin panel without auth', async ({ page }) => {
      // Act
      await page.goto(`${basePath}/admin-panel`)

      // Assert
      await form.expectUrl(`${basePath}/login`)
    })
  })

  test.describe('admin login', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${basePath}/login`)
    })

    test('should reach dashboard after logging in as admin', async ({ page }) => {
      // Act
      await form.clickButton('Log in as Admin')

      // Assert
      await form.expectHeading('Dashboard')
      await form.expectUrl(`${basePath}/dashboard`)
      await expect(page.locator('body')).toContainText('Demo Admin')
      await expect(page.locator('body')).toContainText('admin')
    })

    test('should access admin panel as admin', async ({ page }) => {
      // Arrange
      await form.clickButton('Log in as Admin')

      // Act
      await page.goto(`${basePath}/admin-panel`)

      // Assert
      await form.expectHeading('Admin panel')
    })

    test('should log out and redirect to login', async () => {
      // Arrange
      await form.clickButton('Log in as Admin')

      // Act
      await form.clickButton('Log out')

      // Assert
      await form.expectUrl(`${basePath}/login`)
    })

    test('should not access dashboard after logging out', async ({ page }) => {
      // Arrange
      await form.clickButton('Log in as Admin')
      await form.clickButton('Log out')

      // Act
      await page.goto(`${basePath}/dashboard`)

      // Assert
      await form.expectUrl(`${basePath}/login`)
    })
  })

  test.describe('viewer login', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${basePath}/login`)
    })

    test('should reach dashboard after logging in as viewer', async ({ page }) => {
      // Act
      await form.clickButton('Log in as Viewer')

      // Assert
      await form.expectHeading('Dashboard')
      await expect(page.locator('body')).toContainText('Demo Viewer')
      await expect(page.locator('body')).toContainText('viewer')
    })

    test('should receive 403 when accessing admin panel as viewer', async ({ page }) => {
      // Arrange
      await form.clickButton('Log in as Viewer')

      // Act
      await page.goto(`${basePath}/admin-panel`)

      // Assert
      await expect(page.locator('body')).toContainText('You do not have permission')
    })
  })
})
