import { expect, test, type FrameLocator } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-guide-v2/patterns/read-only-mode'

test.describe('Read-only mode journey', () => {
  let form: ForgeFormHelper
  let preview: FrameLocator

  test.beforeEach(async ({ page }) => {
    // Arrange
    preview = page.frameLocator('iframe[title="Journey preview"]')
    form = new ForgeFormHelper(page, preview)
    await page.goto(basePath)
    await form.clickButton('Start the pattern')
  })

  test.describe('contacts list', () => {
    test('should show all three contacts after logging in', async () => {
      // Arrange
      await form.clickButton('Log in as Viewer')

      // Assert
      await form.expectHeading('Contacts')
      await expect(preview.locator('.govuk-summary-list__row')).toHaveCount(3)
    })

    test('should redirect to login when accessing contacts without auth', async () => {
      // Act
      await preview.locator('body').evaluate(body => {
        const link = document.createElement('a')

        link.href = '/read-only-mode/contacts'
        link.textContent = 'Visit protected contacts'
        body.append(link)
      })
      await preview.getByRole('link', { name: 'Visit protected contacts' }).click()

      // Assert
      await form.expectHeading('Log in')
    })
  })

  test.describe('viewer role', () => {
    test.beforeEach(async () => {
      await form.clickButton('Log in as Viewer')
    })

    test('should show read-only summary list on record page', async () => {
      // Act
      await preview.getByRole('link', { name: 'View' }).first().click()

      // Assert
      await form.expectHeading('Contact record')
      await expect(form.getSummaryValue('Name')).toContainText('Jane Smith')
      await expect(form.getSummaryValue('Email')).toContainText('jane.smith@example.com')
      await expect(form.getSummaryValue('Department')).toContainText('Digital Services')
    })

    test('should show read-only notice', async () => {
      // Act
      await preview.getByRole('link', { name: 'View' }).first().click()

      // Assert
      await form.expectInsetText('You have read-only access')
    })

    test('should not show edit fields or save button', async () => {
      // Act
      await preview.getByRole('link', { name: 'View' }).first().click()

      // Assert
      await expect(preview.getByLabel('Name')).not.toBeVisible()
      await expect(preview.getByRole('button', { name: 'Save changes' })).not.toBeVisible()
    })

    test('should navigate back to contacts list', async () => {
      // Arrange
      await preview.getByRole('link', { name: 'View' }).first().click()

      // Act
      await form.clickButton('Back to contacts')

      // Assert
      await form.expectHeading('Contacts')
    })
  })

  test.describe('admin role', () => {
    test.beforeEach(async () => {
      await form.clickButton('Log in as Admin')
    })

    test('should show editable form fields on record page', async () => {
      // Act
      await preview.getByRole('link', { name: 'View' }).first().click()

      // Assert
      await form.expectHeading('Contact record')
      await expect(preview.getByLabel('Name')).toHaveValue('Jane Smith')
      await expect(preview.getByLabel('Email')).toHaveValue('jane.smith@example.com')
      await expect(preview.getByLabel('Department')).toHaveValue('Digital Services')
    })

    test('should redirect to contacts after saving', async () => {
      // Arrange
      await preview.getByRole('link', { name: 'View' }).first().click()

      // Act
      await form.fillTextInput('Name', 'Alice Smith')
      await form.clickButton('Save changes')

      // Assert
      await form.expectHeading('Contacts')
    })

    test('should persist edits across navigation', async () => {
      // Arrange — edit the first contact
      await preview.getByRole('link', { name: 'View' }).first().click()
      await form.fillTextInput('Name', 'Alice Smith')
      await form.clickButton('Save changes')

      // Act — view the same contact again
      await preview.getByRole('link', { name: 'View' }).first().click()

      // Assert
      await expect(preview.getByLabel('Name')).toHaveValue('Alice Smith')
    })

    test('should show validation error when name is empty', async () => {
      // Arrange
      await preview.getByRole('link', { name: 'View' }).first().click()

      // Act
      await form.fillTextInput('Name', '')
      await form.clickButton('Save changes')

      // Assert
      await form.expectValidationError('Enter a name')
    })

    test('should view different contacts', async () => {
      // Act — click the second contact
      await preview.getByRole('link', { name: 'View' }).nth(1).click()

      // Assert
      await expect(preview.getByLabel('Name')).toHaveValue('John Doe')
      await expect(preview.getByLabel('Email')).toHaveValue('john.doe@example.com')
    })
  })

  test.describe('logout', () => {
    test('should redirect to login after logging out from contacts', async () => {
      // Arrange
      await form.clickButton('Log in as Admin')

      // Act
      await form.clickButton('Log out')

      // Assert
      await form.expectHeading('Log in')
    })
  })
})
