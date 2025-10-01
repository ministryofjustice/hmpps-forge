import { assertString } from '@form-engine/registry/utils/asserts'
import { defineConditions } from '@form-engine/registry/utils/createRegisterableFunction'

export const { conditions: StringConditions, registry: StringConditionsRegistry } = defineConditions({
  /**
   * Checks if a string matches a regular expression pattern
   * @param value - The string to test
   * @param pattern - The regex pattern to match against
   * @returns true if the string matches the pattern
   */
  MatchesRegex: (value, pattern: string) => {
    assertString(value, 'Condition.String.MatchesRegex')

    try {
      return new RegExp(pattern).test(value)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      throw new Error(`Condition.String.MatchesRegex: Invalid regex pattern "${pattern}"`)
    }
  },

  /**
   * Checks if a string has at least the minimum specified length
   * @param value - The string to test
   * @param min - The minimum length required
   * @returns true if the string length is >= min
   */
  HasMinLength: (value, min: number) => {
    assertString(value, 'Condition.String.HasMinLength')

    if (typeof min !== 'number' || min < 0) {
      throw new Error('Condition.String.HasMinLength: min must be a non-negative number')
    }

    return value.length >= min
  },

  /**
   * Checks if a string does not exceed the maximum specified length
   * @param value - The string to test
   * @param max - The maximum length allowed
   * @returns true if the string length is <= max
   */
  HasMaxLength: (value, max: number) => {
    assertString(value, 'Condition.String.HasMaxLength')

    if (typeof max !== 'number' || max < 0) {
      throw new Error('Condition.String.HasMaxLength: max must be a non-negative number')
    }

    return value.length <= max
  },

  /**
   * Checks if a string has exactly the specified length
   * @param value - The string to test
   * @param len - The exact length required
   * @returns true if the string length equals len
   */
  HasExactLength: (value, len: number) => {
    assertString(value, 'Condition.String.HasExactLength')

    if (typeof len !== 'number' || len < 0) {
      throw new Error('Condition.String.HasExactLength: len must be a non-negative number')
    }

    return value.length === len
  },

  /**
   * Checks if a string contains at most the specified number of words
   * @param value - The string to test
   * @param maxWords - The maximum number of words allowed
   * @returns true if the word count is <= maxWords
   */
  HasMaxWords: (value, maxWords: number) => {
    assertString(value, 'Condition.String.HasMaxWords')

    if (typeof maxWords !== 'number' || maxWords < 0) {
      throw new Error('Condition.String.HasMaxWords: maxWords must be a non-negative number')
    }

    const trimmed = value.trim()
    if (trimmed === '') {
      return maxWords >= 0
    }

    return trimmed.split(/\s+/).length <= maxWords
  },

  /**
   * Checks if a string contains only letters (A-Z, a-z)
   * @param value - The string to test
   * @returns true if the string contains only letters
   */
  LettersOnly: value => {
    assertString(value, 'Condition.String.LettersOnly')
    return /^[A-Za-z]+$/.test(value)
  },

  /**
   * Checks if a string contains only digits (0-9)
   * @param value - The string to test
   * @returns true if the string contains only digits
   */
  DigitsOnly: value => {
    assertString(value, 'Condition.String.DigitsOnly')
    return /^[0-9]+$/.test(value)
  },

  /**
   * Checks if a string contains only letters and common punctuation marks
   * Allowed: A-Z, a-z, . , ' " ( ) - ! ? and space
   * @param value - The string to test
   * @returns true if the string contains only allowed characters
   */
  LettersWithCommonPunctuation: value => {
    assertString(value, 'Condition.String.LettersWithCommonPunctuation')
    return /^[A-Za-z.,'"()\-!? ]+$/.test(value)
  },

  /**
   * Checks if a string contains only letters, spaces, dashes, and apostrophes
   * Useful for validating names
   * @param value - The string to test
   * @returns true if the string contains only allowed characters
   */
  LettersWithSpaceDashApostrophe: value => {
    assertString(value, 'Condition.String.LettersWithSpaceDashApostrophe')
    return /^[A-Za-z\s\-']+$/.test(value)
  },

  /**
   * Checks if a string contains only letters and digits (alphanumeric)
   * @param value - The string to test
   * @returns true if the string is alphanumeric
   */
  LettersAndDigitsOnly: value => {
    assertString(value, 'Condition.String.LettersAndDigitsOnly')
    return /^[A-Za-z0-9]+$/.test(value)
  },

  /**
   * Checks if a string contains only alphanumeric characters and common punctuation
   * Allowed: A-Z, a-z, 0-9, . , ' " ( ) - ! ? and space
   * @param value - The string to test
   * @returns true if the string contains only allowed characters
   */
  AlphanumericWithCommonPunctuation: value => {
    assertString(value, 'Condition.String.AlphanumericWithCommonPunctuation')
    return /^[A-Za-z0-9.,'"()\-!? ]+$/.test(value)
  },

  /**
   * Checks if a string contains only alphanumeric characters and safe symbols
   * Allowed: A-Z, a-z, 0-9, space, and . , ; : ' " ( ) - ! ? @ # $ % ^ & *
   * @param value - The string to test
   * @returns true if the string contains only allowed characters
   */
  AlphanumericWithAllSafeSymbols: value => {
    assertString(value, 'Condition.String.AlphanumericWithAllSafeSymbols')
    return /^[A-Za-z0-9 .,;:'"()\-!?@#$%^&*]+$/.test(value)
  },
})
