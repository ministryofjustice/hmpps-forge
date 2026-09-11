import { expect, test, type FrameLocator } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-guide-v2/patterns/auth-role'

test.describe('Auth role journey', () => {
  let form: ForgeFormHelper
  let preview: FrameLocator

  test.beforeEach(async ({ page }) => {
    // Arrange
    preview = page.frameLocator('iframe[title="Journey preview"]')
    form = new ForgeFormHelper(page, preview)
    await page.goto(basePath)
    await form.expectHeading('Require authentication / role')
    await form.clickButton('Start the pattern')
  })

  test.describe('authentication redirect', () => {
    test('should redirect to login when accessing dashboard without auth', async () => {
      // Act
      await navigateToPage(preview, '/auth-role/overview')
      await navigateToPage(preview, '/auth-role/dashboard')

      // Assert
      await form.expectHeading('Log in')
    })

    test('should redirect to login when accessing admin panel without auth', async () => {
      // Act
      await navigateToPage(preview, '/auth-role/overview')
      await navigateToPage(preview, '/auth-role/admin-panel')

      // Assert
      await form.expectHeading('Log in')
    })
  })

  test.describe('admin login', () => {
    test('should reach dashboard after logging in as admin', async () => {
      // Act
      await form.clickButton('Log in as Admin')

      // Assert
      await form.expectHeading('Dashboard')
      await expect(preview.locator('body')).toContainText('Demo Admin')
      await expect(preview.locator('body')).toContainText('admin')
    })

    test('should access admin panel as admin', async () => {
      // Arrange
      await form.clickButton('Log in as Admin')

      // Act
      await form.clickButton('Go to admin panel')

      // Assert
      await form.expectHeading('Admin panel')
    })

    test('should log out and redirect to login', async () => {
      // Arrange
      await form.clickButton('Log in as Admin')

      // Act
      await form.clickButton('Log out')

      // Assert
      await form.expectHeading('Log in')
    })

    test('should not access dashboard after logging out', async () => {
      // Arrange
      await form.clickButton('Log in as Admin')
      await form.clickButton('Log out')

      // Act
      await navigateToPage(preview, '/auth-role/overview')
      await navigateToPage(preview, '/auth-role/dashboard')

      // Assert
      await form.expectHeading('Log in')
    })
  })

  test.describe('viewer login', () => {
    test('should reach dashboard after logging in as viewer', async () => {
      // Act
      await form.clickButton('Log in as Viewer')

      // Assert
      await form.expectHeading('Dashboard')
      await expect(preview.locator('body')).toContainText('Demo Viewer')
      await expect(preview.locator('body')).toContainText('viewer')
    })

    test('should receive 403 when accessing admin panel as viewer', async ({ page }) => {
      // Arrange
      await form.clickButton('Log in as Viewer')

      // Act
      await form.clickButton('Go to admin panel')

      // Assert
      await expect(page.locator('.playground__status')).toContainText('You do not have permission')
      await expect(
        preview.getByRole('heading', { name: 'Admin panel', exact: true }),
      ).not.toBeVisible()
    })
  })
})

async function navigateToPage(preview: FrameLocator, href: string): Promise<void> {
  await preview.locator('main').evaluate((container, destination) => {
    const anchor = document.createElement('a')

    anchor.href = destination
    anchor.textContent = 'Open protected route'
    anchor.id = 'test-protected-route'
    container.append(anchor)
  }, href)
  await preview.locator('#test-protected-route').click()
  await expect(preview.locator('#test-protected-route')).toHaveCount(0)
}
