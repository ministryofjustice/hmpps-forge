import { expect, test } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-developer-guide/patterns/demos/read-only-mode'

test.describe('Read-only mode journey', () => {
  let form: ForgeFormHelper

  test.beforeEach(async ({ page }) => {
    form = new ForgeFormHelper(page)
  })

  test.describe('contacts list', () => {
    test('should show all three contacts after logging in', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/login`)
      await form.clickButton('Log in as Viewer')

      // Assert
      await form.expectHeading('Contacts')
      await expect(page.locator('.govuk-summary-list__row')).toHaveCount(3)
    })

    test('should redirect to login when accessing contacts without auth', async ({ page }) => {
      // Act
      await page.goto(`${basePath}/contacts`)

      // Assert
      await form.expectUrl(`${basePath}/login`)
    })
  })

  test.describe('viewer role', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${basePath}/login`)
      await form.clickButton('Log in as Viewer')
    })

    test('should show read-only summary list on record page', async ({ page }) => {
      // Act
      await page.getByRole('link', { name: 'View' }).first().click()

      // Assert
      await form.expectHeading('Contact record')
      await expect(form.getSummaryValue('Name')).toContainText('Jane Smith')
      await expect(form.getSummaryValue('Email')).toContainText('jane.smith@example.com')
      await expect(form.getSummaryValue('Department')).toContainText('Digital Services')
    })

    test('should show read-only notice', async ({ page }) => {
      // Act
      await page.getByRole('link', { name: 'View' }).first().click()

      // Assert
      await form.expectInsetText('You have read-only access')
    })

    test('should not show edit fields or save button', async ({ page }) => {
      // Act
      await page.getByRole('link', { name: 'View' }).first().click()

      // Assert
      await expect(page.getByLabel('Name')).not.toBeVisible()
      await expect(page.getByRole('button', { name: 'Save changes' })).not.toBeVisible()
    })

    test('should navigate back to contacts list', async ({ page }) => {
      // Arrange
      await page.getByRole('link', { name: 'View' }).first().click()

      // Act
      await form.clickButton('Back to contacts')

      // Assert
      await form.expectHeading('Contacts')
      await form.expectUrl(`${basePath}/contacts`)
    })
  })

  test.describe('admin role', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${basePath}/login`)
      await form.clickButton('Log in as Admin')
    })

    test('should show editable form fields on record page', async ({ page }) => {
      // Act
      await page.getByRole('link', { name: 'View' }).first().click()

      // Assert
      await form.expectHeading('Contact record')
      await expect(page.getByLabel('Name')).toHaveValue('Jane Smith')
      await expect(page.getByLabel('Email')).toHaveValue('jane.smith@example.com')
      await expect(page.getByLabel('Department')).toHaveValue('Digital Services')
    })

    test('should redirect to contacts after saving', async ({ page }) => {
      // Arrange
      await page.getByRole('link', { name: 'View' }).first().click()

      // Act
      await form.fillTextInput('Name', 'Alice Smith')
      await form.clickButton('Save changes')

      // Assert
      await form.expectHeading('Contacts')
      await form.expectUrl(`${basePath}/contacts`)
    })

    test('should persist edits across navigation', async ({ page }) => {
      // Arrange — edit the first contact
      await page.getByRole('link', { name: 'View' }).first().click()
      await form.fillTextInput('Name', 'Alice Smith')
      await form.clickButton('Save changes')

      // Act — view the same contact again
      await page.getByRole('link', { name: 'View' }).first().click()

      // Assert
      await expect(page.getByLabel('Name')).toHaveValue('Alice Smith')
    })

    test('should show validation error when name is empty', async ({ page }) => {
      // Arrange
      await page.getByRole('link', { name: 'View' }).first().click()

      // Act
      await form.fillTextInput('Name', '')
      await form.clickButton('Save changes')

      // Assert
      await form.expectValidationError('Enter a name')
    })

    test('should view different contacts', async ({ page }) => {
      // Act — click the second contact
      await page.getByRole('link', { name: 'View' }).nth(1).click()

      // Assert
      await expect(page.getByLabel('Name')).toHaveValue('John Doe')
      await expect(page.getByLabel('Email')).toHaveValue('john.doe@example.com')
    })
  })

  test.describe('logout', () => {
    test('should redirect to login after logging out from contacts', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/login`)
      await form.clickButton('Log in as Admin')

      // Act
      await form.clickButton('Log out')

      // Assert
      await form.expectUrl(`${basePath}/login`)
    })
  })
})
