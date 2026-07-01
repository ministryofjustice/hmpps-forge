import { z } from 'zod'
import ConditionRegistry from '../registries/ConditionRegistry'
import type { ResolvableValue } from '../types/expressions.type'

const stringSchema = z.string()
const nonNegativeNumberArgsSchema = z.tuple([z.number().nonnegative()])

const stringConditions = new ConditionRegistry()

export const StringConditions = {
  /** Checks if a string matches a regular expression pattern */
  MatchesRegex: stringConditions.register(
    'String.MatchesRegex',
    {
      inputSchema: stringSchema,
    },
    () => (value: string, pattern: ResolvableValue) => {
      try {
        return new RegExp(String(pattern)).test(value)
      } catch {
        throw new Error(`Condition.String.MatchesRegex: Invalid regex pattern "${pattern}"`)
      }
    },
  ),

  /** Checks if a string has at least the minimum specified length */
  HasMinLength: stringConditions.register(
    'String.HasMinLength',
    {
      inputSchema: stringSchema,
      argumentsSchema: nonNegativeNumberArgsSchema,
    },
    () => (value: string, min: number) => value.length >= Number(min),
  ),

  /** Checks if a string does not exceed the maximum specified length */
  HasMaxLength: stringConditions.register(
    'String.HasMaxLength',
    {
      inputSchema: stringSchema,
      argumentsSchema: nonNegativeNumberArgsSchema,
    },
    () => (value: string, max: number) => value.length <= Number(max),
  ),

  /** Checks if a string has exactly the specified length */
  HasExactLength: stringConditions.register(
    'String.HasExactLength',
    {
      inputSchema: stringSchema,
      argumentsSchema: nonNegativeNumberArgsSchema,
    },
    () => (value: string, len: number) => value.length === Number(len),
  ),

  /** Checks if a string contains at most the specified number of words */
  HasMaxWords: stringConditions.register(
    'String.HasMaxWords',
    {
      inputSchema: stringSchema,
      argumentsSchema: nonNegativeNumberArgsSchema,
    },
    () => (value: string, maxWords: number) => {
      const max = Number(maxWords)
      const trimmed = value.trim()

      if (trimmed === '') {
        return max >= 0
      }

      return trimmed.split(/\s+/).length <= max
    },
  ),

  /** Contains only letters (A-Z, a-z) */
  LettersOnly: stringConditions.register(
    'String.LettersOnly',
    {
      inputSchema: stringSchema,
    },
    () => (value: string) => /^[A-Za-z]+$/.test(value),
  ),

  /** Contains only digits (0-9) */
  DigitsOnly: stringConditions.register(
    'String.DigitsOnly',
    {
      inputSchema: stringSchema,
    },
    () => (value: string) => /^[0-9]+$/.test(value),
  ),

  /** Contains only letters and common punctuation */
  LettersWithCommonPunctuation: stringConditions.register(
    'String.LettersWithCommonPunctuation',
    {
      inputSchema: stringSchema,
    },
    () => (value: string) => /^[A-Za-z.,'"()\-!? ]+$/.test(value),
  ),

  /** Contains only letters, spaces, dashes, and apostrophes */
  LettersWithSpaceDashApostrophe: stringConditions.register(
    'String.LettersWithSpaceDashApostrophe',
    {
      inputSchema: stringSchema,
    },
    () => (value: string) => /^[A-Za-z\s\-']+$/.test(value),
  ),

  /** Contains only letters and digits (alphanumeric) */
  LettersAndDigitsOnly: stringConditions.register(
    'String.LettersAndDigitsOnly',
    {
      inputSchema: stringSchema,
    },
    () => (value: string) => /^[A-Za-z0-9]+$/.test(value),
  ),

  /** Contains only alphanumeric characters and common punctuation */
  AlphanumericWithCommonPunctuation: stringConditions.register(
    'String.AlphanumericWithCommonPunctuation',
    {
      inputSchema: stringSchema,
    },
    () => (value: string) => /^[A-Za-z0-9.,'"()\-!? ]+$/.test(value),
  ),

  /** Contains only alphanumeric characters and safe symbols */
  AlphanumericWithAllSafeSymbols: stringConditions.register(
    'String.AlphanumericWithAllSafeSymbols',
    {
      inputSchema: stringSchema,
    },
    () => (value: string) => /^[A-Za-z0-9 .,;:'"()\-!?@#$%^&*]+$/.test(value),
  ),

  /** Checks if a string starts with the specified prefix */
  StartsWith: stringConditions.register(
    'String.StartsWith',
    {
      inputSchema: stringSchema,
    },
    () => (value: string, prefix: ResolvableValue) => value.startsWith(String(prefix)),
  ),

  /** Checks if a string ends with the specified suffix */
  EndsWith: stringConditions.register(
    'String.EndsWith',
    {
      inputSchema: stringSchema,
    },
    () => (value: string, suffix: ResolvableValue) => value.endsWith(String(suffix)),
  ),

  /** Checks if a string contains the specified substring */
  Contains: stringConditions.register(
    'String.Contains',
    {
      inputSchema: stringSchema,
    },
    () => (value: string, substring: ResolvableValue) => value.includes(String(substring)),
  ),
}

export { stringConditions as stringConditionsRegistry }
