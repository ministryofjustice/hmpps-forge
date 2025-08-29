import StringConditions from './stringConditions'
import { FunctionType } from '../../form/types/enums'

describe('StringConditions', () => {
  describe('MatchesRegex', () => {
    const { evaluate } = StringConditions.MatchesRegex.spec

    test('should return true when string matches regex pattern', () => {
      expect(evaluate('hello', 'h.*o')).toBe(true)
      expect(evaluate('test@example.com', '.*@.*\\.com')).toBe(true)
      expect(evaluate('123', '^\\d+$')).toBe(true)
    })

    test('should return false when string does not match regex pattern', () => {
      expect(evaluate('hello', '^world$')).toBe(false)
      expect(evaluate('abc', '^\\d+$')).toBe(false)
    })

    test('should throw error when value is not a string', () => {
      expect(() => evaluate(123, 'pattern')).toThrow(
        'Condition.String.MatchesRegex expects a string but received number',
      )
      expect(() => evaluate(null, 'pattern')).toThrow(
        'Condition.String.MatchesRegex expects a string but received object',
      )
    })

    test('should throw error for invalid regex pattern', () => {
      expect(() => evaluate('test', '[[')).toThrow('Condition.String.MatchesRegex: Invalid regex pattern')
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.MatchesRegex('h.*o')
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'matchesRegex',
        arguments: ['h.*o'],
      })
    })
  })

  describe('HasMinLength', () => {
    const { evaluate } = StringConditions.HasMinLength.spec

    test('should return true when string length is greater than or equal to min', () => {
      expect(evaluate('hello', 3)).toBe(true)
      expect(evaluate('hello', 5)).toBe(true)
      expect(evaluate('', 0)).toBe(true)
    })

    test('should return false when string length is less than min', () => {
      expect(evaluate('hi', 3)).toBe(false)
      expect(evaluate('', 1)).toBe(false)
    })

    test('should throw error when value is not a string', () => {
      expect(() => evaluate(123, 3)).toThrow('Condition.String.HasMinLength expects a string but received number')
    })

    test('should throw error when min is not a valid number', () => {
      expect(() => evaluate('test', -1)).toThrow('Condition.String.HasMinLength: min must be a non-negative number')
      // @ts-expect-error - need to use wrong type for test
      expect(() => evaluate('test', 'abc')).toThrow('Condition.String.HasMinLength: min must be a non-negative number')
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.HasMinLength(5)
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'hasMinLength',
        arguments: [5],
      })
    })
  })

  describe('HasMaxLength', () => {
    const { evaluate } = StringConditions.HasMaxLength.spec

    test('should return true when string length is less than or equal to max', () => {
      expect(evaluate('hello', 10)).toBe(true)
      expect(evaluate('hello', 5)).toBe(true)
      expect(evaluate('', 0)).toBe(true)
    })

    test('should return false when string length is greater than max', () => {
      expect(evaluate('hello', 3)).toBe(false)
      expect(evaluate('x', 0)).toBe(false)
    })

    test('should throw error when value is not a string', () => {
      expect(() => evaluate([], 5)).toThrow('Condition.String.HasMaxLength expects a string but received object')
    })

    test('should throw error when max is not a valid number', () => {
      expect(() => evaluate('test', -5)).toThrow('Condition.String.HasMaxLength: max must be a non-negative number')
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.HasMaxLength(10)
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'hasMaxLength',
        arguments: [10],
      })
    })
  })

  describe('HasExactLength', () => {
    const { evaluate } = StringConditions.HasExactLength.spec

    test('should return true when string length equals the specified length', () => {
      expect(evaluate('hello', 5)).toBe(true)
      expect(evaluate('', 0)).toBe(true)
      expect(evaluate('ab', 2)).toBe(true)
    })

    test('should return false when string length does not equal the specified length', () => {
      expect(evaluate('hello', 4)).toBe(false)
      expect(evaluate('hello', 6)).toBe(false)
      expect(evaluate('', 1)).toBe(false)
    })

    test('should throw error when value is not a string', () => {
      expect(() => evaluate(true, 5)).toThrow('Condition.String.HasExactLength expects a string but received boolean')
    })

    test('should throw error when len is not a valid number', () => {
      expect(() => evaluate('test', -1)).toThrow('Condition.String.HasExactLength: len must be a non-negative number')
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.HasExactLength(8)
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'hasExactLength',
        arguments: [8],
      })
    })
  })

  describe('HasMaxWords', () => {
    const { evaluate } = StringConditions.HasMaxWords.spec

    test('should return true when word count is less than or equal to max', () => {
      expect(evaluate('hello world', 2)).toBe(true)
      expect(evaluate('hello world', 3)).toBe(true)
      expect(evaluate('one', 1)).toBe(true)
      expect(evaluate('', 0)).toBe(true)
      expect(evaluate('', 1)).toBe(true)
      expect(evaluate('  ', 0)).toBe(true)
    })

    test('should return false when word count exceeds max', () => {
      expect(evaluate('hello world test', 2)).toBe(false)
      expect(evaluate('one', 0)).toBe(false)
    })

    test('should handle multiple spaces correctly', () => {
      expect(evaluate('hello   world', 2)).toBe(true)
      expect(evaluate('  hello  world  ', 2)).toBe(true)
      expect(evaluate('one  two  three  four', 4)).toBe(true)
      expect(evaluate('one  two  three  four', 3)).toBe(false)
    })

    test('should throw error when value is not a string', () => {
      expect(() => evaluate(123, 5)).toThrow('Condition.String.HasMaxWords expects a string but received number')
    })

    test('should throw error when maxWords is not a valid number', () => {
      expect(() => evaluate('test', -1)).toThrow('Condition.String.HasMaxWords: maxWords must be a non-negative number')
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.HasMaxWords(100)
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'hasMaxWords',
        arguments: [100],
      })
    })
  })

  describe('LettersOnly', () => {
    const { evaluate } = StringConditions.LettersOnly.spec

    test('should return true for strings with only letters', () => {
      expect(evaluate('hello')).toBe(true)
      expect(evaluate('HelloWorld')).toBe(true)
      expect(evaluate('ABC')).toBe(true)
      expect(evaluate('xyz')).toBe(true)
    })

    test('should return false for strings with non-letter characters', () => {
      expect(evaluate('hello123')).toBe(false)
      expect(evaluate('hello world')).toBe(false)
      expect(evaluate('hello!')).toBe(false)
      expect(evaluate('')).toBe(false)
      expect(evaluate('123')).toBe(false)
    })

    test('should throw error when value is not a string', () => {
      expect(() => evaluate(123)).toThrow('Condition.String.LettersOnly expects a string but received number')
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.LettersOnly()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'lettersOnly',
        arguments: [],
      })
    })
  })

  describe('DigitsOnly', () => {
    const { evaluate } = StringConditions.DigitsOnly.spec

    test('should return true for strings with only digits', () => {
      expect(evaluate('123')).toBe(true)
      expect(evaluate('0')).toBe(true)
      expect(evaluate('999999')).toBe(true)
    })

    test('should return false for strings with non-digit characters', () => {
      expect(evaluate('123abc')).toBe(false)
      expect(evaluate('12.34')).toBe(false)
      expect(evaluate('12 34')).toBe(false)
      expect(evaluate('')).toBe(false)
      expect(evaluate('-123')).toBe(false)
    })

    test('should throw error when value is not a string', () => {
      expect(() => evaluate(123)).toThrow('Condition.String.DigitsOnly expects a string but received number')
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.DigitsOnly()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'digitsOnly',
        arguments: [],
      })
    })
  })

  describe('LettersWithCommonPunctuation', () => {
    const { evaluate } = StringConditions.LettersWithCommonPunctuation.spec

    test('should return true for letters with allowed punctuation', () => {
      expect(evaluate('Hello, World!')).toBe(true)
      expect(evaluate("It's a test.")).toBe(true)
      expect(evaluate('Question?')).toBe(true)
      expect(evaluate('(parentheses)')).toBe(true)
      expect(evaluate('dash-test')).toBe(true)
      expect(evaluate('"quoted"')).toBe(true)
    })

    test('should return false for strings with disallowed characters', () => {
      expect(evaluate('hello123')).toBe(false)
      expect(evaluate('test@email')).toBe(false)
      expect(evaluate('price$10')).toBe(false)
      expect(evaluate('')).toBe(false)
    })

    test('should throw error when value is not a string', () => {
      expect(() => evaluate(null)).toThrow(
        'Condition.String.LettersWithCommonPunctuation expects a string but received object',
      )
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.LettersWithCommonPunctuation()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'lettersWithCommonPunctuation',
        arguments: [],
      })
    })
  })

  describe('LettersWithSpaceDashApostrophe', () => {
    const { evaluate } = StringConditions.LettersWithSpaceDashApostrophe.spec

    test('should return true for letters with space, dash, and apostrophe', () => {
      expect(evaluate('Hello World')).toBe(true)
      expect(evaluate("O'Connor")).toBe(true)
      expect(evaluate('Mary-Jane')).toBe(true)
      expect(evaluate('Smith')).toBe(true)
    })

    test('should return false for strings with other characters', () => {
      expect(evaluate('Hello!')).toBe(false)
      expect(evaluate('test123')).toBe(false)
      expect(evaluate('name@email')).toBe(false)
      expect(evaluate('')).toBe(false)
      expect(evaluate('test.')).toBe(false)
    })

    test('should throw error when value is not a string', () => {
      expect(() => evaluate(undefined)).toThrow(
        'Condition.String.LettersWithSpaceDashApostrophe expects a string but received undefined',
      )
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.LettersWithSpaceDashApostrophe()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'lettersWithSpaceDashApostrophe',
        arguments: [],
      })
    })
  })

  describe('LettersAndDigitsOnly', () => {
    const { evaluate } = StringConditions.LettersAndDigitsOnly.spec

    test('should return true for alphanumeric strings', () => {
      expect(evaluate('Hello123')).toBe(true)
      expect(evaluate('ABC123')).toBe(true)
      expect(evaluate('test')).toBe(true)
      expect(evaluate('999')).toBe(true)
    })

    test('should return false for strings with non-alphanumeric characters', () => {
      expect(evaluate('hello world')).toBe(false)
      expect(evaluate('test-123')).toBe(false)
      expect(evaluate('hello!')).toBe(false)
      expect(evaluate('')).toBe(false)
    })

    test('should throw error when value is not a string', () => {
      expect(() => evaluate({})).toThrow('Condition.String.LettersAndDigitsOnly expects a string but received object')
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.LettersAndDigitsOnly()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'lettersAndDigitsOnly',
        arguments: [],
      })
    })
  })

  describe('AlphanumericWithCommonPunctuation', () => {
    const { evaluate } = StringConditions.AlphanumericWithCommonPunctuation.spec

    test('should return true for alphanumeric with allowed punctuation', () => {
      expect(evaluate('Hello123!')).toBe(true)
      expect(evaluate('Test, 123.')).toBe(true)
      expect(evaluate("It's 2024")).toBe(true)
      expect(evaluate('(123) test')).toBe(true)
      expect(evaluate('dash-123')).toBe(true)
    })

    test('should return false for strings with disallowed characters', () => {
      expect(evaluate('test@email')).toBe(false)
      expect(evaluate('price$10')).toBe(false)
      expect(evaluate('test#hash')).toBe(false)
      expect(evaluate('')).toBe(false)
    })

    test('should throw error when value is not a string', () => {
      expect(() => evaluate(123)).toThrow(
        'Condition.String.AlphanumericWithCommonPunctuation expects a string but received number',
      )
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.AlphanumericWithCommonPunctuation()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'alphanumericWithCommonPunctuation',
        arguments: [],
      })
    })
  })

  describe('AlphanumericWithAllSafeSymbols', () => {
    const { evaluate } = StringConditions.AlphanumericWithAllSafeSymbols.spec

    test('should return true for alphanumeric with all safe symbols', () => {
      expect(evaluate('Hello@123')).toBe(true)
      expect(evaluate('Test#$%')).toBe(true)
      expect(evaluate('email@test')).toBe(true)
      expect(evaluate('100% success!')).toBe(true)
      expect(evaluate('(test) & *stars*')).toBe(true)
      expect(evaluate('price: $10.99')).toBe(true)
    })

    test('should return false for strings with unsafe characters', () => {
      expect(evaluate('test<script>')).toBe(false)
      expect(evaluate('test\\escape')).toBe(false)
      expect(evaluate('test/slash')).toBe(false)
      expect(evaluate('')).toBe(false)
    })

    test('should throw error when value is not a string', () => {
      expect(() => evaluate([])).toThrow(
        'Condition.String.AlphanumericWithAllSafeSymbols expects a string but received object',
      )
    })

    test('should build correct expression object', () => {
      const expr = StringConditions.AlphanumericWithAllSafeSymbols()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'alphanumericWithAllSafeSymbols',
        arguments: [],
      })
    })
  })
})
