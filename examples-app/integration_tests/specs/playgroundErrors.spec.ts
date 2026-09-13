import { expect, test } from '@playwright/test'

const errorCases = [
  { status: 404, heading: 'Page not found' },
  { status: 500, heading: 'Sorry, there is a problem' },
]

test.describe('Playground errors', () => {
  errorCases.forEach(({ status, heading }) => {
    test(`should recover through the start link when the first page fails with ${status}`, async ({
      page,
    }) => {
      // Arrange
      await page.route('**/assets/playground/branching/overview.ts', async route => {
        const response = await route.fetch()
        const source = await response.text()
        const failure = `
          import { access, effect } from '@ministryofjustice/hmpps-forge/core/authoring'
          let failOnce = true
          const failOnFirstAccess = effect({ factory: () => () => {
            if (failOnce) {
              failOnce = false
              throw Object.assign(new Error('<b>Private diagnostic</b>'), { status: ${status} })
            }
          } })
        `
        const body =
          failure +
          source.replace(
            'export const overviewStep = step({',
            'export const overviewStep = step({ onAccess: [access({ effects: [failOnFirstAccess()] })],',
          )

        await route.fulfill({ response, body })
      })

      const preview = page.frameLocator('iframe[title="Journey preview"]')

      // Act
      await page.goto('/forge-guide-v2/patterns/branching')

      // Assert
      await expect(preview.getByRole('heading', { name: heading, exact: true })).toBeVisible()
      await expect(preview.locator('#playground-error-heading')).toBeFocused()
      await expect(preview.locator('body')).not.toContainText('Private diagnostic')
      await expect(page.locator('[data-status]')).toContainText('<b>Private diagnostic</b>')
      await expect(preview.getByRole('link', { name: 'Return to the start' })).toHaveAttribute(
        'href',
        '/branching/overview',
      )

      // Act
      await preview.getByRole('link', { name: 'Return to the start' }).click()

      // Assert
      await expect(
        preview.getByRole('heading', { name: 'Branching based on an earlier answer' }),
      ).toBeVisible()
      await expect(page.locator('[data-status]')).not.toContainText('Private diagnostic')
    })
  })
})
