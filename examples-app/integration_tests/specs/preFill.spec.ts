import { expect, test, type FrameLocator } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-guide-v2/patterns/pre-fill'

test.describe('Pre-fill journey', () => {
  let form: ForgeFormHelper
  let preview: FrameLocator

  test.beforeEach(async ({ page }) => {
    // Arrange
    preview = page.frameLocator('iframe[title="Journey preview"]')
    form = new ForgeFormHelper(page, preview)
    await page.goto(basePath)
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await form.clickButton('Start the pattern')
  })

  async function fillLookupPostcode(value: string) {
    await preview.locator('#postcode').fill(value)
  }

  test.describe('happy path', () => {
    test('should complete the journey after looking up an address', async () => {
      // Arrange — look up a known postcode
      await form.expectHeading('Find an address')
      await fillLookupPostcode('SW1A 1AA')
      await form.clickButton('Find address')

      // Assert — fields are pre-filled
      await form.expectHeading('Find an address')
      await expect(preview.getByLabel('Address line 1')).toHaveValue('Buckingham Palace')
      await expect(preview.getByLabel('Town or city')).toHaveValue('London')

      // Act — continue to check answers
      await form.clickButton('Continue')

      // Assert — check answers
      await form.expectHeading('Check your answers')
      await expect(form.getSummaryValue('Address line 1')).toContainText('Buckingham Palace')
      await expect(form.getSummaryValue('Town or city')).toContainText('London')
      await expect(form.getSummaryValue('Postcode')).toContainText('SW1A 1AA')
      await form.clickButton('Confirm')

      // Assert — confirmation
      await form.expectPanelTitle('Address saved')
    })

    test('should pre-fill address with line 2 for known postcodes', async () => {
      // Act
      await fillLookupPostcode('SW1A 2AA')
      await form.clickButton('Find address')

      // Assert
      await expect(preview.getByLabel('Address line 1')).toHaveValue('House of Commons')
      await expect(preview.getByLabel('Address line 2 (optional)')).toHaveValue('Parliament Square')
      await expect(preview.getByLabel('Town or city')).toHaveValue('London')
    })

    test('should pre-fill with fallback address for unknown postcodes', async () => {
      // Act
      await fillLookupPostcode('ZZ99 9ZZ')
      await form.clickButton('Find address')

      // Assert
      await expect(preview.getByLabel('Address line 1')).toHaveValue('10 Imaginary Lane')
      await expect(preview.getByLabel('Town or city')).toHaveValue('Exampton')
    })
  })

  test.describe('editing pre-filled values', () => {
    test('should allow overriding pre-filled values before continuing', async () => {
      // Arrange — look up and pre-fill
      await fillLookupPostcode('SW1A 1AA')
      await form.clickButton('Find address')

      // Act — override address line 1
      await form.fillTextInput('Address line 1', '1 Custom Street')
      await form.clickButton('Continue')

      // Assert — check answers shows overridden value
      await expect(form.getSummaryValue('Address line 1')).toContainText('1 Custom Street')
    })
  })

  test.describe('validation', () => {
    test('should show error when address line 1 is empty', async () => {
      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter address line 1')
    })

    test('should show error when town is empty', async () => {
      // Act
      await form.fillTextInput('Address line 1', '10 Downing Street')
      await preview.locator('#addressPostcode').fill('SW1A 2AA')
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter a town or city')
    })

    test('should show error when postcode is empty', async () => {
      // Act
      await form.fillTextInput('Address line 1', '10 Downing Street')
      await form.fillTextInput('Town or city', 'London')
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter a postcode')
    })

    test('should show error when lookup postcode is invalid', async () => {
      // Arrange
      await fillLookupPostcode('NOTAPOSTCODE')

      // Act
      await form.clickButton('Find address')

      // Assert
      await form.expectValidationError('Enter a valid postcode')
    })

    test('should show error when lookup postcode is empty', async () => {
      // Act
      await form.clickButton('Find address')

      // Assert
      await form.expectValidationError('Enter a postcode')
    })

    test('should not validate lookup postcode when left empty', async () => {
      // Arrange — fill all address fields but leave lookup postcode empty
      await form.fillTextInput('Address line 1', '10 Downing Street')
      await form.fillTextInput('Town or city', 'London')
      await preview.locator('#addressPostcode').fill('SW1A 2AA')

      // Act
      await form.clickButton('Continue')

      // Assert — proceeds without lookup postcode error
      await form.expectHeading('Check your answers')
    })

    test('should not validate lookup postcode when invalid and address fields are complete', async () => {
      // Arrange
      await fillLookupPostcode('NOTAPOSTCODE')
      await form.fillTextInput('Address line 1', '10 Downing Street')
      await form.fillTextInput('Town or city', 'London')
      await preview.locator('#addressPostcode').fill('SW1A 2AA')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectHeading('Check your answers')
    })
  })

  test.describe('restart', () => {
    test('should return to overview when clicking Restart pattern', async () => {
      // Arrange — complete the journey
      await fillLookupPostcode('SW1A 1AA')
      await form.clickButton('Find address')
      await form.clickButton('Continue')
      await form.clickButton('Confirm')

      // Act
      await form.clickButton('Restart pattern')

      // Assert
      await form.expectHeading('Pre-fill from an external system')
    })
  })
})
