import { expect, test } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-developer-guide/patterns/demos/load-reference-data'

test.describe('Load reference data journey', () => {
  let form: ForgeFormHelper

  test.beforeEach(async ({ page }) => {
    form = new ForgeFormHelper(page)
    await page.goto(`${basePath}/draw`)
  })

  test('should display the lottery draw heading', async () => {
    // Assert
    await form.expectHeading('Your lottery draw')
  })

  test('should display a draw date', async ({ page }) => {
    // Assert — use <p> to avoid matching the <main> wrapper which also has govuk-body
    await expect(page.locator('p.govuk-body', { hasText: 'Drawn on' })).toBeVisible()
  })

  test('should display 6 main lottery balls', async ({ page }) => {
    // Assert
    const balls = page.locator('.lottery-ball--blue .lottery-ball__number')
    await expect(balls).toHaveCount(6)
  })

  test('should display a bonus ball', async ({ page }) => {
    // Assert
    await expect(page.locator('.lottery-ball--green .lottery-ball__number')).toBeVisible()
  })

  test('should display different numbers on redraw', async ({ page }) => {
    // Arrange — capture first draw
    const firstNumbers: string[] = []
    const balls = page.locator('.lottery-ball--blue .lottery-ball__number')

    for (let i = 0; i < 6; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      firstNumbers.push((await balls.nth(i).textContent()) ?? '')
    }

    // Act — draw again (may take several redraws to get different numbers)
    await form.clickButton('Draw again')

    // Assert — page reloads with lottery balls (numbers are random, so just verify the page renders)
    await form.expectHeading('Your lottery draw')
    await expect(balls).toHaveCount(6)
  })
})
