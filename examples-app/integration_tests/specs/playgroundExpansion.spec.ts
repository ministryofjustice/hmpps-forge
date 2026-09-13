import { expect, test } from '@playwright/test'

test.describe('Playground expansion', () => {
  test('should preserve edits and journey state when expanding and returning to the guide', async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/forge-guide-v2/patterns/single-question-per-page')
    const playground = page.locator('.playground')
    const preview = page.frameLocator('iframe[title="Journey preview"]')
    await preview.getByRole('button', { name: 'Start the pattern' }).click()
    const name = preview.getByRole('textbox', { name: 'What is your name?' })
    await name.fill('Ada Lovelace')
    await page.getByRole('button', { name: 'Add file', exact: true }).click()
    await page.getByRole('textbox', { name: 'File name' }).fill('notes.ts')
    await page.getByRole('dialog').getByRole('button', { name: 'Add file', exact: true }).click()
    await playground.locator('.view-lines').click()
    await page.keyboard.press('ControlOrMeta+Home')
    await page.keyboard.insertText('// Keep this edit\n')
    await expect(playground.locator('.view-lines')).toContainText('// Keep this edit')
    const expand = page.getByRole('button', { name: 'Expand playground' })
    await expand.scrollIntoViewIfNeeded()
    const scrollY = await page.evaluate(() => window.scrollY)

    // Act
    await expand.click()

    // Assert
    await expect(playground).toHaveClass(/playground--expanded/)
    expect(await playground.boundingBox()).toEqual({ x: 0, y: 0, width: 1600, height: 1000 })
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull()
    await expect(page.locator('.guide-shell__nav')).toHaveAttribute('inert', '')
    await expect(name).toHaveValue('Ada Lovelace')
    await expect(playground.locator('.view-lines')).toContainText('// Keep this edit')

    // Act
    await page.getByRole('button', { name: 'Back to guide' }).click()

    // Assert
    await expect(playground).not.toHaveClass(/playground--expanded/)
    await expect(expand).toBeFocused()
    await expect(page.locator('.guide-shell__nav')).not.toHaveAttribute('inert', '')
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY)
    await expect(name).toHaveValue('Ada Lovelace')
    await expect(playground.locator('.view-lines')).toContainText('// Keep this edit')

    // Act
    await expand.click()
    await name.press('Escape')

    // Assert
    await expect(playground).not.toHaveClass(/playground--expanded/)
    await expect(expand).toBeFocused()
    await expect(name).toHaveValue('Ada Lovelace')

    // Act
    await expand.click()
    await playground.locator('.view-lines').click()
    await page.keyboard.press('Escape')

    // Assert
    await expect(playground).not.toHaveClass(/playground--expanded/)
    await expect(playground.locator('.view-lines')).toContainText('// Keep this edit')
  })
})
