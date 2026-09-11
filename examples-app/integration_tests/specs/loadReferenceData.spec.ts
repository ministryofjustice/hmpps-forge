import { expect, test, type FrameLocator } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-guide-v2/patterns/load-reference-data'

test.describe('Load reference data journey', () => {
  let form: ForgeFormHelper
  let preview: FrameLocator

  test.beforeEach(async ({ page }) => {
    // Arrange
    preview = page.frameLocator('iframe[title="Journey preview"]')
    form = new ForgeFormHelper(page, preview)
    await page.goto(basePath)
    await form.clickButton('See the demo')
  })

  test('should display the lottery draw heading', async () => {
    // Assert
    await form.expectHeading('Your lottery draw')
  })

  test('should display a draw date', async () => {
    // Assert — use <p> to avoid matching the <main> wrapper which also has govuk-body
    await expect(preview.locator('p.govuk-body', { hasText: 'Drawn on' })).toBeVisible()
  })

  test('should display 6 main lottery balls', async () => {
    // Assert
    const balls = preview.locator('.lottery-ball--blue .lottery-ball__number')
    await expect(balls).toHaveCount(6)
  })

  test('should display a bonus ball', async () => {
    // Assert
    await expect(preview.locator('.lottery-ball--green .lottery-ball__number')).toBeVisible()
  })

  test('should display different numbers on redraw', async () => {
    // Arrange — capture first draw
    const balls = preview.locator('.lottery-ball--blue .lottery-ball__number')
    const firstNumbers = await balls.allTextContents()

    // Act
    await form.clickButton('Draw again')

    // Assert
    await form.expectHeading('Your lottery draw')
    await expect(balls).toHaveCount(6)
    await expect.poll(async () => balls.allTextContents()).not.toEqual(firstNumbers)
  })
})
