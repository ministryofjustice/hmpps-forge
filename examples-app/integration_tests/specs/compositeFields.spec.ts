import { expect, test } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-developer-guide/patterns/demos/composite-fields'

test.describe('Composite fields journey', () => {
  let form: ForgeFormHelper

  test.beforeEach(async ({ page }) => {
    form = new ForgeFormHelper(page)
    await page.goto(`${basePath}/date-of-birth`)
  })

  test.describe('happy path', () => {
    test('should complete the journey with date of birth and address', async () => {
      // Act — date of birth
      await form.expectHeading('What is your date of birth?')
      await form.fillTextInput('Day', '27')
      await form.fillTextInput('Month', '3')
      await form.fillTextInput('Year', '1990')
      await form.clickButton('Continue')

      // Act — address
      await form.expectHeading('What is your address?')
      await form.fillTextInput('Address line 1', '10 Downing Street')
      await form.fillTextInput('Town or city', 'London')
      await form.fillTextInput('Postcode', 'SW1A 2AA')
      await form.clickButton('Continue')

      // Assert — check answers
      await form.expectHeading('Check your answers')
      await expect(form.getSummaryValue('Date of birth')).toContainText('27 March 1990')
      await expect(form.getSummaryValue('Address')).toContainText('10 Downing Street')
      await expect(form.getSummaryValue('Address')).toContainText('London')
      await form.clickButton('Confirm')

      // Assert — confirmation
      await form.expectPanelTitle('Details saved')
    })

    test('should include optional address line 2 when provided', async () => {
      // Arrange — fill date of birth
      await form.fillTextInput('Day', '1')
      await form.fillTextInput('Month', '1')
      await form.fillTextInput('Year', '2000')
      await form.clickButton('Continue')

      // Act — fill address with line 2
      await form.fillTextInput('Address line 1', 'Buckingham Palace')
      await form.fillTextInput('Address line 2 (optional)', 'The Mall')
      await form.fillTextInput('Town or city', 'London')
      await form.fillTextInput('Postcode', 'SW1A 1AA')
      await form.clickButton('Continue')

      // Assert — address shows both lines
      await expect(form.getSummaryValue('Address')).toContainText('Buckingham Palace')
      await expect(form.getSummaryValue('Address')).toContainText('The Mall')
    })
  })

  test.describe('validation', () => {
    test('should show error when date of birth is empty', async () => {
      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter your date of birth')
    })

    test('should show error when day is missing', async () => {
      // Act
      await form.fillTextInput('Month', '3')
      await form.fillTextInput('Year', '1990')
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Date of birth must include a day')
    })

    test('should show error when month is missing', async () => {
      // Act
      await form.fillTextInput('Day', '27')
      await form.fillTextInput('Year', '1990')
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Date of birth must include a month')
    })

    test('should show error when year is missing', async () => {
      // Act
      await form.fillTextInput('Day', '27')
      await form.fillTextInput('Month', '3')
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Date of birth must include a year')
    })

    test('should show error for invalid date', async () => {
      // Act
      await form.fillTextInput('Day', '31')
      await form.fillTextInput('Month', '2')
      await form.fillTextInput('Year', '1990')
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Date of birth must be a real date')
    })

    test('should show error for future date', async () => {
      // Act
      await form.fillTextInput('Day', '1')
      await form.fillTextInput('Month', '1')
      await form.fillTextInput('Year', '2099')
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Date of birth must be in the past')
    })

    test('should show error when address line 1 is empty', async () => {
      // Arrange
      await form.fillTextInput('Day', '27')
      await form.fillTextInput('Month', '3')
      await form.fillTextInput('Year', '1990')
      await form.clickButton('Continue')

      // Act
      await form.fillTextInput('Town or city', 'London')
      await form.fillTextInput('Postcode', 'SW1A 2AA')
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter the first line of your address')
    })

    test('should show error when town is empty', async () => {
      // Arrange
      await form.fillTextInput('Day', '27')
      await form.fillTextInput('Month', '3')
      await form.fillTextInput('Year', '1990')
      await form.clickButton('Continue')

      // Act
      await form.fillTextInput('Address line 1', '10 Downing Street')
      await form.fillTextInput('Postcode', 'SW1A 2AA')
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter your town or city')
    })

    test('should show error when postcode is empty', async () => {
      // Arrange
      await form.fillTextInput('Day', '27')
      await form.fillTextInput('Month', '3')
      await form.fillTextInput('Year', '1990')
      await form.clickButton('Continue')

      // Act
      await form.fillTextInput('Address line 1', '10 Downing Street')
      await form.fillTextInput('Town or city', 'London')
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter your postcode')
    })

    test('should show error for invalid postcode format', async () => {
      // Arrange
      await form.fillTextInput('Day', '27')
      await form.fillTextInput('Month', '3')
      await form.fillTextInput('Year', '1990')
      await form.clickButton('Continue')

      // Act
      await form.fillTextInput('Address line 1', '10 Downing Street')
      await form.fillTextInput('Town or city', 'London')
      await form.fillTextInput('Postcode', 'NOTAPOSTCODE')
      await form.clickButton('Continue')

      // Assert
      await form.expectValidationError('Enter a real postcode')
    })
  })

  test.describe('check answers', () => {
    test('should navigate to date of birth when clicking Change', async () => {
      // Arrange
      await form.fillTextInput('Day', '27')
      await form.fillTextInput('Month', '3')
      await form.fillTextInput('Year', '1990')
      await form.clickButton('Continue')
      await form.fillTextInput('Address line 1', '10 Downing Street')
      await form.fillTextInput('Town or city', 'London')
      await form.fillTextInput('Postcode', 'SW1A 2AA')
      await form.clickButton('Continue')

      // Act
      await form.clickChangeLink('Date of birth')

      // Assert
      await form.expectHeading('What is your date of birth?')
      await form.expectUrl(`${basePath}/date-of-birth`)
    })

    test('should navigate to address when clicking Change', async () => {
      // Arrange
      await form.fillTextInput('Day', '27')
      await form.fillTextInput('Month', '3')
      await form.fillTextInput('Year', '1990')
      await form.clickButton('Continue')
      await form.fillTextInput('Address line 1', '10 Downing Street')
      await form.fillTextInput('Town or city', 'London')
      await form.fillTextInput('Postcode', 'SW1A 2AA')
      await form.clickButton('Continue')

      // Act
      await form.clickChangeLink('Address')

      // Assert
      await form.expectHeading('What is your address?')
      await form.expectUrl(`${basePath}/address`)
    })
  })

  test.describe('restart', () => {
    test('should return to overview when clicking Restart pattern', async () => {
      // Arrange — complete the journey
      await form.fillTextInput('Day', '27')
      await form.fillTextInput('Month', '3')
      await form.fillTextInput('Year', '1990')
      await form.clickButton('Continue')
      await form.fillTextInput('Address line 1', '10 Downing Street')
      await form.fillTextInput('Town or city', 'London')
      await form.fillTextInput('Postcode', 'SW1A 2AA')
      await form.clickButton('Continue')
      await form.clickButton('Confirm')

      // Act
      await form.clickButton('Restart pattern')

      // Assert
      await form.expectHeading('Multi-part composite fields')
      await form.expectUrl(`${basePath}/overview`)
    })
  })
})
