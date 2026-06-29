import { assertNumber, assertString, isAbsent } from '../../shared/utils/asserts'
import { defineConditionFunctions } from '../utils/defineConditionFunctions'
import { ConditionFunctionExpr, ResolvableValue } from '../types/expressions.type'

/**
 * String conditions for text validation and pattern matching
 *
 * All config arguments accept both static values and expressions:
 * - Static: Condition.String.HasMinLength(5)
 * - Dynamic: Condition.String.HasMinLength(Answer('requiredLength'))
 */
export interface StringConditionGroup {
  /**
   * Checks if a string matches a regular expression pattern
   * @param pattern - The regex pattern to match against
   * @returns true if the string matches the pattern
   */
  MatchesRegex: (pattern: ResolvableValue) => ConditionFunctionExpr

  /**
   * Checks if a string has at least the minimum specified length
   * @param min - The minimum length required
   * @returns true if the string length is >= min
   */
  HasMinLength: (min: ResolvableValue) => ConditionFunctionExpr

  /**
   * Checks if a string does not exceed the maximum specified length
   * @param max - The maximum length allowed
   * @returns true if the string length is <= max
   */
  HasMaxLength: (max: ResolvableValue) => ConditionFunctionExpr

  /**
   * Checks if a string has exactly the specified length
   * @param len - The exact length required
   * @returns true if the string length equals len
   */
  HasExactLength: (len: ResolvableValue) => ConditionFunctionExpr

  /**
   * Checks if a string contains at most the specified number of words
   * @param maxWords - The maximum number of words allowed
   * @returns true if the word count is <= maxWords
   */
  HasMaxWords: (maxWords: ResolvableValue) => ConditionFunctionExpr

  /**
   * Checks if a string contains only letters (A-Z, a-z)
   * @returns true if the string contains only letters
   */
  LettersOnly: () => ConditionFunctionExpr

  /**
   * Checks if a string contains only digits (0-9)
   * @returns true if the string contains only digits
   */
  DigitsOnly: () => ConditionFunctionExpr

  /**
   * Checks if a string contains only letters and common punctuation marks
   * Allowed: A-Z, a-z, . , ' " ( ) - ! ? and space
   * @returns true if the string contains only allowed characters
   */
  LettersWithCommonPunctuation: () => ConditionFunctionExpr

  /**
   * Checks if a string contains only letters, spaces, dashes, and apostrophes
   * Useful for validating names
   * @returns true if the string contains only allowed characters
   */
  LettersWithSpaceDashApostrophe: () => ConditionFunctionExpr

  /**
   * Checks if a string contains only letters and digits (alphanumeric)
   * @returns true if the string is alphanumeric
   */
  LettersAndDigitsOnly: () => ConditionFunctionExpr

  /**
   * Checks if a string contains only alphanumeric characters and common punctuation
   * Allowed: A-Z, a-z, 0-9, . , ' " ( ) - ! ? and space
   * @returns true if the string contains only allowed characters
   */
  AlphanumericWithCommonPunctuation: () => ConditionFunctionExpr

  /**
   * Checks if a string contains only alphanumeric characters and safe symbols
   * Allowed: A-Z, a-z, 0-9, space, and . , ; : ' " ( ) - ! ? @ # $ % ^ & *
   * @returns true if the string contains only allowed characters
   */
  AlphanumericWithAllSafeSymbols: () => ConditionFunctionExpr

  /**
   * Checks if a string starts with the specified prefix
   * @param prefix - The prefix to check for
   * @returns true if the string starts with the prefix
   */
  StartsWith: (prefix: ResolvableValue) => ConditionFunctionExpr

  /**
   * Checks if a string ends with the specified suffix
   * @param suffix - The suffix to check for
   * @returns true if the string ends with the suffix
   */
  EndsWith: (suffix: ResolvableValue) => ConditionFunctionExpr

  /**
   * Checks if a string contains the specified substring
   * @param substring - The substring to check for
   * @returns true if the string contains the substring
   */
  Contains: (substring: ResolvableValue) => ConditionFunctionExpr
}

