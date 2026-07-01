import { StringConditions, stringConditionsRegistry } from './stringConditions'
import { FunctionType } from '../types/enums'

describe('StringConditions', () => {
  const registry = stringConditionsRegistry.build()

  describe('MatchesRegex', () => {
    const { evaluate } = registry['String.MatchesRegex']

    test('should return true when string matches regex pattern', () => {
      expect(evaluate('hello', 'h.*o')).toBe(true)
      expect(evaluate('test@example.com', '.*@.*\\.com')).toBe(true)
      expect(evaluate('123', '^\\d+$')).toBe(true)
    })

    test('should return false when string does not match regex pattern', () => {
      expect(evaluate('hello', '^world$')).toBe(false)
      expect(evaluate('abc', '^\\d+$')).toBe(false)
    })

    test('should throw error for invalid regex pattern', () => {
      expect(() => evaluate('test', '[[')).toThrow('Condition.String.MatchesRegex: Invalid regex pattern')
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
    const { evaluate } = registry['String.HasMinLength']

    test('should return true when string length is greater than or equal to min', () => {
      expect(evaluate('hello', 3)).toBe(true)
      expect(evaluate('hello', 5)).toBe(true)
      expect(evaluate('', 0)).toBe(true)
    })

    test('should return false when string length is less than min', () => {
      expect(evaluate('hi', 3)).toBe(false)
      expect(evaluate('', 1)).toBe(false)
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
    const { evaluate } = registry['String.HasMaxLength']

    test('should return true when string length is less than or equal to max', () => {
      expect(evaluate('hello', 10)).toBe(true)
      expect(evaluate('hello', 5)).toBe(true)
      expect(evaluate('', 0)).toBe(true)
    })

    test('should return false when string length is greater than max', () => {
      expect(evaluate('hello', 3)).toBe(false)
      expect(evaluate('x', 0)).toBe(false)
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
    const { evaluate } = registry['String.HasExactLength']

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
    const { evaluate } = registry['String.HasMaxWords']

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
    const { evaluate } = registry['String.LettersOnly']

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
    const { evaluate } = registry['String.DigitsOnly']

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
    const { evaluate } = registry['String.LettersWithCommonPunctuation']

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
    const { evaluate } = registry['String.LettersWithSpaceDashApostrophe']

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
    const { evaluate } = registry['String.LettersAndDigitsOnly']

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
    const { evaluate } = registry['String.AlphanumericWithCommonPunctuation']

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
    const { evaluate } = registry['String.AlphanumericWithAllSafeSymbols']

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
    const { evaluate } = registry['String.StartsWith']

    test('should return true when string starts with the prefix', () => {
      expect(evaluate('hello world', 'hello')).toBe(true)
      expect(evaluate('hello', 'h')).toBe(true)
      expect(evaluate('hello', 'hello')).toBe(true)
      expect(evaluate('hello', '')).toBe(true)
    })

    test('should return false when string does not start with the prefix', () => {
      expect(evaluate('hello world', 'world')).toBe(false)
      expect(evaluate('hello', 'Hello')).toBe(false)
      expect(evaluate('', 'h')).toBe(false)
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
    const { evaluate } = registry['String.EndsWith']

    test('should return true when string ends with the suffix', () => {
      expect(evaluate('hello world', 'world')).toBe(true)
      expect(evaluate('hello', 'o')).toBe(true)
      expect(evaluate('hello', 'hello')).toBe(true)
      expect(evaluate('hello', '')).toBe(true)
    })

    test('should return false when string does not end with the suffix', () => {
      expect(evaluate('hello world', 'hello')).toBe(false)
      expect(evaluate('hello', 'Hello')).toBe(false)
      expect(evaluate('', 'o')).toBe(false)
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
    const { evaluate } = registry['String.Contains']

    test('should return true when string contains the substring', () => {
      expect(evaluate('hello world', 'lo wo')).toBe(true)
      expect(evaluate('hello', 'ell')).toBe(true)
      expect(evaluate('hello', 'hello')).toBe(true)
      expect(evaluate('hello', '')).toBe(true)
      expect(evaluate('hello', 'h')).toBe(true)
      expect(evaluate('hello', 'o')).toBe(true)
    })

    test('should return false when string does not contain the substring', () => {
      expect(evaluate('hello world', 'xyz')).toBe(false)
      expect(evaluate('hello', 'Hello')).toBe(false)
      expect(evaluate('', 'a')).toBe(false)
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
