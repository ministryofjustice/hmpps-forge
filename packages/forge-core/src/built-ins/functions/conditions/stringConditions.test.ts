import { StringConditions, stringConditionsRegistry } from './stringConditions'
import { FunctionType } from '../../../authoring/types/enums'
import { FunctionRegistryTestHarness } from '../../../testing/functions/FunctionRegistryTestHarness'

describe('StringConditions', () => {
  const harness = new FunctionRegistryTestHarness(stringConditionsRegistry)

  describe('MatchesRegex', () => {
    test('should return true when string matches regex pattern', () => {
      expect(harness.evaluate(StringConditions.MatchesRegex('h.*o')).withInput('hello')).toBe(true)
      expect(harness.evaluate(StringConditions.MatchesRegex('.*@.*\\.com')).withInput('test@example.com')).toBe(true)
      expect(harness.evaluate(StringConditions.MatchesRegex('^\\d+$')).withInput('123')).toBe(true)
    })

    test('should return false when string does not match regex pattern', () => {
      expect(harness.evaluate(StringConditions.MatchesRegex('^world$')).withInput('hello')).toBe(false)
      expect(harness.evaluate(StringConditions.MatchesRegex('^\\d+$')).withInput('abc')).toBe(false)
    })

    test('should throw error for invalid regex pattern', () => {
      expect(() => harness.evaluate(StringConditions.MatchesRegex('[[')).withInput('test')).toThrow(
        'Condition.String.MatchesRegex: Invalid regex pattern',
      )
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.MatchesRegex('h.*o')
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'String.MatchesRegex',
        arguments: ['h.*o'],
      })
    })
  })

  describe('HasMinLength', () => {
    test('should return true when string length is greater than or equal to min', () => {
      expect(harness.evaluate(StringConditions.HasMinLength(3)).withInput('hello')).toBe(true)
      expect(harness.evaluate(StringConditions.HasMinLength(5)).withInput('hello')).toBe(true)
      expect(harness.evaluate(StringConditions.HasMinLength(0)).withInput('')).toBe(true)
    })

    test('should return false when string length is less than min', () => {
      expect(harness.evaluate(StringConditions.HasMinLength(3)).withInput('hi')).toBe(false)
      expect(harness.evaluate(StringConditions.HasMinLength(1)).withInput('')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.HasMinLength(5)
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'String.HasMinLength',
        arguments: [5],
      })
    })
  })

  describe('HasMaxLength', () => {
    test('should return true when string length is less than or equal to max', () => {
      expect(harness.evaluate(StringConditions.HasMaxLength(10)).withInput('hello')).toBe(true)
      expect(harness.evaluate(StringConditions.HasMaxLength(5)).withInput('hello')).toBe(true)
      expect(harness.evaluate(StringConditions.HasMaxLength(0)).withInput('')).toBe(true)
    })

    test('should return false when string length is greater than max', () => {
      expect(harness.evaluate(StringConditions.HasMaxLength(3)).withInput('hello')).toBe(false)
      expect(harness.evaluate(StringConditions.HasMaxLength(0)).withInput('x')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.HasMaxLength(10)
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'String.HasMaxLength',
        arguments: [10],
      })
    })
  })

  describe('HasExactLength', () => {
    test('should return true when string length equals the specified length', () => {
      expect(harness.evaluate(StringConditions.HasExactLength(5)).withInput('hello')).toBe(true)
      expect(harness.evaluate(StringConditions.HasExactLength(0)).withInput('')).toBe(true)
      expect(harness.evaluate(StringConditions.HasExactLength(2)).withInput('ab')).toBe(true)
    })

    test('should return false when string length does not equal the specified length', () => {
      expect(harness.evaluate(StringConditions.HasExactLength(4)).withInput('hello')).toBe(false)
      expect(harness.evaluate(StringConditions.HasExactLength(6)).withInput('hello')).toBe(false)
      expect(harness.evaluate(StringConditions.HasExactLength(1)).withInput('')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.HasExactLength(8)
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'String.HasExactLength',
        arguments: [8],
      })
    })
  })

  describe('HasMaxWords', () => {
    test('should return true when word count is less than or equal to max', () => {
      expect(harness.evaluate(StringConditions.HasMaxWords(2)).withInput('hello world')).toBe(true)
      expect(harness.evaluate(StringConditions.HasMaxWords(3)).withInput('hello world')).toBe(true)
      expect(harness.evaluate(StringConditions.HasMaxWords(1)).withInput('one')).toBe(true)
      expect(harness.evaluate(StringConditions.HasMaxWords(0)).withInput('')).toBe(true)
      expect(harness.evaluate(StringConditions.HasMaxWords(1)).withInput('')).toBe(true)
      expect(harness.evaluate(StringConditions.HasMaxWords(0)).withInput('  ')).toBe(true)
    })

    test('should return false when word count exceeds max', () => {
      expect(harness.evaluate(StringConditions.HasMaxWords(2)).withInput('hello world test')).toBe(false)
      expect(harness.evaluate(StringConditions.HasMaxWords(0)).withInput('one')).toBe(false)
    })

    test('should handle multiple spaces correctly', () => {
      expect(harness.evaluate(StringConditions.HasMaxWords(2)).withInput('hello   world')).toBe(true)
      expect(harness.evaluate(StringConditions.HasMaxWords(2)).withInput('  hello  world  ')).toBe(true)
      expect(harness.evaluate(StringConditions.HasMaxWords(4)).withInput('one  two  three  four')).toBe(true)
      expect(harness.evaluate(StringConditions.HasMaxWords(3)).withInput('one  two  three  four')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.HasMaxWords(100)
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'String.HasMaxWords',
        arguments: [100],
      })
    })
  })

  describe('LettersOnly', () => {
    test('should return true for strings with only letters', () => {
      expect(harness.evaluate(StringConditions.LettersOnly()).withInput('hello')).toBe(true)
      expect(harness.evaluate(StringConditions.LettersOnly()).withInput('HelloWorld')).toBe(true)
      expect(harness.evaluate(StringConditions.LettersOnly()).withInput('ABC')).toBe(true)
      expect(harness.evaluate(StringConditions.LettersOnly()).withInput('xyz')).toBe(true)
    })

    test('should return false for strings with non-letter characters', () => {
      expect(harness.evaluate(StringConditions.LettersOnly()).withInput('hello123')).toBe(false)
      expect(harness.evaluate(StringConditions.LettersOnly()).withInput('hello world')).toBe(false)
      expect(harness.evaluate(StringConditions.LettersOnly()).withInput('hello!')).toBe(false)
      expect(harness.evaluate(StringConditions.LettersOnly()).withInput('')).toBe(false)
      expect(harness.evaluate(StringConditions.LettersOnly()).withInput('123')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.LettersOnly()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'String.LettersOnly',
        arguments: [],
      })
    })
  })

  describe('DigitsOnly', () => {
    test('should return true for strings with only digits', () => {
      expect(harness.evaluate(StringConditions.DigitsOnly()).withInput('123')).toBe(true)
      expect(harness.evaluate(StringConditions.DigitsOnly()).withInput('0')).toBe(true)
      expect(harness.evaluate(StringConditions.DigitsOnly()).withInput('999999')).toBe(true)
    })

    test('should return false for strings with non-digit characters', () => {
      expect(harness.evaluate(StringConditions.DigitsOnly()).withInput('123abc')).toBe(false)
      expect(harness.evaluate(StringConditions.DigitsOnly()).withInput('12.34')).toBe(false)
      expect(harness.evaluate(StringConditions.DigitsOnly()).withInput('12 34')).toBe(false)
      expect(harness.evaluate(StringConditions.DigitsOnly()).withInput('')).toBe(false)
      expect(harness.evaluate(StringConditions.DigitsOnly()).withInput('-123')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.DigitsOnly()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'String.DigitsOnly',
        arguments: [],
      })
    })
  })

  describe('LettersWithCommonPunctuation', () => {
    test('should return true for letters with allowed punctuation', () => {
      expect(harness.evaluate(StringConditions.LettersWithCommonPunctuation()).withInput('Hello, World!')).toBe(true)
      expect(harness.evaluate(StringConditions.LettersWithCommonPunctuation()).withInput("It's a test.")).toBe(true)
      expect(harness.evaluate(StringConditions.LettersWithCommonPunctuation()).withInput('Question?')).toBe(true)
      expect(harness.evaluate(StringConditions.LettersWithCommonPunctuation()).withInput('(parentheses)')).toBe(true)
      expect(harness.evaluate(StringConditions.LettersWithCommonPunctuation()).withInput('dash-test')).toBe(true)
      expect(harness.evaluate(StringConditions.LettersWithCommonPunctuation()).withInput('"quoted"')).toBe(true)
    })

    test('should return false for strings with disallowed characters', () => {
      expect(harness.evaluate(StringConditions.LettersWithCommonPunctuation()).withInput('hello123')).toBe(false)
      expect(harness.evaluate(StringConditions.LettersWithCommonPunctuation()).withInput('test@email')).toBe(false)
      expect(harness.evaluate(StringConditions.LettersWithCommonPunctuation()).withInput('price$10')).toBe(false)
      expect(harness.evaluate(StringConditions.LettersWithCommonPunctuation()).withInput('')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.LettersWithCommonPunctuation()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'String.LettersWithCommonPunctuation',
        arguments: [],
      })
    })
  })

  describe('LettersWithSpaceDashApostrophe', () => {
    test('should return true for letters with space, dash, and apostrophe', () => {
      expect(harness.evaluate(StringConditions.LettersWithSpaceDashApostrophe()).withInput('Hello World')).toBe(true)
      expect(harness.evaluate(StringConditions.LettersWithSpaceDashApostrophe()).withInput("O'Connor")).toBe(true)
      expect(harness.evaluate(StringConditions.LettersWithSpaceDashApostrophe()).withInput('Mary-Jane')).toBe(true)
      expect(harness.evaluate(StringConditions.LettersWithSpaceDashApostrophe()).withInput('Smith')).toBe(true)
    })

    test('should return false for strings with other characters', () => {
      expect(harness.evaluate(StringConditions.LettersWithSpaceDashApostrophe()).withInput('Hello!')).toBe(false)
      expect(harness.evaluate(StringConditions.LettersWithSpaceDashApostrophe()).withInput('test123')).toBe(false)
      expect(harness.evaluate(StringConditions.LettersWithSpaceDashApostrophe()).withInput('name@email')).toBe(false)
      expect(harness.evaluate(StringConditions.LettersWithSpaceDashApostrophe()).withInput('')).toBe(false)
      expect(harness.evaluate(StringConditions.LettersWithSpaceDashApostrophe()).withInput('test.')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.LettersWithSpaceDashApostrophe()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'String.LettersWithSpaceDashApostrophe',
        arguments: [],
      })
    })
  })

  describe('LettersAndDigitsOnly', () => {
    test('should return true for alphanumeric strings', () => {
      expect(harness.evaluate(StringConditions.LettersAndDigitsOnly()).withInput('Hello123')).toBe(true)
      expect(harness.evaluate(StringConditions.LettersAndDigitsOnly()).withInput('ABC123')).toBe(true)
      expect(harness.evaluate(StringConditions.LettersAndDigitsOnly()).withInput('test')).toBe(true)
      expect(harness.evaluate(StringConditions.LettersAndDigitsOnly()).withInput('999')).toBe(true)
    })

    test('should return false for strings with non-alphanumeric characters', () => {
      expect(harness.evaluate(StringConditions.LettersAndDigitsOnly()).withInput('hello world')).toBe(false)
      expect(harness.evaluate(StringConditions.LettersAndDigitsOnly()).withInput('test-123')).toBe(false)
      expect(harness.evaluate(StringConditions.LettersAndDigitsOnly()).withInput('hello!')).toBe(false)
      expect(harness.evaluate(StringConditions.LettersAndDigitsOnly()).withInput('')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.LettersAndDigitsOnly()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'String.LettersAndDigitsOnly',
        arguments: [],
      })
    })
  })

  describe('AlphanumericWithCommonPunctuation', () => {
    test('should return true for alphanumeric with allowed punctuation', () => {
      expect(harness.evaluate(StringConditions.AlphanumericWithCommonPunctuation()).withInput('Hello123!')).toBe(true)
      expect(harness.evaluate(StringConditions.AlphanumericWithCommonPunctuation()).withInput('Test, 123.')).toBe(true)
      expect(harness.evaluate(StringConditions.AlphanumericWithCommonPunctuation()).withInput("It's 2024")).toBe(true)
      expect(harness.evaluate(StringConditions.AlphanumericWithCommonPunctuation()).withInput('(123) test')).toBe(true)
      expect(harness.evaluate(StringConditions.AlphanumericWithCommonPunctuation()).withInput('dash-123')).toBe(true)
    })

    test('should return false for strings with disallowed characters', () => {
      expect(harness.evaluate(StringConditions.AlphanumericWithCommonPunctuation()).withInput('test@email')).toBe(false)
      expect(harness.evaluate(StringConditions.AlphanumericWithCommonPunctuation()).withInput('price$10')).toBe(false)
      expect(harness.evaluate(StringConditions.AlphanumericWithCommonPunctuation()).withInput('test#hash')).toBe(false)
      expect(harness.evaluate(StringConditions.AlphanumericWithCommonPunctuation()).withInput('')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.AlphanumericWithCommonPunctuation()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'String.AlphanumericWithCommonPunctuation',
        arguments: [],
      })
    })
  })

  describe('AlphanumericWithAllSafeSymbols', () => {
    test('should return true for alphanumeric with all safe symbols', () => {
      expect(harness.evaluate(StringConditions.AlphanumericWithAllSafeSymbols()).withInput('Hello@123')).toBe(true)
      expect(harness.evaluate(StringConditions.AlphanumericWithAllSafeSymbols()).withInput('Test#$%')).toBe(true)
      expect(harness.evaluate(StringConditions.AlphanumericWithAllSafeSymbols()).withInput('email@test')).toBe(true)
      expect(harness.evaluate(StringConditions.AlphanumericWithAllSafeSymbols()).withInput('100% success!')).toBe(true)
      expect(harness.evaluate(StringConditions.AlphanumericWithAllSafeSymbols()).withInput('(test) & *stars*')).toBe(
        true,
      )
      expect(harness.evaluate(StringConditions.AlphanumericWithAllSafeSymbols()).withInput('price: $10.99')).toBe(true)
    })

    test('should return false for strings with unsafe characters', () => {
      expect(harness.evaluate(StringConditions.AlphanumericWithAllSafeSymbols()).withInput('test<script>')).toBe(false)
      expect(harness.evaluate(StringConditions.AlphanumericWithAllSafeSymbols()).withInput('test\\escape')).toBe(false)
      expect(harness.evaluate(StringConditions.AlphanumericWithAllSafeSymbols()).withInput('test/slash')).toBe(false)
      expect(harness.evaluate(StringConditions.AlphanumericWithAllSafeSymbols()).withInput('')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.AlphanumericWithAllSafeSymbols()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'String.AlphanumericWithAllSafeSymbols',
        arguments: [],
      })
    })
  })

  describe('StartsWith', () => {
    test('should return true when string starts with the prefix', () => {
      expect(harness.evaluate(StringConditions.StartsWith('hello')).withInput('hello world')).toBe(true)
      expect(harness.evaluate(StringConditions.StartsWith('h')).withInput('hello')).toBe(true)
      expect(harness.evaluate(StringConditions.StartsWith('hello')).withInput('hello')).toBe(true)
      expect(harness.evaluate(StringConditions.StartsWith('')).withInput('hello')).toBe(true)
    })

    test('should return false when string does not start with the prefix', () => {
      expect(harness.evaluate(StringConditions.StartsWith('world')).withInput('hello world')).toBe(false)
      expect(harness.evaluate(StringConditions.StartsWith('Hello')).withInput('hello')).toBe(false)
      expect(harness.evaluate(StringConditions.StartsWith('h')).withInput('')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.StartsWith('hello')
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'String.StartsWith',
        arguments: ['hello'],
      })
    })
  })

  describe('EndsWith', () => {
    test('should return true when string ends with the suffix', () => {
      expect(harness.evaluate(StringConditions.EndsWith('world')).withInput('hello world')).toBe(true)
      expect(harness.evaluate(StringConditions.EndsWith('o')).withInput('hello')).toBe(true)
      expect(harness.evaluate(StringConditions.EndsWith('hello')).withInput('hello')).toBe(true)
      expect(harness.evaluate(StringConditions.EndsWith('')).withInput('hello')).toBe(true)
    })

    test('should return false when string does not end with the suffix', () => {
      expect(harness.evaluate(StringConditions.EndsWith('hello')).withInput('hello world')).toBe(false)
      expect(harness.evaluate(StringConditions.EndsWith('Hello')).withInput('hello')).toBe(false)
      expect(harness.evaluate(StringConditions.EndsWith('o')).withInput('')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.EndsWith('.com')
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'String.EndsWith',
        arguments: ['.com'],
      })
    })
  })

  describe('Contains', () => {
    test('should return true when string contains the substring', () => {
      expect(harness.evaluate(StringConditions.Contains('lo wo')).withInput('hello world')).toBe(true)
      expect(harness.evaluate(StringConditions.Contains('ell')).withInput('hello')).toBe(true)
      expect(harness.evaluate(StringConditions.Contains('hello')).withInput('hello')).toBe(true)
      expect(harness.evaluate(StringConditions.Contains('')).withInput('hello')).toBe(true)
      expect(harness.evaluate(StringConditions.Contains('h')).withInput('hello')).toBe(true)
      expect(harness.evaluate(StringConditions.Contains('o')).withInput('hello')).toBe(true)
    })

    test('should return false when string does not contain the substring', () => {
      expect(harness.evaluate(StringConditions.Contains('xyz')).withInput('hello world')).toBe(false)
      expect(harness.evaluate(StringConditions.Contains('Hello')).withInput('hello')).toBe(false)
      expect(harness.evaluate(StringConditions.Contains('a')).withInput('')).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.Contains('@')
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'String.Contains',
        arguments: ['@'],
      })
    })
  })
})
