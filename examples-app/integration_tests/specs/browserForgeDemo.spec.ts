import { expect, test, type Page } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const demoPath = '/browser-demo/your-name'

// Step headings live in the journey config (GovUKHeading blocks or
// isPageHeading legends), so they render as h1s scoped to the browser application.
async function expectDemoHeading(page: Page, text: string): Promise<void> {
  await expect(page.locator('#browser-forge-app h1').first()).toContainText(text)
}

test.describe('Browser Forge demo', () => {
  let form: ForgeFormHelper
  let serverRequests: string[]

  test.beforeEach(async ({ page }) => {
    form = new ForgeFormHelper(page)
    serverRequests = []
    page.on('request', request => {
      const url = new URL(request.url())

      if (url.origin.includes('localhost') && !url.pathname.startsWith('/assets/')) {
        serverRequests.push(`${request.method()} ${url.pathname}`)
      }
    })
    await page.goto(demoPath)
  })

  test.describe('client-side journey', () => {
    test('should complete the journey without any server requests', async ({ page }) => {
      // Arrange - the initial page load is the only server GET
      await expectDemoHeading(page, 'What is your name?')

      const initialRequests = [...serverRequests]

      // Act - walk the whole journey
      await form.fillTextInput('Full name', 'Ada Lovelace')
      await form.clickButton('Continue')
      await expectDemoHeading(page, 'How should we contact you?')
      await form.selectRadio('Email')
      await form.fillTextInput('Email address', 'ada@example.com')
      await form.clickButton('Continue')
      await expectDemoHeading(page, 'Application complete')

      // Assert - nothing new left the page
      expect(serverRequests).toEqual(initialRequests)
      await expect(page).toHaveURL(/\/browser-demo\/confirmation$/)
    })

    test('should show validation errors client-side when submitting empty', async ({ page }) => {
      // Arrange
      await expectDemoHeading(page, 'What is your name?')

      const initialRequests = [...serverRequests]

      // Act
      await form.clickButton('Continue')

      // Assert
      await expect(page.getByRole('alert')).toContainText('Enter your full name')
      expect(serverRequests).toEqual(initialRequests)
    })

    test('should update the history url as the journey progresses', async ({ page }) => {
      // Arrange
      await expectDemoHeading(page, 'What is your name?')
      await expect(page).toHaveURL(/\/browser-demo\/your-name$/)

      // Act
      await form.fillTextInput('Full name', 'Ada Lovelace')
      await form.clickButton('Continue')

      // Assert
      await expect(page).toHaveURL(/\/browser-demo\/contact$/)
    })

    test('should reset new navigation scroll and restore history positions', async ({ page }) => {
      // Arrange
      await expectDemoHeading(page, 'What is your name?')
      await form.fillTextInput('Full name', 'Ada Lovelace')
      await page.evaluate(() => {
        document.body.style.minHeight = '4000px'
        window.scrollTo(0, 600)
      })
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(600)

      // Act
      await page.getByRole('button', { name: 'Continue' }).evaluate((button: HTMLButtonElement) => {
        button.form?.requestSubmit(button)
      })

      // Assert
      await expectDemoHeading(page, 'How should we contact you?')
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

      // Arrange
      await page.evaluate(() => window.scrollTo(0, 900))
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(900)

      // Act
      await page.goBack()

      // Assert
      await expectDemoHeading(page, 'What is your name?')
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(600)

      // Act
      await page.goForward()

      // Assert
      await expectDemoHeading(page, 'How should we contact you?')
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(900)
    })

    test('should restore draft answers from session storage after a reload', async ({ page }) => {
      // Arrange - complete the first step so the draft persists
      await expectDemoHeading(page, 'What is your name?')
      await form.fillTextInput('Full name', 'Ada Lovelace')
      await form.clickButton('Continue')
      await expectDemoHeading(page, 'How should we contact you?')

      // Act
      await page.reload()

      // Assert - back on the contact step with the name draft intact
      await expectDemoHeading(page, 'How should we contact you?')
      await page.goto('/browser-demo/your-name')
      await page.reload()
      await expect(page.getByLabel('Full name')).toHaveValue('Ada Lovelace')
    })

    test('should complete the branching pattern demo on the video branch', async ({ page }) => {
      // Arrange
      const initialRequests = [...serverRequests]

      await page.getByRole('link', { name: 'Branching package' }).click()
      await expectDemoHeading(page, 'How would you like to meet?')

      // Act - take the video branch through to check-answers
      await form.selectRadio('Video call')
      await form.clickButton('Continue')
      await expectDemoHeading(page, 'What email should we send the invite to?')
      await form.fillTextInput('What email should we send the invite to?', 'ada@example.com')
      await form.clickButton('Continue')
      await expectDemoHeading(page, 'Check your answers')

      // Assert - only the branch taken appears, and nothing left the page
      await expect(page.locator('#browser-forge-app')).toContainText('Invite email')
      await expect(page.locator('#browser-forge-app')).not.toContainText('Office')
      expect(serverRequests).toEqual(initialRequests)

      // Act - a Change link re-enters the journey client-side
      await page
        .locator('#browser-forge-app')
        .getByRole('link', { name: /Change.*invite email/ })
        .click()

      // Assert
      await expectDemoHeading(page, 'What email should we send the invite to?')
      await expect(page.getByLabel('What email should we send the invite to?')).toHaveValue(
        'ada@example.com',
      )
      expect(serverRequests).toEqual(initialRequests)
    })

    test('should add, edit, and remove contacts in the add-another pattern demo', async ({
      page,
    }) => {
      // Arrange
      const initialRequests = [...serverRequests]

      await page.getByRole('link', { name: 'Add another package' }).click()
      await expectDemoHeading(page, 'Your emergency contacts')

      const demo = page.locator('#browser-forge-app')

      // Act - add two contacts
      await form.clickButton('Add another contact')
      await expectDemoHeading(page, 'Add an emergency contact')
      await form.fillTextInput('Full name', 'Ada Lovelace')
      await form.selectOption('Relationship', 'friend')
      await form.fillTextInput('Phone number', '07700 900000')
      await form.clickButton('Save and continue')
      await expectDemoHeading(page, 'Your emergency contacts')
      await form.clickButton('Add another contact')
      await form.fillTextInput('Full name', 'Charles Babbage')
      await form.selectOption('Relationship', 'colleague')
      await form.fillTextInput('Phone number', '07700 900001')
      await form.clickButton('Save and continue')

      // Assert - both cards render through the iterator
      await expect(demo).toContainText('Ada Lovelace')
      await expect(demo).toContainText('Charles Babbage')

      // Act - edit the first contact
      await demo.getByRole('link', { name: /Change.*Ada Lovelace/ }).click()
      await expectDemoHeading(page, 'Change emergency contact')
      await expect(page.getByLabel('Full name')).toHaveValue('Ada Lovelace')
      await form.fillTextInput('Full name', 'Ada King')
      await form.clickButton('Save and continue')
      await expect(demo).toContainText('Ada King')

      // Act - remove the second contact
      await demo.getByRole('link', { name: /Remove.*Charles Babbage/ }).click()
      await expectDemoHeading(page, 'Are you sure you want to remove this contact?')
      await form.clickButton('Yes, remove contact')

      // Assert - one contact left, and the whole flow made no server requests
      await expect(demo).toContainText('Ada King')
      await expect(demo).not.toContainText('Charles Babbage')
      expect(serverRequests).toEqual(initialRequests)
    })

    test('should log no console errors while running the journey', async ({ page }) => {
      // Arrange
      const consoleErrors: string[] = []

      page.on('console', message => {
        if (message.type() === 'error') {
          consoleErrors.push(message.text())
        }
      })

      // Act
      await expectDemoHeading(page, 'What is your name?')
      await form.fillTextInput('Full name', 'Ada Lovelace')
      await form.clickButton('Continue')
      await expectDemoHeading(page, 'How should we contact you?')

      // Assert
      expect(consoleErrors).toEqual([])
    })
  })
})
