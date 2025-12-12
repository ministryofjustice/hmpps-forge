import { MojComponentTestHelper } from '@form-engine-moj-components/test-utils/MojComponentTestHelper'
import { setupComponentTest } from '@form-engine-moj-components/test-utils/setupComponentTest'
import { mojDatePicker } from './mojDatePicker'

jest.mock('nunjucks')

describe('mojDatePicker', () => {
  setupComponentTest()

  const helper = new MojComponentTestHelper(mojDatePicker)

  describe('Data transformation', () => {
    it('should set default id and name from code', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Date',
      })

      // Assert
      expect(params.id).toBe('appointment-date')
      expect(params.name).toBe('appointment-date')
    })

    it('should use custom id when provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        code: 'appointment-date',
        id: 'custom-id',
        label: 'Date',
      })

      // Assert
      expect(params.id).toBe('custom-id')
      expect(params.name).toBe('appointment-date')
    })

    it('should pass through value', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Date',
        value: '25/12/2025',
      })

      // Assert
      expect(params.value).toBe('25/12/2025')
    })
  })

  describe('Label transformation', () => {
    it('should convert string label to object format', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Select a date',
      })

      // Assert
      expect(params.label).toEqual({ text: 'Select a date' })
    })

    it('should pass through object label unchanged', async () => {
      // Arrange
      const labelObj = {
        text: 'Appointment date',
        classes: 'govuk-label--l',
        isPageHeading: true,
      }

      // Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: labelObj,
      })

      // Assert
      expect(params.label).toEqual(labelObj)
    })
  })

  describe('Hint transformation', () => {
    it('should convert string hint to object format', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Date',
        hint: 'For example, 17/5/2024',
      })

      // Assert
      expect(params.hint).toEqual({ text: 'For example, 17/5/2024' })
    })

    it('should pass through object hint unchanged', async () => {
      // Arrange
      const hintObj = {
        text: 'Enter date in dd/mm/yyyy format',
        classes: 'custom-hint',
      }

      // Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Date',
        hint: hintObj,
      })

      // Assert
      expect(params.hint).toEqual(hintObj)
    })

    it('should set hint to undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Date',
      })

      // Assert
      expect(params.hint).toBeUndefined()
    })
  })

  describe('Date restriction transformation', () => {
    it('should pass through minDate unchanged', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Date',
        minDate: '01/04/2025',
      })

      // Assert
      expect(params.minDate).toBe('01/04/2025')
    })

    it('should pass through maxDate unchanged', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Date',
        maxDate: '30/04/2025',
      })

      // Assert
      expect(params.maxDate).toBe('30/04/2025')
    })

    it('should convert excludedDates array to space-separated string', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Date',
        excludedDates: ['02/04/2025', '18/04/2025', '25/04/2025'],
      })

      // Assert
      expect(params.excludedDates).toBe('02/04/2025 18/04/2025 25/04/2025')
    })

    it('should convert excludedDays array to space-separated string', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Date',
        excludedDays: ['saturday', 'sunday'],
      })

      // Assert
      expect(params.excludedDays).toBe('saturday sunday')
    })

    it('should handle single excludedDay', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Date',
        excludedDays: ['sunday'],
      })

      // Assert
      expect(params.excludedDays).toBe('sunday')
    })

    it('should set excludedDates to undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Date',
      })

      // Assert
      expect(params.excludedDates).toBeUndefined()
    })

    it('should set excludedDays to undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Date',
      })

      // Assert
      expect(params.excludedDays).toBeUndefined()
    })

    it('should pass through weekStartDay', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Date',
        weekStartDay: 'sunday',
      })

      // Assert
      expect(params.weekStartDay).toBe('sunday')
    })
  })

  describe('Error message transformation', () => {
    it('should transform error array to error message object', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Date',
        errors: [{ message: 'Enter a valid date' }],
      })

      // Assert
      expect(params.errorMessage).toEqual({ text: 'Enter a valid date' })
    })

    it('should use first error when multiple provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Date',
        errors: [{ message: 'First error' }, { message: 'Second error' }],
      })

      // Assert
      expect(params.errorMessage).toEqual({ text: 'First error' })
    })

    it('should set errorMessage to undefined when no errors', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Date',
      })

      // Assert
      expect(params.errorMessage).toBeUndefined()
    })
  })

  describe('Additional options', () => {
    it('should pass through formGroup options', async () => {
      // Arrange
      const formGroup = {
        classes: 'custom-form-group',
        attributes: { 'data-testid': 'form-group' },
      }

      // Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Date',
        formGroup,
      })

      // Assert
      expect(params.formGroup).toEqual(formGroup)
    })

    it('should pass through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Date',
        classes: 'custom-class',
      })

      // Assert
      expect(params.classes).toBe('custom-class')
    })

    it('should pass through attributes', async () => {
      // Arrange
      const attributes = {
        'data-testid': 'date-picker',
        'aria-label': 'Select appointment date',
      }

      // Act
      const params = await helper.getParams({
        code: 'appointment-date',
        label: 'Date',
        attributes,
      })

      // Assert
      expect(params.attributes).toEqual(attributes)
    })
  })

  describe('Template and context', () => {
    it('should call nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        code: 'appointment-date',
        label: 'Date',
      })

      // Assert
      expect(template).toBe('moj/components/date-picker/template.njk')
    })

    it('should wrap params in context object', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        code: 'appointment-date',
        label: 'Date',
      })

      // Assert
      expect(context).toHaveProperty('params')
      expect((context as { params: Record<string, any> }).params).toHaveProperty('id')
      expect((context as { params: Record<string, any> }).params).toHaveProperty('name')
    })
  })
})