export const { conditions: StringConditions, implementations: StringConditionsImplementations } =
  defineConditionFunctions<StringConditionGroup>({
    MatchesRegex: () => (value: unknown, pattern: ResolvableValue) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.String.MatchesRegex')
      assertString(pattern, 'Condition.String.MatchesRegex (pattern)')

      try {
        return new RegExp(pattern).test(value)
      } catch {
        throw new Error(`Condition.String.MatchesRegex: Invalid regex pattern "${pattern}"`)
      }
    },

    HasMinLength: () => (value: unknown, min: ResolvableValue) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.String.HasMinLength')
      assertNumber(min, 'Condition.String.HasMinLength (min)')

      if (min < 0) {
        throw new Error('Condition.String.HasMinLength: min must be a non-negative number')
      }

      return value.length >= min
    },

    HasMaxLength: () => (value: unknown, max: ResolvableValue) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.String.HasMaxLength')
      assertNumber(max, 'Condition.String.HasMaxLength (max)')

      if (max < 0) {
        throw new Error('Condition.String.HasMaxLength: max must be a non-negative number')
      }

      return value.length <= max
    },

    HasExactLength: () => (value: unknown, len: ResolvableValue) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.String.HasExactLength')
      assertNumber(len, 'Condition.String.HasExactLength (len)')

      if (len < 0) {
        throw new Error('Condition.String.HasExactLength: len must be a non-negative number')
      }

      return value.length === len
    },

    HasMaxWords: () => (value: unknown, maxWords: ResolvableValue) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.String.HasMaxWords')
      assertNumber(maxWords, 'Condition.String.HasMaxWords (maxWords)')

      if (maxWords < 0) {
        throw new Error('Condition.String.HasMaxWords: maxWords must be a non-negative number')
      }

      const trimmed = value.trim()
      if (trimmed === '') {
        return maxWords >= 0
      }

      return trimmed.split(/\s+/).length <= maxWords
    },

    LettersOnly: () => (value: unknown) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.String.LettersOnly')
      return /^[A-Za-z]+$/.test(value)
    },

    DigitsOnly: () => (value: unknown) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.String.DigitsOnly')
      return /^[0-9]+$/.test(value)
    },

    LettersWithCommonPunctuation: () => (value: unknown) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.String.LettersWithCommonPunctuation')
      return /^[A-Za-z.,'"()\-!? ]+$/.test(value)
    },

    LettersWithSpaceDashApostrophe: () => (value: unknown) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.String.LettersWithSpaceDashApostrophe')
      return /^[A-Za-z\s\-']+$/.test(value)
    },

    LettersAndDigitsOnly: () => (value: unknown) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.String.LettersAndDigitsOnly')
      return /^[A-Za-z0-9]+$/.test(value)
    },

    AlphanumericWithCommonPunctuation: () => (value: unknown) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.String.AlphanumericWithCommonPunctuation')
      return /^[A-Za-z0-9.,'"()\-!? ]+$/.test(value)
    },

    AlphanumericWithAllSafeSymbols: () => (value: unknown) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.String.AlphanumericWithAllSafeSymbols')
      return /^[A-Za-z0-9 .,;:'"()\-!?@#$%^&*]+$/.test(value)
    },

    StartsWith: () => (value: unknown, prefix: ResolvableValue) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.String.StartsWith')
      assertString(prefix, 'Condition.String.StartsWith (prefix)')
      return value.startsWith(prefix)
    },

    EndsWith: () => (value: unknown, suffix: ResolvableValue) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.String.EndsWith')
      assertString(suffix, 'Condition.String.EndsWith (suffix)')
      return value.endsWith(suffix)
    },

    Contains: () => (value: unknown, substring: ResolvableValue) => {
      if (isAbsent(value)) {
        return false
      }

      assertString(value, 'Condition.String.Contains')
      assertString(substring, 'Condition.String.Contains (substring)')
      return value.includes(substring)
    },
  })

export const StringConditionsRegistry = StringConditionsImplementations
