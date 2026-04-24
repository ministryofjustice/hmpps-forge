import { expect, test } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-developer-guide/patterns/demos/add-another'

test.describe('Add another journey', () => {
  let form: ForgeFormHelper

  test.beforeEach(async ({ page }) => {
    form = new ForgeFormHelper(page)
    await page.goto(`${basePath}/your-contacts`)
  })

  test.describe('happy path', () => {
    test('should complete the journey with one contact', async () => {
      // Arrange — add a contact
      await form.expectHeading('Your emergency contacts')
      await form.clickButton('Add another contact')
      await form.expectHeading('Add an emergency contact')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.selectOption('Relationship', 'partner')
      await form.fillTextInput('Phone number', '020 7946 0958')
      await form.clickButton('Save and continue')

      // Act — continue to check answers
      await form.expectHeading('Your emergency contacts')
      await expect(form.getSummaryCard('Jane Smith')).toBeVisible()
      await form.clickButton('Continue')

      // Assert — check answers and confirm
      await form.expectHeading('Check your answers')
      await expect(form.getSummaryCardValue('Jane Smith', 'Relationship')).toContainText('Partner')
      await expect(form.getSummaryCardValue('Jane Smith', 'Phone number')).toContainText(
        '020 7946 0958',
      )
      await form.clickButton('Confirm')
      await form.expectPanelTitle('Emergency contacts saved')
    })

    test('should complete the journey with multiple contacts', async () => {
      // Arrange — add first contact
      await form.clickButton('Add another contact')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.selectOption('Relationship', 'partner')
      await form.fillTextInput('Phone number', '020 7946 0958')
      await form.clickButton('Save and continue')

      // Add second contact
      await form.clickButton('Add another contact')
      await form.fillTextInput('Full name', 'John Doe')
      await form.selectOption('Relationship', 'colleague')
      await form.fillTextInput('Phone number', '07700900000')
      await form.clickButton('Save and continue')

      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectSummaryCardCount(2)
      await expect(form.getSummaryCardValue('Jane Smith', 'Relationship')).toContainText('Partner')
      await expect(form.getSummaryCardValue('John Doe', 'Relationship')).toContainText('Colleague')
      await form.clickButton('Confirm')
      await form.expectPanelTitle('Emergency contacts saved')
    })
  })

  test.describe('add and remove contacts', () => {
    test('should show empty state message when no contacts are added', async () => {
      // Assert
      await form.expectInsetText('You have not added any emergency contacts yet.')
    })

    test('should show summary card after adding a contact', async () => {
      // Act
      await form.clickButton('Add another contact')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.selectOption('Relationship', 'friend')
      await form.fillTextInput('Phone number', '020 7946 0958')
      await form.clickButton('Save and continue')

      // Assert
      await expect(form.getSummaryCard('Jane Smith')).toBeVisible()
      await expect(form.getSummaryCardValue('Jane Smith', 'Relationship')).toContainText('Friend')
      await expect(form.getSummaryCardValue('Jane Smith', 'Phone number')).toContainText(
        '020 7946 0958',
      )
    })

    test('should remove a contact when clicking Remove on its card', async () => {
      // Arrange — add two contacts
      await form.clickButton('Add another contact')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.selectOption('Relationship', 'partner')
      await form.fillTextInput('Phone number', '020 7946 0958')
      await form.clickButton('Save and continue')

      await form.clickButton('Add another contact')
      await form.fillTextInput('Full name', 'John Doe')
      await form.selectOption('Relationship', 'friend')
      await form.fillTextInput('Phone number', '07700900000')
      await form.clickButton('Save and continue')

      // Act — remove first contact
      await form
        .getSummaryCard('Jane Smith')
        .getByRole('link', { name: /remove/i })
        .click()

      // Assert
      await form.expectSummaryCardCount(1)
      await expect(form.getSummaryCard('John Doe')).toBeVisible()
      await expect(form.getSummaryCard('Jane Smith')).not.toBeVisible()
    })

    test('should show empty state after removing all contacts', async () => {
      // Arrange
      await form.clickButton('Add another contact')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.selectOption('Relationship', 'partner')
      await form.fillTextInput('Phone number', '020 7946 0958')
      await form.clickButton('Save and continue')

      // Act
      await form
        .getSummaryCard('Jane Smith')
        .getByRole('link', { name: /remove/i })
        .click()

      // Assert
      await form.expectInsetText('You have not added any emergency contacts yet.')
    })
  })

  test.describe('edit contact', () => {
    test.beforeEach(async () => {
      await form.clickButton('Add another contact')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.selectOption('Relationship', 'partner')
      await form.fillTextInput('Phone number', '020 7946 0958')
      await form.clickButton('Save and continue')
    })

    test('should open edit form when clicking Change on a card', async () => {
      // Act
      await form
        .getSummaryCard('Jane Smith')
        .getByRole('link', { name: /change/i })
        .click()

      // Assert
      await form.expectHeading('Change emergency contact')
      await form.expectUrl(`${basePath}/edit-contact/0`)
    })

    test('should update the contact after editing', async () => {
      // Act
      await form
        .getSummaryCard('Jane Smith')
        .getByRole('link', { name: /change/i })
        .click()
      await form.fillTextInput('Full name', 'Janet Smith')
      await form.selectOption('Relationship', 'sibling')
      await form.clickButton('Save and continue')

      // Assert — back on list with updated card
      await form.expectHeading('Your emergency contacts')
      await expect(form.getSummaryCard('Janet Smith')).toBeVisible()
      await expect(form.getSummaryCardValue('Janet Smith', 'Relationship')).toContainText('Sibling')
    })
  })

  test.describe('validation', () => {
    test('should show error when continuing with no contacts', async () => {
      // Act
      await form.clickButton('Continue')

      // Assert
      await form.expectStepError('Add at least one emergency contact')
      await form.expectUrl(`${basePath}/your-contacts`)
    })

    test('should show error when name is empty on add form', async () => {
      // Arrange
      await form.clickButton('Add another contact')
      await form.selectOption('Relationship', 'partner')
      await form.fillTextInput('Phone number', '020 7946 0958')

      // Act
      await form.clickButton('Save and continue')

      // Assert
      await form.expectValidationError('Enter a full name')
    })

    test('should show error when relationship is not selected on add form', async () => {
      // Arrange
      await form.clickButton('Add another contact')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.fillTextInput('Phone number', '020 7946 0958')

      // Act
      await form.clickButton('Save and continue')

      // Assert
      await form.expectValidationError('Select a relationship')
    })

    test('should show error when phone is empty on add form', async () => {
      // Arrange
      await form.clickButton('Add another contact')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.selectOption('Relationship', 'partner')

      // Act
      await form.clickButton('Save and continue')

      // Assert
      await form.expectValidationError('Enter a phone number')
    })
  })

  test.describe('restart', () => {
    test('should return to overview when clicking Restart pattern', async () => {
      // Arrange — complete the journey
      await form.clickButton('Add another contact')
      await form.fillTextInput('Full name', 'Jane Smith')
      await form.selectOption('Relationship', 'partner')
      await form.fillTextInput('Phone number', '020 7946 0958')
      await form.clickButton('Save and continue')
      await form.clickButton('Continue')
      await form.clickButton('Confirm')

      // Act
      await form.clickButton('Restart pattern')

      // Assert
      await form.expectHeading('Add another')
      await form.expectUrl(`${basePath}/overview`)
    })
  })
})
