Object.defineProperty(exports, '__esModule', { value: true })
const stringConditions_1 = require('./stringConditions')
const defineFunction_1 = require('../utils/defineFunction')
const enums_1 = require('../types/enums')

describe('StringConditions', function () {
  const registry = (0, defineFunction_1.createFunctionsRegistry)(stringConditions_1.StringConditionsImplementations)
  describe('MatchesRegex', function () {
    const evaluate = registry.MatchesRegex.evaluate
    test('should return true when string matches regex pattern', function () {
      expect(evaluate('hello', 'h.*o')).toBe(true)
      expect(evaluate('test@example.com', '.*@.*\\.com')).toBe(true)
      expect(evaluate('123', '^\\d+$')).toBe(true)
    })
    test('should return false when string does not match regex pattern', function () {
      expect(evaluate('hello', '^world$')).toBe(false)
      expect(evaluate('abc', '^\\d+$')).toBe(false)
    })
    test('should throw error when value is not a string', function () {
      expect(function () {
        return evaluate(123, 'pattern')
      }).toThrow('Condition.String.MatchesRegex expects a string but received number')
      expect(function () {
        return evaluate(null, 'pattern')
      }).toThrow('Condition.String.MatchesRegex expects a string but received object')
    })
    test('should throw error for invalid regex pattern', function () {
      expect(function () {
        return evaluate('test', '[[')
      }).toThrow('Condition.String.MatchesRegex: Invalid regex pattern')
    })
    test('should build correct expression object', function () {
      const expr = stringConditions_1.StringConditions.MatchesRegex('h.*o')
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'MatchesRegex',
        arguments: ['h.*o'],
      })
    })
  })
  describe('HasMinLength', function () {
    const evaluate = registry.HasMinLength.evaluate
    test('should return true when string length is greater than or equal to min', function () {
      expect(evaluate('hello', 3)).toBe(true)
      expect(evaluate('hello', 5)).toBe(true)
      expect(evaluate('', 0)).toBe(true)
    })
    test('should return false when string length is less than min', function () {
      expect(evaluate('hi', 3)).toBe(false)
      expect(evaluate('', 1)).toBe(false)
    })
    test('should throw error when value is not a string', function () {
      expect(function () {
        return evaluate(123, 3)
      }).toThrow('Condition.String.HasMinLength expects a string but received number')
    })
    test('should throw error when min is not a valid number', function () {
      expect(function () {
        return evaluate('test', -1)
      }).toThrow('Condition.String.HasMinLength: min must be a non-negative number')
      expect(function () {
        return evaluate('test', 'abc')
      }).toThrow('Condition.String.HasMinLength (min) expects a number')
    })
    test('should build correct expression object', function () {
      const expr = stringConditions_1.StringConditions.HasMinLength(5)
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'HasMinLength',
        arguments: [5],
      })
    })
  })
  describe('HasMaxLength', function () {
    const evaluate = registry.HasMaxLength.evaluate
    test('should return true when string length is less than or equal to max', function () {
      expect(evaluate('hello', 10)).toBe(true)
      expect(evaluate('hello', 5)).toBe(true)
      expect(evaluate('', 0)).toBe(true)
    })
    test('should return false when string length is greater than max', function () {
      expect(evaluate('hello', 3)).toBe(false)
      expect(evaluate('x', 0)).toBe(false)
    })
    test('should throw error when value is not a string', function () {
      expect(function () {
        return evaluate([], 5)
      }).toThrow('Condition.String.HasMaxLength expects a string but received object')
    })
    test('should throw error when max is not a valid number', function () {
      expect(function () {
        return evaluate('test', -5)
      }).toThrow('Condition.String.HasMaxLength: max must be a non-negative number')
    })
    test('should build correct expression object', function () {
      const expr = stringConditions_1.StringConditions.HasMaxLength(10)
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'HasMaxLength',
        arguments: [10],
      })
    })
  })
  describe('HasExactLength', function () {
    const evaluate = registry.HasExactLength.evaluate
    test('should return true when string length equals the specified length', function () {
      expect(evaluate('hello', 5)).toBe(true)
      expect(evaluate('', 0)).toBe(true)
      expect(evaluate('ab', 2)).toBe(true)
    })
    test('should return false when string length does not equal the specified length', function () {
      expect(evaluate('hello', 4)).toBe(false)
      expect(evaluate('hello', 6)).toBe(false)
      expect(evaluate('', 1)).toBe(false)
    })
    test('should throw error when value is not a string', function () {
      expect(function () {
        return evaluate(true, 5)
      }).toThrow('Condition.String.HasExactLength expects a string but received boolean')
    })
    test('should throw error when len is not a valid number', function () {
      expect(function () {
        return evaluate('test', -1)
      }).toThrow('Condition.String.HasExactLength: len must be a non-negative number')
    })
    test('should build correct expression object', function () {
      const expr = stringConditions_1.StringConditions.HasExactLength(8)
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'HasExactLength',
        arguments: [8],
      })
    })
  })
  describe('HasMaxWords', function () {
    const evaluate = registry.HasMaxWords.evaluate
    test('should return true when word count is less than or equal to max', function () {
      expect(evaluate('hello world', 2)).toBe(true)
      expect(evaluate('hello world', 3)).toBe(true)
      expect(evaluate('one', 1)).toBe(true)
      expect(evaluate('', 0)).toBe(true)
      expect(evaluate('', 1)).toBe(true)
      expect(evaluate('  ', 0)).toBe(true)
    })
    test('should return false when word count exceeds max', function () {
      expect(evaluate('hello world test', 2)).toBe(false)
      expect(evaluate('one', 0)).toBe(false)
    })
    test('should handle multiple spaces correctly', function () {
      expect(evaluate('hello   world', 2)).toBe(true)
      expect(evaluate('  hello  world  ', 2)).toBe(true)
      expect(evaluate('one  two  three  four', 4)).toBe(true)
      expect(evaluate('one  two  three  four', 3)).toBe(false)
    })
    test('should throw error when value is not a string', function () {
      expect(function () {
        return evaluate(123, 5)
      }).toThrow('Condition.String.HasMaxWords expects a string but received number')
    })
    test('should throw error when maxWords is not a valid number', function () {
      expect(function () {
        return evaluate('test', -1)
      }).toThrow('Condition.String.HasMaxWords: maxWords must be a non-negative number')
    })
    test('should build correct expression object', function () {
      const expr = stringConditions_1.StringConditions.HasMaxWords(100)
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'HasMaxWords',
        arguments: [100],
      })
    })
  })
  describe('LettersOnly', function () {
    const evaluate = registry.LettersOnly.evaluate
    test('should return true for strings with only letters', function () {
      expect(evaluate('hello')).toBe(true)
      expect(evaluate('HelloWorld')).toBe(true)
      expect(evaluate('ABC')).toBe(true)
      expect(evaluate('xyz')).toBe(true)
    })
    test('should return false for strings with non-letter characters', function () {
      expect(evaluate('hello123')).toBe(false)
      expect(evaluate('hello world')).toBe(false)
      expect(evaluate('hello!')).toBe(false)
      expect(evaluate('')).toBe(false)
      expect(evaluate('123')).toBe(false)
    })
    test('should throw error when value is not a string', function () {
      expect(function () {
        return evaluate(123)
      }).toThrow('Condition.String.LettersOnly expects a string but received number')
    })
    test('should build correct expression object', function () {
      const expr = stringConditions_1.StringConditions.LettersOnly()
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'LettersOnly',
        arguments: [],
      })
    })
  })
  describe('DigitsOnly', function () {
    const evaluate = registry.DigitsOnly.evaluate
    test('should return true for strings with only digits', function () {
      expect(evaluate('123')).toBe(true)
      expect(evaluate('0')).toBe(true)
      expect(evaluate('999999')).toBe(true)
    })
    test('should return false for strings with non-digit characters', function () {
      expect(evaluate('123abc')).toBe(false)
      expect(evaluate('12.34')).toBe(false)
      expect(evaluate('12 34')).toBe(false)
      expect(evaluate('')).toBe(false)
      expect(evaluate('-123')).toBe(false)
    })
    test('should throw error when value is not a string', function () {
      expect(function () {
        return evaluate(123)
      }).toThrow('Condition.String.DigitsOnly expects a string but received number')
    })
    test('should build correct expression object', function () {
      const expr = stringConditions_1.StringConditions.DigitsOnly()
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'DigitsOnly',
        arguments: [],
      })
    })
  })
  describe('LettersWithCommonPunctuation', function () {
    const evaluate = registry.LettersWithCommonPunctuation.evaluate
    test('should return true for letters with allowed punctuation', function () {
      expect(evaluate('Hello, World!')).toBe(true)
      expect(evaluate("It's a test.")).toBe(true)
      expect(evaluate('Question?')).toBe(true)
      expect(evaluate('(parentheses)')).toBe(true)
      expect(evaluate('dash-test')).toBe(true)
      expect(evaluate('"quoted"')).toBe(true)
    })
    test('should return false for strings with disallowed characters', function () {
      expect(evaluate('hello123')).toBe(false)
      expect(evaluate('test@email')).toBe(false)
      expect(evaluate('price$10')).toBe(false)
      expect(evaluate('')).toBe(false)
    })
    test('should throw error when value is not a string', function () {
      expect(function () {
        return evaluate(null)
      }).toThrow('Condition.String.LettersWithCommonPunctuation expects a string but received object')
    })
    test('should build correct expression object', function () {
      const expr = stringConditions_1.StringConditions.LettersWithCommonPunctuation()
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'LettersWithCommonPunctuation',
        arguments: [],
      })
    })
  })
  describe('LettersWithSpaceDashApostrophe', function () {
    const evaluate = registry.LettersWithSpaceDashApostrophe.evaluate
    test('should return true for letters with space, dash, and apostrophe', function () {
      expect(evaluate('Hello World')).toBe(true)
      expect(evaluate("O'Connor")).toBe(true)
      expect(evaluate('Mary-Jane')).toBe(true)
      expect(evaluate('Smith')).toBe(true)
    })
    test('should return false for strings with other characters', function () {
      expect(evaluate('Hello!')).toBe(false)
      expect(evaluate('test123')).toBe(false)
      expect(evaluate('name@email')).toBe(false)
      expect(evaluate('')).toBe(false)
      expect(evaluate('test.')).toBe(false)
    })
    test('should throw error when value is not a string', function () {
      expect(function () {
        return evaluate(undefined)
      }).toThrow('Condition.String.LettersWithSpaceDashApostrophe expects a string but received undefined')
    })
    test('should build correct expression object', function () {
      const expr = stringConditions_1.StringConditions.LettersWithSpaceDashApostrophe()
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'LettersWithSpaceDashApostrophe',
        arguments: [],
      })
    })
  })
  describe('LettersAndDigitsOnly', function () {
    const evaluate = registry.LettersAndDigitsOnly.evaluate
    test('should return true for alphanumeric strings', function () {
      expect(evaluate('Hello123')).toBe(true)
      expect(evaluate('ABC123')).toBe(true)
      expect(evaluate('test')).toBe(true)
      expect(evaluate('999')).toBe(true)
    })
    test('should return false for strings with non-alphanumeric characters', function () {
      expect(evaluate('hello world')).toBe(false)
      expect(evaluate('test-123')).toBe(false)
      expect(evaluate('hello!')).toBe(false)
      expect(evaluate('')).toBe(false)
    })
    test('should throw error when value is not a string', function () {
      expect(function () {
        return evaluate({})
      }).toThrow('Condition.String.LettersAndDigitsOnly expects a string but received object')
    })
    test('should build correct expression object', function () {
      const expr = stringConditions_1.StringConditions.LettersAndDigitsOnly()
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'LettersAndDigitsOnly',
        arguments: [],
      })
    })
  })
  describe('AlphanumericWithCommonPunctuation', function () {
    const evaluate = registry.AlphanumericWithCommonPunctuation.evaluate
    test('should return true for alphanumeric with allowed punctuation', function () {
      expect(evaluate('Hello123!')).toBe(true)
      expect(evaluate('Test, 123.')).toBe(true)
      expect(evaluate("It's 2024")).toBe(true)
      expect(evaluate('(123) test')).toBe(true)
      expect(evaluate('dash-123')).toBe(true)
    })
    test('should return false for strings with disallowed characters', function () {
      expect(evaluate('test@email')).toBe(false)
      expect(evaluate('price$10')).toBe(false)
      expect(evaluate('test#hash')).toBe(false)
      expect(evaluate('')).toBe(false)
    })
    test('should throw error when value is not a string', function () {
      expect(function () {
        return evaluate(123)
      }).toThrow('Condition.String.AlphanumericWithCommonPunctuation expects a string but received number')
    })
    test('should build correct expression object', function () {
      const expr = stringConditions_1.StringConditions.AlphanumericWithCommonPunctuation()
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'AlphanumericWithCommonPunctuation',
        arguments: [],
      })
    })
  })
  describe('AlphanumericWithAllSafeSymbols', function () {
    const evaluate = registry.AlphanumericWithAllSafeSymbols.evaluate
    test('should return true for alphanumeric with all safe symbols', function () {
      expect(evaluate('Hello@123')).toBe(true)
      expect(evaluate('Test#$%')).toBe(true)
      expect(evaluate('email@test')).toBe(true)
      expect(evaluate('100% success!')).toBe(true)
      expect(evaluate('(test) & *stars*')).toBe(true)
      expect(evaluate('price: $10.99')).toBe(true)
    })
    test('should return false for strings with unsafe characters', function () {
      expect(evaluate('test<script>')).toBe(false)
      expect(evaluate('test\\escape')).toBe(false)
      expect(evaluate('test/slash')).toBe(false)
      expect(evaluate('')).toBe(false)
    })
    test('should throw error when value is not a string', function () {
      expect(function () {
        return evaluate([])
      }).toThrow('Condition.String.AlphanumericWithAllSafeSymbols expects a string but received object')
    })
    test('should build correct expression object', function () {
      const expr = stringConditions_1.StringConditions.AlphanumericWithAllSafeSymbols()
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'AlphanumericWithAllSafeSymbols',
        arguments: [],
      })
    })
  })
  describe('StartsWith', function () {
    const evaluate = registry.StartsWith.evaluate
    test('should return true when string starts with the prefix', function () {
      expect(evaluate('hello world', 'hello')).toBe(true)
      expect(evaluate('hello', 'h')).toBe(true)
      expect(evaluate('hello', 'hello')).toBe(true)
      expect(evaluate('hello', '')).toBe(true)
    })
    test('should return false when string does not start with the prefix', function () {
      expect(evaluate('hello world', 'world')).toBe(false)
      expect(evaluate('hello', 'Hello')).toBe(false)
      expect(evaluate('', 'h')).toBe(false)
    })
    test('should throw error when value is not a string', function () {
      expect(function () {
        return evaluate(123, 'prefix')
      }).toThrow('Condition.String.StartsWith expects a string but received number')
    })
    test('should throw error when prefix is not a string', function () {
      expect(function () {
        return evaluate('test', 123)
      }).toThrow('Condition.String.StartsWith (prefix) expects a string but received number')
    })
    test('should build correct expression object', function () {
      const expr = stringConditions_1.StringConditions.StartsWith('hello')
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'StartsWith',
        arguments: ['hello'],
      })
    })
  })
  describe('EndsWith', function () {
    const evaluate = registry.EndsWith.evaluate
    test('should return true when string ends with the suffix', function () {
      expect(evaluate('hello world', 'world')).toBe(true)
      expect(evaluate('hello', 'o')).toBe(true)
      expect(evaluate('hello', 'hello')).toBe(true)
      expect(evaluate('hello', '')).toBe(true)
    })
    test('should return false when string does not end with the suffix', function () {
      expect(evaluate('hello world', 'hello')).toBe(false)
      expect(evaluate('hello', 'Hello')).toBe(false)
      expect(evaluate('', 'o')).toBe(false)
    })
    test('should throw error when value is not a string', function () {
      expect(function () {
        return evaluate(null, 'suffix')
      }).toThrow('Condition.String.EndsWith expects a string but received object')
    })
    test('should throw error when suffix is not a string', function () {
      expect(function () {
        return evaluate('test', undefined)
      }).toThrow('Condition.String.EndsWith (suffix) expects a string but received undefined')
    })
    test('should build correct expression object', function () {
      const expr = stringConditions_1.StringConditions.EndsWith('.com')
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'EndsWith',
        arguments: ['.com'],
      })
    })
  })
  describe('Contains', function () {
    const evaluate = registry.Contains.evaluate
    test('should return true when string contains the substring', function () {
      expect(evaluate('hello world', 'lo wo')).toBe(true)
      expect(evaluate('hello', 'ell')).toBe(true)
      expect(evaluate('hello', 'hello')).toBe(true)
      expect(evaluate('hello', '')).toBe(true)
      expect(evaluate('hello', 'h')).toBe(true)
      expect(evaluate('hello', 'o')).toBe(true)
    })
    test('should return false when string does not contain the substring', function () {
      expect(evaluate('hello world', 'xyz')).toBe(false)
      expect(evaluate('hello', 'Hello')).toBe(false)
      expect(evaluate('', 'a')).toBe(false)
    })
    test('should throw error when value is not a string', function () {
      expect(function () {
        return evaluate([], 'substring')
      }).toThrow('Condition.String.Contains expects a string but received object')
    })
    test('should throw error when substring is not a string', function () {
      expect(function () {
        return evaluate('test', {})
      }).toThrow('Condition.String.Contains (substring) expects a string but received object')
    })
    test('should build correct expression object', function () {
      const expr = stringConditions_1.StringConditions.Contains('@')
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'Contains',
        arguments: ['@'],
      })
    })
  })
})
