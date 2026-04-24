import { type Locator, type Page, expect } from '@playwright/test'

export default class ForgeFormHelper {
  constructor(private readonly page: Page) {}

  async expectHeading(text: string): Promise<void> {
    await expect(this.page.locator('h1')).toContainText(text)
  }

  async expectUrl(path: string): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${path}$`))
  }

  async fillTextInput(label: string, value: string): Promise<void> {
    await this.page.getByLabel(label, { exact: true }).fill(value)
  }

  async fillTextarea(label: string, value: string): Promise<void> {
    await this.page.getByLabel(label, { exact: true }).fill(value)
  }

  async selectRadio(label: string): Promise<void> {
    await this.page.getByRole('radio', { name: label, exact: true }).check()
  }

  async selectOption(label: string, value: string): Promise<void> {
    await this.page.getByLabel(label, { exact: true }).selectOption(value)
  }

  async fillDateInput(label: string, value: string): Promise<void> {
    await this.page.getByLabel(label, { exact: true }).fill(value)
  }

  async clickButton(text: string): Promise<void> {
    await this.page.getByRole('button', { name: text }).click()
  }

  async clickLink(text: string): Promise<void> {
    await this.page.getByRole('link', { name: text }).click()
  }

  async clickBackLink(): Promise<void> {
    await this.page.locator('.govuk-back-link').click()
  }

  async expectValidationError(text: string): Promise<void> {
    const errorSummary = this.page.locator('.govuk-error-summary')

    await expect(errorSummary).toBeVisible()
    await expect(errorSummary.locator('a', { hasText: text })).toBeVisible()
  }

  async expectStepError(text: string): Promise<void> {
    const errorSummary = this.page.locator('.govuk-error-summary')

    await expect(errorSummary).toBeVisible()
    await expect(errorSummary).toContainText(text)
  }

  async expectNoValidationErrors(): Promise<void> {
    await expect(this.page.locator('.govuk-error-summary')).not.toBeVisible()
  }

  getSummaryValue(rowLabel: string): Locator {
    const row = this.page.locator('.govuk-summary-list__row', { hasText: rowLabel })

    return row.locator('.govuk-summary-list__value')
  }

  async clickChangeLink(rowLabel: string): Promise<void> {
    const row = this.page.locator('.govuk-summary-list__row', { hasText: rowLabel })

    await row.getByRole('link', { name: /change/i }).click()
  }

  getSummaryCard(title: string): Locator {
    return this.page.locator('.govuk-summary-card', {
      has: this.page.locator('.govuk-summary-card__title', { hasText: title }),
    })
  }

  getSummaryCardValue(title: string, rowLabel: string): Locator {
    const card = this.getSummaryCard(title)
    const row = card.locator('.govuk-summary-list__row', { hasText: rowLabel })

    return row.locator('.govuk-summary-list__value')
  }

  async expectSummaryCardCount(count: number): Promise<void> {
    await expect(this.page.locator('.govuk-summary-card')).toHaveCount(count)
  }

  async expectInsetText(text: string): Promise<void> {
    await expect(this.page.locator('.govuk-inset-text')).toContainText(text)
  }

  async expectPanelTitle(text: string): Promise<void> {
    await expect(this.page.locator('.govuk-panel__title')).toContainText(text)
  }
}
