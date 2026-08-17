import { z } from 'zod'
import ConditionRegistry from '../../../authoring/registries/ConditionRegistry'

const stringSchema = z.string()
const stringArgsSchema = z.tuple([z.string()])
const nonNegativeNumberArgsSchema = z.tuple([z.number().nonnegative()])

const stringConditions = new ConditionRegistry()

export const StringConditions = {
  /** Checks if a string matches a regular expression pattern */
  MatchesRegex: stringConditions.register('String.MatchesRegex', {
    inputSchema: stringSchema,
    argumentsSchema: stringArgsSchema,
    factory: () => (value: string, pattern: string) => {
      try {
        return new RegExp(pattern).test(value)
      } catch {
        throw new Error(`Condition.String.MatchesRegex: Invalid regex pattern "${pattern}"`)
      }
    },
  }),

  /** Checks if a string has at least the minimum specified length */
  HasMinLength: stringConditions.register('String.HasMinLength', {
    inputSchema: stringSchema,
    argumentsSchema: nonNegativeNumberArgsSchema,
    factory: () => (value: string, min: number) => value.length >= min,
  }),

  /** Checks if a string does not exceed the maximum specified length */
  HasMaxLength: stringConditions.register('String.HasMaxLength', {
    inputSchema: stringSchema,
    argumentsSchema: nonNegativeNumberArgsSchema,
    factory: () => (value: string, max: number) => value.length <= max,
  }),

  /** Checks if a string has exactly the specified length */
  HasExactLength: stringConditions.register('String.HasExactLength', {
    inputSchema: stringSchema,
    argumentsSchema: nonNegativeNumberArgsSchema,
    factory: () => (value: string, len: number) => value.length === len,
  }),

  /** Checks if a string contains at most the specified number of words */
  HasMaxWords: stringConditions.register('String.HasMaxWords', {
    inputSchema: stringSchema,
    argumentsSchema: nonNegativeNumberArgsSchema,
    factory: () => (value: string, maxWords: number) => {
      const trimmed = value.trim()

      if (trimmed === '') {
        return maxWords >= 0
      }

      return trimmed.split(/\s+/).length <= maxWords
    },
  }),

  /** Contains only letters (A-Z, a-z) */
  LettersOnly: stringConditions.register('String.LettersOnly', {
    inputSchema: stringSchema,
    factory: () => (value: string) => /^[A-Za-z]+$/.test(value),
  }),

  /** Contains only digits (0-9) */
  DigitsOnly: stringConditions.register('String.DigitsOnly', {
    inputSchema: stringSchema,
    factory: () => (value: string) => /^[0-9]+$/.test(value),
  }),

  /** Contains only letters and common punctuation */
  LettersWithCommonPunctuation: stringConditions.register('String.LettersWithCommonPunctuation', {
    inputSchema: stringSchema,
    factory: () => (value: string) => /^[A-Za-z.,'"()\-!? ]+$/.test(value),
  }),

  /** Contains only letters, spaces, dashes, and apostrophes */
  LettersWithSpaceDashApostrophe: stringConditions.register('String.LettersWithSpaceDashApostrophe', {
    inputSchema: stringSchema,
    factory: () => (value: string) => /^[A-Za-z\s\-']+$/.test(value),
  }),

  /** Contains only letters and digits (alphanumeric) */
  LettersAndDigitsOnly: stringConditions.register('String.LettersAndDigitsOnly', {
    inputSchema: stringSchema,
    factory: () => (value: string) => /^[A-Za-z0-9]+$/.test(value),
  }),

  /** Contains only alphanumeric characters and common punctuation */
  AlphanumericWithCommonPunctuation: stringConditions.register('String.AlphanumericWithCommonPunctuation', {
    inputSchema: stringSchema,
    factory: () => (value: string) => /^[A-Za-z0-9.,'"()\-!? ]+$/.test(value),
  }),

  /** Contains only alphanumeric characters and safe symbols */
  AlphanumericWithAllSafeSymbols: stringConditions.register('String.AlphanumericWithAllSafeSymbols', {
    inputSchema: stringSchema,
    factory: () => (value: string) => /^[A-Za-z0-9 .,;:'"()\-!?@#$%^&*]+$/.test(value),
  }),

  /** Checks if a string starts with the specified prefix */
  StartsWith: stringConditions.register('String.StartsWith', {
    inputSchema: stringSchema,
    argumentsSchema: stringArgsSchema,
    factory: () => (value: string, prefix: string) => value.startsWith(prefix),
  }),

  /** Checks if a string ends with the specified suffix */
  EndsWith: stringConditions.register('String.EndsWith', {
    inputSchema: stringSchema,
    argumentsSchema: stringArgsSchema,
    factory: () => (value: string, suffix: string) => value.endsWith(suffix),
  }),

  /** Checks if a string contains the specified substring */
  Contains: stringConditions.register('String.Contains', {
    inputSchema: stringSchema,
    argumentsSchema: stringArgsSchema,
    factory: () => (value: string, substring: string) => value.includes(substring),
  }),
}

export { stringConditions as stringConditionsRegistry }
