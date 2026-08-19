import { StringTransformers, stringTransformersRegistry } from './stringTransformers'
import { FunctionType } from '../../../authoring/types/enums'
import { FunctionRegistryTestHarness } from '../../../testing/functions/FunctionRegistryTestHarness'

describe('String Transformers', () => {
  const harness = new FunctionRegistryTestHarness(stringTransformersRegistry)

  describe('Trim', () => {
    it('should remove leading and trailing whitespace', () => {
      const result = harness.evaluate(StringTransformers.Trim()).withInput('  hello world  ')
      expect(result).toBe('hello world')
    })

    it('should handle strings with no whitespace', () => {
      const result = harness.evaluate(StringTransformers.Trim()).withInput('hello')
      expect(result).toBe('hello')
    })

    it('should handle empty strings', () => {
      const result = harness.evaluate(StringTransformers.Trim()).withInput('')
      expect(result).toBe('')
    })

    it('should handle strings with only whitespace', () => {
      const result = harness.evaluate(StringTransformers.Trim()).withInput('   ')
      expect(result).toBe('')
    })

    it('should preserve internal whitespace', () => {
      const result = harness.evaluate(StringTransformers.Trim()).withInput('  hello   world  ')
      expect(result).toBe('hello   world')
    })

    it('should throw error for non-string values', () => {
      expect(() => harness.evaluate(StringTransformers.Trim()).withInput(123)).toThrow(
        'String.Trim: value failed schema validation',
      )
    })

    it('should return a function expression when called', () => {
      const expr = StringTransformers.Trim()
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'String.Trim',
        arguments: [],
      })
    })
  })

  describe('ToUpperCase', () => {
    it('should convert string to uppercase', () => {
      const result = harness.evaluate(StringTransformers.ToUpperCase()).withInput('hello world')
      expect(result).toBe('HELLO WORLD')
    })

    it('should handle already uppercase strings', () => {
      const result = harness.evaluate(StringTransformers.ToUpperCase()).withInput('HELLO WORLD')
      expect(result).toBe('HELLO WORLD')
    })

    it('should handle mixed case strings', () => {
      const result = harness.evaluate(StringTransformers.ToUpperCase()).withInput('HeLLo WoRLd')
      expect(result).toBe('HELLO WORLD')
    })

    it('should handle empty strings', () => {
      const result = harness.evaluate(StringTransformers.ToUpperCase()).withInput('')
      expect(result).toBe('')
    })

    it('should handle strings with numbers and symbols', () => {
      const result = harness.evaluate(StringTransformers.ToUpperCase()).withInput('hello123!@#')
      expect(result).toBe('HELLO123!@#')
    })

    it('should throw error for non-string values', () => {
      expect(() => harness.evaluate(StringTransformers.ToUpperCase()).withInput(123)).toThrow(
        'String.ToUpperCase: value failed schema validation',
      )
    })
  })

  describe('ToLowerCase', () => {
    it('should convert string to lowercase', () => {
      const result = harness.evaluate(StringTransformers.ToLowerCase()).withInput('HELLO WORLD')
      expect(result).toBe('hello world')
    })

    it('should handle already lowercase strings', () => {
      const result = harness.evaluate(StringTransformers.ToLowerCase()).withInput('hello world')
      expect(result).toBe('hello world')
    })

    it('should handle mixed case strings', () => {
      const result = harness.evaluate(StringTransformers.ToLowerCase()).withInput('HeLLo WoRLd')
      expect(result).toBe('hello world')
    })

    it('should handle empty strings', () => {
      const result = harness.evaluate(StringTransformers.ToLowerCase()).withInput('')
      expect(result).toBe('')
    })

    it('should throw error for non-string values', () => {
      expect(() => harness.evaluate(StringTransformers.ToLowerCase()).withInput(123)).toThrow(
        'String.ToLowerCase: value failed schema validation',
      )
    })
  })

  describe('ToTitleCase', () => {
    it('should capitalize first letter of each word', () => {
      const result = harness.evaluate(StringTransformers.ToTitleCase()).withInput('hello world')
      expect(result).toBe('Hello World')
    })

    it('should handle single word', () => {
      const result = harness.evaluate(StringTransformers.ToTitleCase()).withInput('hello')
      expect(result).toBe('Hello')
    })

    it('should handle mixed case input', () => {
      const result = harness.evaluate(StringTransformers.ToTitleCase()).withInput('hELLo WoRLD')
      expect(result).toBe('Hello World')
    })

    it('should handle words with apostrophes', () => {
      const result = harness.evaluate(StringTransformers.ToTitleCase()).withInput("don't worry")
      expect(result).toBe("Don't Worry")
    })

    it('should handle empty strings', () => {
      const result = harness.evaluate(StringTransformers.ToTitleCase()).withInput('')
      expect(result).toBe('')
    })

    it('should throw error for non-string values', () => {
      expect(() => harness.evaluate(StringTransformers.ToTitleCase()).withInput(123)).toThrow(
        'String.ToTitleCase: value failed schema validation',
      )
    })
  })

  describe('Capitalize', () => {
    it('should capitalize first letter only', () => {
      const result = harness.evaluate(StringTransformers.Capitalize()).withInput('hello world')
      expect(result).toBe('Hello world')
    })

    it('should handle single character', () => {
      const result = harness.evaluate(StringTransformers.Capitalize()).withInput('h')
      expect(result).toBe('H')
    })

    it('should handle already capitalized strings', () => {
      const result = harness.evaluate(StringTransformers.Capitalize()).withInput('Hello world')
      expect(result).toBe('Hello world')
    })

    it('should handle empty strings', () => {
      const result = harness.evaluate(StringTransformers.Capitalize()).withInput('')
      expect(result).toBe('')
    })

    it('should throw error for non-string values', () => {
      expect(() => harness.evaluate(StringTransformers.Capitalize()).withInput(123)).toThrow(
        'String.Capitalize: value failed schema validation',
      )
    })
  })

  describe('Possessive', () => {
    it('should add apostrophe-s for names not ending in s', () => {
      expect(harness.evaluate(StringTransformers.Possessive()).withInput('John')).toBe("John's")
    })

    it('should add only apostrophe for names ending in s', () => {
      expect(harness.evaluate(StringTransformers.Possessive()).withInput('James')).toBe("James'")
    })

    it('should handle names ending in uppercase S', () => {
      expect(harness.evaluate(StringTransformers.Possessive()).withInput('JAMES')).toBe("JAMES'")
    })

    it('should handle single character names', () => {
      expect(harness.evaluate(StringTransformers.Possessive()).withInput('J')).toBe("J's")
      expect(harness.evaluate(StringTransformers.Possessive()).withInput('S')).toBe("S'")
    })

    it('should handle empty strings', () => {
      expect(harness.evaluate(StringTransformers.Possessive()).withInput('')).toBe('')
    })

    it('should handle names with mixed case', () => {
      expect(harness.evaluate(StringTransformers.Possessive()).withInput('Chris')).toBe("Chris'")
      expect(harness.evaluate(StringTransformers.Possessive()).withInput('Tom')).toBe("Tom's")
    })

    it('should throw error for non-string values', () => {
      expect(() => harness.evaluate(StringTransformers.Possessive()).withInput(123)).toThrow(
        'String.Possessive: value failed schema validation',
      )
    })

    it('should return a function expression when called', () => {
      const expr = StringTransformers.Possessive()
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'String.Possessive',
        arguments: [],
      })
    })
  })

  describe('Substring', () => {
    it('should extract substring with start and end positions', () => {
      const result = harness.evaluate(StringTransformers.Substring(0, 5)).withInput('hello world')
      expect(result).toBe('hello')
    })

    it('should extract substring with only start position', () => {
      const result = harness.evaluate(StringTransformers.Substring(6)).withInput('hello world')
      expect(result).toBe('world')
    })

    it('should handle start position beyond string length', () => {
      const result = harness.evaluate(StringTransformers.Substring(10)).withInput('hello')
      expect(result).toBe('')
    })

    it('should handle negative start position', () => {
      const result = harness.evaluate(StringTransformers.Substring(-2, 3)).withInput('hello')
      expect(result).toBe('hel')
    })

    it('should throw error for non-string values', () => {
      expect(() => harness.evaluate(StringTransformers.Substring(0, 1)).withInput(123)).toThrow(
        'String.Substring: value failed schema validation',
      )
    })
  })

  describe('Replace', () => {
    it('should replace all occurrences of search string', () => {
      const result = harness.evaluate(StringTransformers.Replace('hello', 'hi')).withInput('hello world hello')
      expect(result).toBe('hi world hi')
    })

    it('should handle case-sensitive replacement', () => {
      const result = harness.evaluate(StringTransformers.Replace('hello', 'hi')).withInput('Hello world hello')
      expect(result).toBe('Hello world hi')
    })

    it('should handle replacement with empty string', () => {
      const result = harness.evaluate(StringTransformers.Replace('hello ', '')).withInput('hello world')
      expect(result).toBe('world')
    })

    it('should handle search string not found', () => {
      const result = harness.evaluate(StringTransformers.Replace('xyz', 'abc')).withInput('hello world')
      expect(result).toBe('hello world')
    })

    it('should throw error for non-string values', () => {
      expect(() => harness.evaluate(StringTransformers.Replace('a', 'b')).withInput(123)).toThrow(
        'String.Replace: value failed schema validation',
      )
    })
  })

  describe('PadStart', () => {
    it('should pad string to target length with spaces', () => {
      const result = harness.evaluate(StringTransformers.PadStart(3)).withInput('5')
      expect(result).toBe('  5')
    })

    it('should pad string with custom character', () => {
      const result = harness.evaluate(StringTransformers.PadStart(3, '0')).withInput('5')
      expect(result).toBe('005')
    })

    it('should not pad if string is already longer than target', () => {
      const result = harness.evaluate(StringTransformers.PadStart(3)).withInput('hello')
      expect(result).toBe('hello')
    })

    it('should handle empty string', () => {
      const result = harness.evaluate(StringTransformers.PadStart(3, 'x')).withInput('')
      expect(result).toBe('xxx')
    })

    it('should throw error for non-string values', () => {
      expect(() => harness.evaluate(StringTransformers.PadStart(5)).withInput(123)).toThrow(
        'String.PadStart: value failed schema validation',
      )
    })
  })

  describe('PadEnd', () => {
    it('should pad string to target length with spaces', () => {
      const result = harness.evaluate(StringTransformers.PadEnd(3)).withInput('5')
      expect(result).toBe('5  ')
    })

    it('should pad string with custom character', () => {
      const result = harness.evaluate(StringTransformers.PadEnd(3, '0')).withInput('5')
      expect(result).toBe('500')
    })

    it('should not pad if string is already longer than target', () => {
      const result = harness.evaluate(StringTransformers.PadEnd(3)).withInput('hello')
      expect(result).toBe('hello')
    })

    it('should handle empty string', () => {
      const result = harness.evaluate(StringTransformers.PadEnd(3, 'x')).withInput('')
      expect(result).toBe('xxx')
    })

    it('should throw error for non-string values', () => {
      expect(() => harness.evaluate(StringTransformers.PadEnd(5)).withInput(123)).toThrow(
        'String.PadEnd: value failed schema validation',
      )
    })
  })

  describe('ToInt', () => {
    it('should convert string to integer', () => {
      const result = harness.evaluate(StringTransformers.ToInt()).withInput('123')
      expect(result).toBe(123)
    })

    it('should truncate decimal strings', () => {
      const result = harness.evaluate(StringTransformers.ToInt()).withInput('123.45')
      expect(result).toBe(123)
    })

    it('should handle negative numbers', () => {
      const result = harness.evaluate(StringTransformers.ToInt()).withInput('-456')
      expect(result).toBe(-456)
    })

    it('should handle negative decimals by truncating', () => {
      const result = harness.evaluate(StringTransformers.ToInt()).withInput('-456.789')
      expect(result).toBe(-456)
    })

    it('should handle strings with leading/trailing spaces', () => {
      const result = harness.evaluate(StringTransformers.ToInt()).withInput('  123  ')
      expect(result).toBe(123)
    })

    it('should throw for empty string', () => {
      expect(() => harness.evaluate(StringTransformers.ToInt()).withInput('')).toThrow('is not a valid number')
      expect(() => harness.evaluate(StringTransformers.ToInt()).withInput('')).toThrow(TypeError)
    })

    it('should throw for whitespace-only string', () => {
      expect(() => harness.evaluate(StringTransformers.ToInt()).withInput('   ')).toThrow('is not a valid number')
    })

    it('should throw for non-numeric input', () => {
      expect(() => harness.evaluate(StringTransformers.ToInt()).withInput('not a number')).toThrow(
        'is not a valid number',
      )
    })

    it('should throw for partial numeric input', () => {
      expect(() => harness.evaluate(StringTransformers.ToInt()).withInput('123abc')).toThrow('is not a valid number')
    })

    it('should throw for Infinity', () => {
      expect(() => harness.evaluate(StringTransformers.ToInt()).withInput('Infinity')).toThrow('is not a valid number')
    })

    it('should throw error for non-string values', () => {
      expect(() => harness.evaluate(StringTransformers.ToInt()).withInput(123)).toThrow(
        'String.ToInt: value failed schema validation',
      )
    })

    it('should return a function expression when called', () => {
      const expr = StringTransformers.ToInt()
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'String.ToInt',
        arguments: [],
      })
    })
  })

  describe('ToFloat', () => {
    it('should convert string to float', () => {
      const result = harness.evaluate(StringTransformers.ToFloat()).withInput('123.45')
      expect(result).toBe(123.45)
    })

    it('should handle integers', () => {
      const result = harness.evaluate(StringTransformers.ToFloat()).withInput('123')
      expect(result).toBe(123)
    })

    it('should handle negative numbers', () => {
      const result = harness.evaluate(StringTransformers.ToFloat()).withInput('-456.789')
      expect(result).toBe(-456.789)
    })

    it('should handle scientific notation', () => {
      const result = harness.evaluate(StringTransformers.ToFloat()).withInput('1.23e5')
      expect(result).toBe(123000)
    })

    it('should handle strings with leading/trailing spaces', () => {
      const result = harness.evaluate(StringTransformers.ToFloat()).withInput('  3.14159  ')
      expect(result).toBeCloseTo(3.14159)
    })

    it('should throw for empty string', () => {
      expect(() => harness.evaluate(StringTransformers.ToFloat()).withInput('')).toThrow('is not a valid number')
      expect(() => harness.evaluate(StringTransformers.ToFloat()).withInput('')).toThrow(TypeError)
    })

    it('should throw for whitespace-only string', () => {
      expect(() => harness.evaluate(StringTransformers.ToFloat()).withInput('   ')).toThrow('is not a valid number')
    })

    it('should handle very small decimals', () => {
      const result = harness.evaluate(StringTransformers.ToFloat()).withInput('0.000001')
      expect(result).toBe(0.000001)
    })

    it('should throw for non-numeric input', () => {
      expect(() => harness.evaluate(StringTransformers.ToFloat()).withInput('not a number')).toThrow(
        'is not a valid number',
      )
    })

    it('should throw for partial numeric input', () => {
      expect(() => harness.evaluate(StringTransformers.ToFloat()).withInput('123.45abc')).toThrow(
        'is not a valid number',
      )
    })

    it('should throw for Infinity', () => {
      expect(() => harness.evaluate(StringTransformers.ToFloat()).withInput('Infinity')).toThrow(
        'is not a valid number',
      )
    })

    it('should throw error for non-string values', () => {
      expect(() => harness.evaluate(StringTransformers.ToFloat()).withInput(123.45)).toThrow(
        'String.ToFloat: value failed schema validation',
      )
    })

    it('should return a function expression when called', () => {
      const expr = StringTransformers.ToFloat()
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'String.ToFloat',
        arguments: [],
      })
    })
  })

  describe('ToArray', () => {
    it('should split string into character array by default', () => {
      const result = harness.evaluate(StringTransformers.ToArray()).withInput('hello')
      expect(result).toEqual(['h', 'e', 'l', 'l', 'o'])
    })

    it('should split string by comma separator', () => {
      const result = harness.evaluate(StringTransformers.ToArray(',')).withInput('hello,world,test')
      expect(result).toEqual(['hello', 'world', 'test'])
    })

    it('should split string by space separator', () => {
      const result = harness.evaluate(StringTransformers.ToArray(' ')).withInput('hello world test')
      expect(result).toEqual(['hello', 'world', 'test'])
    })

    it('should split string by custom separator', () => {
      const result = harness.evaluate(StringTransformers.ToArray('-')).withInput('a-b-c-d')
      expect(result).toEqual(['a', 'b', 'c', 'd'])
    })

    it('should handle empty string', () => {
      const result = harness.evaluate(StringTransformers.ToArray()).withInput('')
      expect(result).toEqual([])
    })

    it('should handle empty string with separator', () => {
      const result = harness.evaluate(StringTransformers.ToArray(',')).withInput('')
      expect(result).toEqual([''])
    })

    it('should handle separator not found', () => {
      const result = harness.evaluate(StringTransformers.ToArray(',')).withInput('hello')
      expect(result).toEqual(['hello'])
    })

    it('should handle multi-character separator', () => {
      const result = harness.evaluate(StringTransformers.ToArray('::')).withInput('hello::world::test')
      expect(result).toEqual(['hello', 'world', 'test'])
    })

    it('should handle consecutive separators', () => {
      const result = harness.evaluate(StringTransformers.ToArray(',')).withInput('a,,b')
      expect(result).toEqual(['a', '', 'b'])
    })

    it('should throw error for non-string values', () => {
      expect(() => harness.evaluate(StringTransformers.ToArray()).withInput(123)).toThrow(
        'String.ToArray: value failed schema validation',
      )
    })

    it('should return a function expression when called', () => {
      const expr = StringTransformers.ToArray(',')
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'String.ToArray',
        arguments: [','],
      })
    })
  })

  describe('ToDate', () => {
    it('should parse UK format with slash separator (DD/MM/YYYY)', () => {
      const result = harness.evaluate(StringTransformers.ToDate()).withInput('15/03/2024') as Date
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(2) // March is month 2 (0-indexed)
      expect(result.getDate()).toBe(15)
    })

    it('should parse UK format with dash separator (DD-MM-YYYY)', () => {
      const result = harness.evaluate(StringTransformers.ToDate()).withInput('15-03-2024') as Date
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(2)
      expect(result.getDate()).toBe(15)
    })

    it('should handle single-digit days and months', () => {
      const result = harness.evaluate(StringTransformers.ToDate()).withInput('5/3/2024') as Date
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(2)
      expect(result.getDate()).toBe(5)
    })

    it('should handle end of year dates', () => {
      const result = harness.evaluate(StringTransformers.ToDate()).withInput('31/12/2024') as Date
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(11) // December (0-indexed)
      expect(result.getDate()).toBe(31)
    })

    it('should handle leap year dates', () => {
      const result = harness.evaluate(StringTransformers.ToDate()).withInput('29/02/2024') as Date
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(1) // February (0-indexed)
      expect(result.getDate()).toBe(29)
    })

    it('should handle strings with leading/trailing spaces', () => {
      const result = harness.evaluate(StringTransformers.ToDate()).withInput('  15/03/2024  ') as Date
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(2)
      expect(result.getDate()).toBe(15)
    })

    it('should throw for empty string', () => {
      expect(() => harness.evaluate(StringTransformers.ToDate()).withInput('')).toThrow('is not a valid date')
      expect(() => harness.evaluate(StringTransformers.ToDate()).withInput('')).toThrow(TypeError)
    })

    it('should throw for whitespace-only string', () => {
      expect(() => harness.evaluate(StringTransformers.ToDate()).withInput('   ')).toThrow('is not a valid date')
    })

    it('should parse ISO format (YYYY-MM-DD)', () => {
      const result = harness.evaluate(StringTransformers.ToDate()).withInput('2024-03-15') as Date
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(2)
      expect(result.getDate()).toBe(15)
    })

    it('should parse ISO format with time and timezone', () => {
      const result = harness.evaluate(StringTransformers.ToDate()).withInput('2024-03-15T14:30:00Z') as Date
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(2)
      expect(result.getDate()).toBe(15)
    })

    it('should parse ISO timestamp that crosses local date boundary', () => {
      // Arrange
      const input = '2026-04-27T23:05:36.647Z'

      // Act
      const result = harness.evaluate(StringTransformers.ToDate()).withInput(input) as Date

      // Assert
      expect(result).toBeInstanceOf(Date)
      expect(result.toISOString()).toBe(input)
    })

    it('should throw for non realistic ISO dates that js would silently roll over', () => {
      expect(() => harness.evaluate(StringTransformers.ToDate()).withInput('2026-02-30')).toThrow('is not a valid date')
      expect(() => harness.evaluate(StringTransformers.ToDate()).withInput('2026-02-30T12:00:00Z')).toThrow(
        'is not a valid date',
      )
      expect(() => harness.evaluate(StringTransformers.ToDate()).withInput('2024-04-31')).toThrow('is not a valid date')
      expect(() => harness.evaluate(StringTransformers.ToDate()).withInput('2023-02-29')).toThrow('is not a valid date')
    })

    it('should throw for US format (not supported)', () => {
      expect(() => harness.evaluate(StringTransformers.ToDate()).withInput('03/15/2024')).toThrow('is not a valid date')
    })

    it('should throw for invalid date string', () => {
      expect(() => harness.evaluate(StringTransformers.ToDate()).withInput('not a date')).toThrow('is not a valid date')
    })

    it('should throw for invalid day', () => {
      expect(() => harness.evaluate(StringTransformers.ToDate()).withInput('32/03/2024')).toThrow('is not a valid date')
    })

    it('should throw for invalid month', () => {
      expect(() => harness.evaluate(StringTransformers.ToDate()).withInput('15/13/2024')).toThrow('is not a valid date')
    })

    it('should throw for invalid leap year date', () => {
      expect(() => harness.evaluate(StringTransformers.ToDate()).withInput('29/02/2023')).toThrow('is not a valid date')
    })

    it('should throw for wrong format', () => {
      expect(() => harness.evaluate(StringTransformers.ToDate()).withInput('2024/03/15')).toThrow('is not a valid date')
    })

    it('should throw for partial dates', () => {
      expect(() => harness.evaluate(StringTransformers.ToDate()).withInput('15/03')).toThrow('is not a valid date')
    })

    it('should throw error for non-string values', () => {
      expect(() => harness.evaluate(StringTransformers.ToDate()).withInput(123)).toThrow(
        'String.ToDate: value failed schema validation',
      )
      // `null` is a real value, so it flows through to the transformer and fails its string assertion.
      expect(() => harness.evaluate(StringTransformers.ToDate()).withInput(null)).toThrow(
        'String.ToDate: value failed schema validation',
      )
      // An undefined input short-circuits to undefined without calling the transformer.
      expect(harness.evaluate(StringTransformers.ToDate()).withInput(undefined)).toBeUndefined()
    })

    it('should return a function expression when called', () => {
      const expr = StringTransformers.ToDate()
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'String.ToDate',
        arguments: [],
      })
    })
  })

  describe('FormatDate', () => {
    it('should format ISO date as UK long date when options are omitted', () => {
      // Arrange
      const input = '2024-03-15'

      // Act
      const result = harness.evaluate(StringTransformers.FormatDate()).withInput(input)

      // Assert
      expect(result).toBe('15 March 2024')
    })

    it('should format ISO timestamp using UK timezone when timestamp crosses UTC date boundary', () => {
      // Arrange
      const input = '2026-04-27T23:30:00.000Z'

      // Act
      const result = harness.evaluate(StringTransformers.FormatDate()).withInput(input)

      // Assert
      expect(result).toBe('28 April 2026')
    })

    it('should format UK date as UK long date when locale is omitted', () => {
      // Arrange
      const input = '15/03/2024'

      // Act
      const result = harness.evaluate(StringTransformers.FormatDate({ dateStyle: 'long' })).withInput(input)

      // Assert
      expect(result).toBe('15 March 2024')
    })

    it('should format date with supplied locale', () => {
      // Arrange
      const input = '2024-03-15'

      // Act
      const result = harness
        .evaluate(StringTransformers.FormatDate({ locale: 'en-US', dateStyle: 'long' }))
        .withInput(input)

      // Assert
      expect(result).toBe('March 15, 2024')
    })

    it('should format date with supplied Intl options', () => {
      // Arrange
      const input = '2024-03-15'

      // Act
      const result = harness
        .evaluate(
          StringTransformers.FormatDate({
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }),
        )
        .withInput(input)

      // Assert
      expect(result).toBe('15/03/2024')
    })

    it('should throw for invalid date string', () => {
      // Arrange
      const input = 'not a date'

      // Act
      const act = () => harness.evaluate(StringTransformers.FormatDate()).withInput(input)

      // Assert
      expect(act).toThrow('Transformer.String.FormatDate: "not a date" is not a valid date')
      expect(act).toThrow(TypeError)
    })

    it('should throw error for non-string values', () => {
      // Arrange
      const input = 123

      // Act
      const act = () => harness.evaluate(StringTransformers.FormatDate()).withInput(input)

      // Assert
      expect(act).toThrow('String.FormatDate: value failed schema validation')
    })

    it('should return a function expression when called without options', () => {
      // Arrange
      const expr = StringTransformers.FormatDate()

      // Act
      const result = expr

      // Assert
      expect(result).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'String.FormatDate',
        arguments: [],
      })
    })

    it('should return a function expression when called with options', () => {
      // Arrange
      const options: Intl.DateTimeFormatOptions = { dateStyle: 'long' }

      // Act
      const result = StringTransformers.FormatDate(options)

      // Assert
      expect(result).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'String.FormatDate',
        arguments: [options],
      })
    })
  })

  describe('FormatDate', () => {
    it('should format ISO date as UK long date when options are omitted', () => {
      // Arrange
      const input = '2024-03-15'

      // Act
      const result = harness.evaluate(StringTransformers.FormatDate()).withInput(input)

      // Assert
      expect(result).toBe('15 March 2024')
    })

    it('should format UK date as UK long date when locale is omitted', () => {
      // Arrange
      const input = '15/03/2024'

      // Act
      const result = harness.evaluate(StringTransformers.FormatDate({ dateStyle: 'long' })).withInput(input)

      // Assert
      expect(result).toBe('15 March 2024')
    })

    it('should format date with supplied locale', () => {
      // Arrange
      const input = '2024-03-15'

      // Act
      const result = harness
        .evaluate(StringTransformers.FormatDate({ locale: 'en-US', dateStyle: 'long' }))
        .withInput(input)

      // Assert
      expect(result).toBe('March 15, 2024')
    })

    it('should format ISO timestamp that crosses local date boundary', () => {
      // Arrange
      const input = '2026-04-27T23:05:36.647Z'

      // Act
      const result = harness.evaluate(StringTransformers.FormatDate()).withInput(input)

      // Assert
      expect(result).toBe('28 April 2026')
    })

    it('should format date with supplied Intl options', () => {
      // Arrange
      const input = '2024-03-15'

      // Act
      const result = harness
        .evaluate(
          StringTransformers.FormatDate({
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }),
        )
        .withInput(input)

      // Assert
      expect(result).toBe('15/03/2024')
    })

    it('should throw for invalid date string', () => {
      // Arrange
      const input = 'not a date'

      // Act
      const act = () => harness.evaluate(StringTransformers.FormatDate()).withInput(input)

      // Assert
      expect(act).toThrow('Transformer.String.FormatDate: "not a date" is not a valid date')
    })

    it('should throw error for non-string values', () => {
      // Arrange
      const input = 123

      // Act
      const act = () => harness.evaluate(StringTransformers.FormatDate()).withInput(input)

      // Assert
      expect(act).toThrow('String.FormatDate: value failed schema validation')
    })

    it('should return a function expression when called without options', () => {
      // Arrange
      const expr = StringTransformers.FormatDate()

      // Act
      const result = expr

      // Assert
      expect(result).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'String.FormatDate',
        arguments: [],
      })
    })

    it('should return a function expression when called with options', () => {
      // Arrange
      const options: Intl.DateTimeFormatOptions = { dateStyle: 'long' }

      // Act
      const result = StringTransformers.FormatDate(options)

      // Assert
      expect(result).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'String.FormatDate',
        arguments: [options],
      })
    })
  })

  describe('ToISODate', () => {
    it('should convert UK date format to ISO format', () => {
      expect(harness.evaluate(StringTransformers.ToISODate()).withInput('15/03/2024')).toBe('2024-03-15')
    })

    it('should handle single digit day and month', () => {
      expect(harness.evaluate(StringTransformers.ToISODate()).withInput('5/3/2024')).toBe('2024-03-05')
      expect(harness.evaluate(StringTransformers.ToISODate()).withInput('1/1/2024')).toBe('2024-01-01')
    })

    it('should handle dash separator', () => {
      expect(harness.evaluate(StringTransformers.ToISODate()).withInput('15-03-2024')).toBe('2024-03-15')
    })

    it('should handle leading/trailing whitespace', () => {
      expect(harness.evaluate(StringTransformers.ToISODate()).withInput('  15/03/2024  ')).toBe('2024-03-15')
    })

    it('should handle end of year dates', () => {
      expect(harness.evaluate(StringTransformers.ToISODate()).withInput('31/12/2024')).toBe('2024-12-31')
    })

    it('should handle leap year dates', () => {
      expect(harness.evaluate(StringTransformers.ToISODate()).withInput('29/02/2024')).toBe('2024-02-29')
    })

    it('should throw for empty string', () => {
      expect(() => harness.evaluate(StringTransformers.ToISODate()).withInput('')).toThrow('is not a valid date')
      expect(() => harness.evaluate(StringTransformers.ToISODate()).withInput('')).toThrow(TypeError)
    })

    it('should throw for whitespace only', () => {
      expect(() => harness.evaluate(StringTransformers.ToISODate()).withInput('   ')).toThrow('is not a valid date')
    })

    it('should throw for ISO format input', () => {
      expect(() => harness.evaluate(StringTransformers.ToISODate()).withInput('2024-03-15')).toThrow(
        'is not a valid UK date',
      )
      expect(() => harness.evaluate(StringTransformers.ToISODate()).withInput('2024-03-15')).toThrow(TypeError)
    })

    it('should throw for invalid day', () => {
      expect(() => harness.evaluate(StringTransformers.ToISODate()).withInput('32/03/2024')).toThrow(
        'is not a valid date',
      )
    })

    it('should throw for invalid month', () => {
      expect(() => harness.evaluate(StringTransformers.ToISODate()).withInput('15/13/2024')).toThrow(
        'is not a valid date',
      )
    })

    it('should throw for invalid leap year date', () => {
      expect(() => harness.evaluate(StringTransformers.ToISODate()).withInput('29/02/2023')).toThrow(
        'is not a valid date',
      )
    })

    it('should throw for wrong format', () => {
      expect(() => harness.evaluate(StringTransformers.ToISODate()).withInput('2024/03/15')).toThrow(
        'is not a valid UK date',
      )
    })

    it('should throw for partial dates', () => {
      expect(() => harness.evaluate(StringTransformers.ToISODate()).withInput('15/03')).toThrow(
        'is not a valid UK date',
      )
    })

    it('should throw error for non-string values', () => {
      expect(() => harness.evaluate(StringTransformers.ToISODate()).withInput(123)).toThrow(
        'String.ToISODate: value failed schema validation',
      )
      // `null` is a real value, so it flows through to the transformer and fails its string assertion.
      expect(() => harness.evaluate(StringTransformers.ToISODate()).withInput(null)).toThrow(
        'String.ToISODate: value failed schema validation',
      )
      // An undefined input short-circuits to undefined without calling the transformer.
      expect(harness.evaluate(StringTransformers.ToISODate()).withInput(undefined)).toBeUndefined()
    })

    it('should return a function expression when called', () => {
      const expr = StringTransformers.ToISODate()
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'String.ToISODate',
        arguments: [],
      })
    })
  })

  describe('ToTimestampDate', () => {
    it('should convert an epoch timestamp string to a Date', () => {
      // Arrange
      const timestamp = '1710460800000'

      // Act
      const result = harness.evaluate(StringTransformers.ToTimestampDate()).withInput(timestamp) as Date

      // Assert
      expect(result).toBeInstanceOf(Date)
      expect(result.toISOString()).toBe('2024-03-15T00:00:00.000Z')
    })

    it('should throw TypeError for invalid timestamp strings', () => {
      // Arrange
      const invalidTimestamp = 'not-a-timestamp'

      // Act
      const act = () => harness.evaluate(StringTransformers.ToTimestampDate()).withInput(invalidTimestamp)

      // Assert
      expect(act).toThrow('is not a timestamp')
      expect(act).toThrow(TypeError)
    })
  })

  describe('EscapeHtml', () => {
    it('should escape angle brackets', () => {
      // Arrange
      const input = '<script>alert(1)</script>'

      // Act
      const result = harness.evaluate(StringTransformers.EscapeHtml()).withInput(input)

      // Assert
      expect(result).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    })

    it('should escape double quotes', () => {
      // Arrange
      const input = '"><img src=x onerror=alert(1)>'

      // Act
      const result = harness.evaluate(StringTransformers.EscapeHtml()).withInput(input)

      // Assert
      expect(result).toBe('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;')
    })

    it('should escape single quotes', () => {
      // Arrange
      const input = "it's a test"

      // Act
      const result = harness.evaluate(StringTransformers.EscapeHtml()).withInput(input)

      // Assert
      expect(result).toBe('it&#39;s a test')
    })

    it('should escape ampersands', () => {
      // Arrange
      const input = 'foo & bar'

      // Act
      const result = harness.evaluate(StringTransformers.EscapeHtml()).withInput(input)

      // Assert
      expect(result).toBe('foo &amp; bar')
    })

    it('should return safe strings unchanged', () => {
      // Arrange
      const input = 'Buy milk'

      // Act
      const result = harness.evaluate(StringTransformers.EscapeHtml()).withInput(input)

      // Assert
      expect(result).toBe('Buy milk')
    })

    it('should handle empty strings', () => {
      // Arrange / Act
      const result = harness.evaluate(StringTransformers.EscapeHtml()).withInput('')

      // Assert
      expect(result).toBe('')
    })

    it('should throw error for non-string values', () => {
      expect(() => harness.evaluate(StringTransformers.EscapeHtml()).withInput(123)).toThrow(
        'String.EscapeHtml: value failed schema validation',
      )
    })

    it('should return a function expression when called', () => {
      // Arrange / Act
      const expr = StringTransformers.EscapeHtml()

      // Assert
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'String.EscapeHtml',
        arguments: [],
      })
    })
  })
})
