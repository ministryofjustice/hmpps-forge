import { expect, test } from '@playwright/test'

const patternUrl = '/forge-guide-v2/patterns/branching'
const previewTitle = 'Branching based on an earlier answer'

test.describe('Playground startup', () => {
  test('should preload the runtime when TypeScript declarations are still loading', async ({
    page,
  }) => {
    // Arrange
    const declarations = Promise.withResolvers<void>()

    await page.route('**/assets/playground/declarations.json', async route => {
      await declarations.promise
      await route.continue()
    })

    const runtimeLoaded = page.waitForResponse(response =>
      response.url().includes('/assets/playground/preview.js?v='),
    )

    // Act
    await page.goto(patternUrl, { waitUntil: 'domcontentloaded' })
    const runtime = await runtimeLoaded
    const preview = page.frameLocator('iframe[title="Journey preview"]')

    // Assert
    expect(runtime.ok()).toBe(true)
    await expect(preview.getByRole('heading', { name: previewTitle })).toHaveCount(0)
    declarations.resolve()
    await expect(preview.getByRole('heading', { name: previewTitle })).toBeVisible()
  })

  test('should render when the iframe becomes ready after compilation finishes', async ({
    page,
  }) => {
    // Arrange
    const previewReady = Promise.withResolvers<void>()

    await page.route('**/forge-guide-v2/playground/preview', async route => {
      await previewReady.promise
      await route.continue()
    })

    // Act
    await page.goto(patternUrl, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled()
    previewReady.resolve()

    // Assert
    await expect(
      page
        .frameLocator('iframe[title="Journey preview"]')
        .getByRole('heading', { name: previewTitle }),
    ).toBeVisible()
  })

  test('should reject type errors when compiling the initial source', async ({ page }) => {
    // Arrange
    await page.route('**/assets/playground/branching/journey.ts', async route => {
      const response = await route.fetch()
      const source = await response.text()

      await route.fulfill({ response, body: `${source}\nconst startupTypeCheck: string = 123\n` })
    })

    // Act
    await page.goto(patternUrl)

    // Assert
    await expect(page.locator('[data-status]')).toHaveText(
      'Fix the errors in journey.ts before running',
    )
    await expect(
      page.frameLocator('iframe[title="Journey preview"]').locator('main h1'),
    ).toHaveCount(0)
  })

  test('should reject invalid syntax when compiling the initial source', async ({ page }) => {
    // Arrange
    await page.route('**/assets/playground/branching/journey.ts', async route => {
      const response = await route.fetch()
      const source = await response.text()

      await route.fulfill({ response, body: `${source}\nconst broken =\n` })
    })

    // Act
    await page.goto(patternUrl)

    // Assert
    await expect(page.locator('[data-status]')).toHaveText(
      'Fix the errors in journey.ts before running',
    )
    await expect(
      page.frameLocator('iframe[title="Journey preview"]').locator('main h1'),
    ).toHaveCount(0)
  })

  test('should reuse the runtime URL and reset the journey when restarting or running again', async ({
    page,
  }) => {
    // Arrange
    await page.goto(patternUrl)
    const preview = page.frameLocator('iframe[title="Journey preview"]')

    await expect(preview.getByRole('heading', { name: previewTitle })).toBeVisible()
    const runtimeUrl = await preview.locator('script[src]').getAttribute('src')

    await preview.getByRole('button', { name: 'Start the pattern' }).click()
    await expect(preview.getByRole('heading', { name: previewTitle })).toHaveCount(0)

    // Act
    await page.getByRole('button', { name: 'Restart journey', exact: true }).click()

    // Assert
    await expect(preview.getByRole('heading', { name: previewTitle })).toBeVisible()
    await expect(preview.locator('script[src]')).toHaveAttribute('src', runtimeUrl ?? '')

    // Act
    await preview.getByRole('button', { name: 'Start the pattern' }).click()
    await expect(preview.getByRole('heading', { name: previewTitle })).toHaveCount(0)
    await page.getByRole('button', { name: 'Run', exact: true }).click()

    // Assert
    await expect(preview.getByRole('heading', { name: previewTitle })).toBeVisible()
    await expect(preview.locator('script[src]')).toHaveAttribute('src', runtimeUrl ?? '')
  })
})
