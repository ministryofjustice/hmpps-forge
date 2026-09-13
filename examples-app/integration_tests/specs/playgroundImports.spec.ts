import { expect, test } from '@playwright/test'

test.describe('Playground import suggestions', () => {
  let selectAll: string

  test.beforeEach(async ({ page }) => {
    // Arrange
    await page.goto('/forge-guide-v2/patterns/single-question-per-page')
    // Monaco uses the emulated browser's user agent for keybindings, not the host OS.
    selectAll = await page.evaluate(() =>
      navigator.userAgent.includes('Macintosh') ? 'Meta+A' : 'Control+A',
    )
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled({
      timeout: 30000,
    })
    await page.getByRole('button', { name: 'Add file', exact: true }).click()
    await page.getByRole('textbox', { name: 'File name' }).fill('suggestions.ts')
    await page.getByRole('dialog').getByRole('button', { name: 'Add file', exact: true }).click()
  })

  const examples = [
    { name: 'when', prefix: 'whe', module: 'core/authoring', existingImport: '' },
    {
      name: 'when',
      prefix: 'whe',
      module: 'core/authoring',
      existingImport: "import { Answer } from '@ministryofjustice/hmpps-forge/core/authoring'\n",
    },
    { name: 'GovUKButton', prefix: 'GovUKBu', module: 'govuk-components', existingImport: '' },
  ]

  examples.forEach(({ name, prefix, module, existingImport }) => {
    test(`should import ${name} when completing it ${existingImport ? 'with' : 'without'} an existing import`, async ({
      page,
    }) => {
      // Arrange
      const editor = page.locator('.view-lines')
      await editor.click()
      await page.keyboard.press(selectAll)
      await page.keyboard.insertText(`${existingImport}export {};\nconst result = ${prefix}`)

      // Act
      await page.keyboard.press('Control+Space')
      const suggestion = page.locator('.suggest-widget .monaco-list-row').filter({
        has: page.locator('.label-name').getByText(name, { exact: true }),
      })
      await suggestion.click()

      // Assert
      await expect(editor).toContainText(`const result = ${name}`)
      await expect(editor).toContainText(`from '@ministryofjustice/hmpps-forge/${module}'`)
      expect((await editor.innerText()).match(/from\s+['"]/g)).toHaveLength(1)

      // Act
      await page.getByRole('button', { name: 'Run', exact: true }).click()

      // Assert
      await expect(page.locator('[data-status]')).toHaveText('Preview up to date')
    })
  })

  test('should insert a relative import when completing an export from another playground file', async ({
    page,
  }) => {
    // Arrange
    const editor = page.locator('.view-lines')
    await editor.click()
    await page.keyboard.press(selectAll)
    await page.keyboard.insertText("export const greeting = 'Hello'\n")
    await page.getByRole('button', { name: 'Add file', exact: true }).click()
    await page.getByRole('textbox', { name: 'File name' }).fill('steps/example.ts')
    await page.getByRole('dialog').getByRole('button', { name: 'Add file', exact: true }).click()
    await editor.click()
    await page.keyboard.press(selectAll)
    await page.keyboard.insertText('export {};\nconst message = gree')

    // Act
    await page.keyboard.press('Control+Space')
    await page
      .locator('.suggest-widget .monaco-list-row')
      .filter({
        has: page.locator('.label-name').getByText('greeting', { exact: true }),
      })
      .click()

    // Assert
    await expect(editor).toContainText("import { greeting } from '../suggestions'")
    await expect(editor).toContainText('const message = greeting')

    // Act
    await page.getByRole('button', { name: 'Run', exact: true }).click()

    // Assert
    await expect(page.locator('[data-status]')).toHaveText('Preview up to date')
  })
})
