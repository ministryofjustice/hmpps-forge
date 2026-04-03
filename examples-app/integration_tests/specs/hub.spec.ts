import { expect, test } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

test.describe('Hub page', () => {
  test('should render the hub page at the journey root without a redirect loop', async ({
    page,
  }) => {
    // Act
    const response = await page.goto('/example-journeys')

    // Assert
    expect(response?.status()).toBe(200)
    const form = new ForgeFormHelper(page)
    await form.expectHeading('Example journeys')
  })

  test('should display card links to both example journeys', async ({ page }) => {
    // Arrange
    await page.goto('/example-journeys')

    // Assert
    const feedbackCard = page.getByRole('link', { name: 'Give feedback' })
    const appointmentCard = page.getByRole('link', { name: 'Book an appointment' })

    await expect(feedbackCard).toBeVisible()
    await expect(appointmentCard).toBeVisible()
  })

  test('should navigate to feedback journey entry point from card link', async ({ page }) => {
    // Arrange
    await page.goto('/example-journeys')

    // Act
    await page.getByRole('link', { name: 'Give feedback' }).click()

    // Assert
    const form = new ForgeFormHelper(page)
    await form.expectHeading('What is your name?')
    await form.expectUrl('/example-journeys/feedback/name')
  })

  test('should navigate to book appointment journey entry point from card link', async ({
    page,
  }) => {
    // Arrange
    await page.goto('/example-journeys')

    // Act
    await page.getByRole('link', { name: 'Book an appointment' }).click()

    // Assert
    const form = new ForgeFormHelper(page)
    await form.expectHeading('What type of appointment')
    await form.expectUrl('/example-journeys/book-appointment/type')
  })
})
