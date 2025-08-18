import { buildConditionFunction } from '../helpers/createRegisterableFunction'
import { assertDate, assertNumber } from './asserts'

export default {
  /**
   * Validates if a number represents a valid year (1000-9999)
   * @param value - The number to validate as a year
   * @returns true if the value is a valid year
   */
  IsValidYear: buildConditionFunction('dateIsValidYear', value => {
    assertNumber(value, 'Condition.Date.IsValidMonth')

    // I really hope this doesn't live till 9999
    return Number.isInteger(value) && value >= 1000 && value <= 9999
  }),

  /**
   * Validates if a number represents a valid month (1-12)
   * @param value - The number to validate as a month
   * @returns true if the value is a valid month
   */
  IsValidMonth: buildConditionFunction('dateIsValidMonth', value => {
    assertNumber(value, 'Condition.Date.IsValidMonth')

    return Number.isInteger(value) && value >= 1 && value <= 12
  }),

  /**
   * Validates if a number represents a valid day of month (1-31)
   * @param value - The number to validate as a day
   * @returns true if the value is a valid day
   */
  IsValidDay: buildConditionFunction('dateIsValidDay', value => {
    assertNumber(value, 'Condition.Date.IsValidDay')

    return Number.isInteger(value) && value >= 1 && value <= 31
  }),

  /**
   * Checks if a date is before another date
   * @param value - The date to test
   * @param dateStr - The comparison date as a string
   * @returns true if value is before the comparison date
   */
  IsBefore: buildConditionFunction('isDateBefore', (value, dateStr: string) => {
    assertDate(value, 'Condition.Date.IsBefore')

    const compareDate = new Date(dateStr)
    if (Number.isNaN(compareDate.getTime())) {
      throw new Error(`Condition.Date.IsBefore: Invalid comparison date string "${dateStr}"`)
    }
    return value < compareDate
  }),

  /**
   * Checks if a date is after another date
   * @param value - The date to test
   * @param dateStr - The comparison date as a string
   * @returns true if value is after the comparison date
   */
  IsAfter: buildConditionFunction('isDateAfter', (value, dateStr: string) => {
    assertDate(value, 'Condition.Date.IsAfter')

    const compareDate = new Date(dateStr)
    if (Number.isNaN(compareDate.getTime())) {
      throw new Error(`Condition.Date.IsAfter: Invalid comparison date string "${dateStr}"`)
    }
    return value > compareDate
  }),
}
