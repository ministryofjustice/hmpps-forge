import { StringTransformers, StringTransformersRegistry } from './stringTransformers'
import { FunctionType } from '../../form/types/enums'

describe('String Transformers', () => {
  describe('Trim', () => {
    const { evaluate } = StringTransformersRegistry.Trim

    it('should remove leading and trailing whitespace', () => {
      const result = evaluate('  hello world  ')
      expect(result).toBe('hello world')
    })

    it('should handle strings with no whitespace', () => {
      const result = evaluate('hello')
      expect(result).toBe('hello')
    })

    it('should handle empty strings', () => {
      const result = evaluate('')
      expect(result).toBe('')
    })

    it('should handle strings with only whitespace', () => {
      const result = evaluate('   ')
      expect(result).toBe('')
    })

    it('should preserve internal whitespace', () => {
      const result = evaluate('  hello   world  ')
      expect(result).toBe('hello   world')
    })

    it('should throw error for non-string values', () => {
      expect(() => evaluate(123)).toThrow('Transformer.String.Trim expects a string but received number.')
    })

    it('should return a function expression when called', () => {
      const expr = StringTransformers.Trim()
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'Trim',
        arguments: [],
      })
    })
  })

  describe('ToUpperCase', () => {
    const { evaluate } = StringTransformersRegistry.ToUpperCase

    it('should convert string to uppercase', () => {
      const result = evaluate('hello world')
      expect(result).toBe('HELLO WORLD')
    })

    it('should handle already uppercase strings', () => {
      const result = evaluate('HELLO WORLD')
      expect(result).toBe('HELLO WORLD')
    })

    it('should handle mixed case strings', () => {
      const result = evaluate('HeLLo WoRLd')
      expect(result).toBe('HELLO WORLD')
    })

    it('should handle empty strings', () => {
      const result = evaluate('')
      expect(result).toBe('')
    })

    it('should handle strings with numbers and symbols', () => {
      const result = evaluate('hello123!@#')
      expect(result).toBe('HELLO123!@#')
    })

    it('should throw error for non-string values', () => {
      expect(() => evaluate(123)).toThrow('Transformer.String.ToUpperCase expects a string but received number.')
    })
  })

  describe('ToLowerCase', () => {
    const { evaluate } = StringTransformersRegistry.ToLowerCase

    it('should convert string to lowercase', () => {
      const result = evaluate('HELLO WORLD')
      expect(result).toBe('hello world')
    })

    it('should handle already lowercase strings', () => {
      const result = evaluate('hello world')
      expect(result).toBe('hello world')
    })

    it('should handle mixed case strings', () => {
      const result = evaluate('HeLLo WoRLd')
      expect(result).toBe('hello world')
    })

    it('should handle empty strings', () => {
      const result = evaluate('')
      expect(result).toBe('')
    })

    it('should throw error for non-string values', () => {
      expect(() => evaluate(123)).toThrow('Transformer.String.ToLowerCase expects a string but received number.')
    })
  })

  describe('ToTitleCase', () => {
    const { evaluate } = StringTransformersRegistry.ToTitleCase

    it('should capitalize first letter of each word', () => {
      const result = evaluate('hello world')
      expect(result).toBe('Hello World')
    })

    it('should handle single word', () => {
      const result = evaluate('hello')
      expect(result).toBe('Hello')
    })

    it('should handle mixed case input', () => {
      const result = evaluate('hELLo WoRLD')
      expect(result).toBe('Hello World')
    })

    it('should handle words with apostrophes', () => {
      const result = evaluate("don't worry")
      expect(result).toBe("Don't Worry")
    })

    it('should handle empty strings', () => {
      const result = evaluate('')
      expect(result).toBe('')
    })

    it('should throw error for non-string values', () => {
      expect(() => evaluate(123)).toThrow('Transformer.String.ToTitleCase expects a string but received number.')
    })
  })

  describe('Capitalize', () => {
    const { evaluate } = StringTransformersRegistry.Capitalize

    it('should capitalize first letter only', () => {
      const result = evaluate('hello world')
      expect(result).toBe('Hello world')
    })

    it('should handle single character', () => {
      const result = evaluate('h')
      expect(result).toBe('H')
    })

    it('should handle already capitalized strings', () => {
      const result = evaluate('Hello world')
      expect(result).toBe('Hello world')
    })

    it('should handle empty strings', () => {
      const result = evaluate('')
      expect(result).toBe('')
    })

    it('should throw error for non-string values', () => {
      expect(() => evaluate(123)).toThrow('Transformer.String.Capitalize expects a string but received number.')
    })
  })

  describe('Possessive', () => {
    const { evaluate } = StringTransformersRegistry.Possessive

    it('should add apostrophe-s for names not ending in s', () => {
      expect(evaluate('John')).toBe("John's")
    })

    it('should add only apostrophe for names ending in s', () => {
      expect(evaluate('James')).toBe("James'")
    })

    it('should handle names ending in uppercase S', () => {
      expect(evaluate('JAMES')).toBe("JAMES'")
    })

    it('should handle single character names', () => {
      expect(evaluate('J')).toBe("J's")
      expect(evaluate('S')).toBe("S'")
    })

    it('should handle empty strings', () => {
      expect(evaluate('')).toBe('')
    })

    it('should handle names with mixed case', () => {
      expect(evaluate('Chris')).toBe("Chris'")
      expect(evaluate('Tom')).toBe("Tom's")
    })

    it('should throw error for non-string values', () => {
      expect(() => evaluate(123)).toThrow('Transformer.String.Possessive expects a string but received number.')
    })

    it('should return a function expression when called', () => {
      const expr = StringTransformers.Possessive()
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'Possessive',
        arguments: [],
      })
    })
  })

  describe('Substring', () => {
    const { evaluate } = StringTransformersRegistry.Substring

    it('should extract substring with start and end positions', () => {
      const result = evaluate('hello world', 0, 5)
      expect(result).toBe('hello')
    })

    it('should extract substring with only start position', () => {
      const result = evaluate('hello world', 6)
      expect(result).toBe('world')
    })

    it('should handle start position beyond string length', () => {
      const result = evaluate('hello', 10)
      expect(result).toBe('')
    })

    it('should handle negative start position', () => {
      const result = evaluate('hello', -2, 3)
      expect(result).toBe('hel')
    })

    it('should throw error for non-string values', () => {
      expect(() => evaluate(123, 0, 1)).toThrow('Transformer.String.Substring expects a string but received number.')
    })
  })

  describe('Replace', () => {
    const { evaluate } = StringTransformersRegistry.Replace

    it('should replace all occurrences of search string', () => {
      const result = evaluate('hello world hello', 'hello', 'hi')
      expect(result).toBe('hi world hi')
    })

    it('should handle case-sensitive replacement', () => {
      const result = evaluate('Hello world hello', 'hello', 'hi')
      expect(result).toBe('Hello world hi')
    })

    it('should handle replacement with empty string', () => {
      const result = evaluate('hello world', 'hello ', '')
      expect(result).toBe('world')
    })

    it('should handle search string not found', () => {
      const result = evaluate('hello world', 'xyz', 'abc')
      expect(result).toBe('hello world')
    })

    it('should throw error for non-string values', () => {
      expect(() => evaluate(123, 'a', 'b')).toThrow('Transformer.String.Replace expects a string but received number.')
    })
  })

  describe('PadStart', () => {
    const { evaluate } = StringTransformersRegistry.PadStart

    it('should pad string to target length with spaces', () => {
      const result = evaluate('5', 3)
      expect(result).toBe('  5')
    })

    it('should pad string with custom character', () => {
      const result = evaluate('5', 3, '0')
      expect(result).toBe('005')
    })

    it('should not pad if string is already longer than target', () => {
      const result = evaluate('hello', 3)
      expect(result).toBe('hello')
    })

    it('should handle empty string', () => {
      const result = evaluate('', 3, 'x')
      expect(result).toBe('xxx')
    })

    it('should throw error for non-string values', () => {
      expect(() => evaluate(123, 5)).toThrow('Transformer.String.PadStart expects a string but received number.')
    })
  })

  describe('PadEnd', () => {
    const { evaluate } = StringTransformersRegistry.PadEnd

    it('should pad string to target length with spaces', () => {
      const result = evaluate('5', 3)
      expect(result).toBe('5  ')
    })

    it('should pad string with custom character', () => {
      const result = evaluate('5', 3, '0')
      expect(result).toBe('500')
    })

    it('should not pad if string is already longer than target', () => {
      const result = evaluate('hello', 3)
      expect(result).toBe('hello')
    })

    it('should handle empty string', () => {
      const result = evaluate('', 3, 'x')
      expect(result).toBe('xxx')
    })

    it('should throw error for non-string values', () => {
      expect(() => evaluate(123, 5)).toThrow('Transformer.String.PadEnd expects a string but received number.')
    })
  })

  describe('ToInt', () => {
    const { evaluate } = StringTransformersRegistry.ToInt

    it('should convert string to integer', () => {
      const result = evaluate('123')
      expect(result).toBe(123)
    })

    it('should truncate decimal strings', () => {
      const result = evaluate('123.45')
      expect(result).toBe(123)
    })

    it('should handle negative numbers', () => {
      const result = evaluate('-456')
      expect(result).toBe(-456)
    })

    it('should handle negative decimals by truncating', () => {
      const result = evaluate('-456.789')
      expect(result).toBe(-456)
    })

    it('should handle strings with leading/trailing spaces', () => {
      const result = evaluate('  123  ')
      expect(result).toBe(123)
    })

    it('should throw for empty string', () => {
      expect(() => evaluate('')).toThrow('is not a valid number')
    })

    it('should throw for whitespace-only string', () => {
      expect(() => evaluate('   ')).toThrow('is not a valid number')
    })

    it('should throw for non-numeric input', () => {
      expect(() => evaluate('not a number')).toThrow('is not a valid number')
    })

    it('should throw for partial numeric input', () => {
      expect(() => evaluate('123abc')).toThrow('is not a valid number')
    })

    it('should throw for Infinity', () => {
      expect(() => evaluate('Infinity')).toThrow('is not a valid number')
    })

    it('should throw error for non-string values', () => {
      expect(() => evaluate(123)).toThrow('Transformer.String.ToInt expects a string but received number.')
    })

    it('should return a function expression when called', () => {
      const expr = StringTransformers.ToInt()
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'ToInt',
        arguments: [],
      })
    })
  })

  describe('ToFloat', () => {
    const { evaluate } = StringTransformersRegistry.ToFloat

    it('should convert string to float', () => {
      const result = evaluate('123.45')
      expect(result).toBe(123.45)
    })

    it('should handle integers', () => {
      const result = evaluate('123')
      expect(result).toBe(123)
    })

    it('should handle negative numbers', () => {
      const result = evaluate('-456.789')
      expect(result).toBe(-456.789)
    })

    it('should handle scientific notation', () => {
      const result = evaluate('1.23e5')
      expect(result).toBe(123000)
    })

    it('should handle strings with leading/trailing spaces', () => {
      const result = evaluate('  3.14159  ')
      expect(result).toBeCloseTo(3.14159)
    })

    it('should throw for empty string', () => {
      expect(() => evaluate('')).toThrow('is not a valid number')
    })

    it('should throw for whitespace-only string', () => {
      expect(() => evaluate('   ')).toThrow('is not a valid number')
    })

    it('should handle very small decimals', () => {
      const result = evaluate('0.000001')
      expect(result).toBe(0.000001)
    })

    it('should throw for non-numeric input', () => {
      expect(() => evaluate('not a number')).toThrow('is not a valid number')
    })

    it('should throw for partial numeric input', () => {
      expect(() => evaluate('123.45abc')).toThrow('is not a valid number')
    })

    it('should throw for Infinity', () => {
      expect(() => evaluate('Infinity')).toThrow('is not a valid number')
    })

    it('should throw error for non-string values', () => {
      expect(() => evaluate(123.45)).toThrow('Transformer.String.ToFloat expects a string but received number.')
    })

    it('should return a function expression when called', () => {
      const expr = StringTransformers.ToFloat()
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'ToFloat',
        arguments: [],
      })
    })
  })

  describe('ToArray', () => {
    const { evaluate } = StringTransformersRegistry.ToArray

    it('should split string into character array by default', () => {
      const result = evaluate('hello')
      expect(result).toEqual(['h', 'e', 'l', 'l', 'o'])
    })

    it('should split string by comma separator', () => {
      const result = evaluate('hello,world,test', ',')
      expect(result).toEqual(['hello', 'world', 'test'])
    })

    it('should split string by space separator', () => {
      const result = evaluate('hello world test', ' ')
      expect(result).toEqual(['hello', 'world', 'test'])
    })

    it('should split string by custom separator', () => {
      const result = evaluate('a-b-c-d', '-')
      expect(result).toEqual(['a', 'b', 'c', 'd'])
    })

    it('should handle empty string', () => {
      const result = evaluate('')
      expect(result).toEqual([])
    })

    it('should handle empty string with separator', () => {
      const result = evaluate('', ',')
      expect(result).toEqual([''])
    })

    it('should handle separator not found', () => {
      const result = evaluate('hello', ',')
      expect(result).toEqual(['hello'])
    })

    it('should handle multi-character separator', () => {
      const result = evaluate('hello::world::test', '::')
      expect(result).toEqual(['hello', 'world', 'test'])
    })

    it('should handle consecutive separators', () => {
      const result = evaluate('a,,b', ',')
      expect(result).toEqual(['a', '', 'b'])
    })

    it('should throw error for non-string values', () => {
      expect(() => evaluate(123)).toThrow('Transformer.String.ToArray expects a string but received number.')
    })

    it('should return a function expression when called', () => {
      const expr = StringTransformers.ToArray(',')
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'ToArray',
        arguments: [','],
      })
    })
  })

  describe('ToDate', () => {
    const { evaluate } = StringTransformersRegistry.ToDate

    it('should parse UK format with slash separator (DD/MM/YYYY)', () => {
      const result = evaluate('15/03/2024')
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(2) // March is month 2 (0-indexed)
      expect(result.getDate()).toBe(15)
    })

    it('should parse UK format with dash separator (DD-MM-YYYY)', () => {
      const result = evaluate('15-03-2024')
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(2)
      expect(result.getDate()).toBe(15)
    })

    it('should handle single-digit days and months', () => {
      const result = evaluate('5/3/2024')
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(2)
      expect(result.getDate()).toBe(5)
    })

    it('should handle end of year dates', () => {
      const result = evaluate('31/12/2024')
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(11) // December (0-indexed)
      expect(result.getDate()).toBe(31)
    })

    it('should handle leap year dates', () => {
      const result = evaluate('29/02/2024')
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(1) // February (0-indexed)
      expect(result.getDate()).toBe(29)
    })

    it('should handle strings with leading/trailing spaces', () => {
      const result = evaluate('  15/03/2024  ')
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(2)
      expect(result.getDate()).toBe(15)
    })

    it('should throw for empty string', () => {
      expect(() => evaluate('')).toThrow('is not a valid date')
    })

    it('should throw for whitespace-only string', () => {
      expect(() => evaluate('   ')).toThrow('is not a valid date')
    })

    it('should parse ISO format (YYYY-MM-DD)', () => {
      const result = evaluate('2024-03-15')
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(2)
      expect(result.getDate()).toBe(15)
    })

    it('should parse ISO format with time and timezone', () => {
      const result = evaluate('2024-03-15T14:30:00Z')
      expect(result).toBeInstanceOf(Date)
      expect(result.getFullYear()).toBe(2024)
      expect(result.getMonth()).toBe(2)
      expect(result.getDate()).toBe(15)
    })

    it('should throw for non realistic ISO dates that js would silently roll over', () => {
      expect(() => evaluate('2026-02-30')).toThrow('is not a valid date')
      expect(() => evaluate('2024-04-31')).toThrow('is not a valid date')
      expect(() => evaluate('2023-02-29')).toThrow('is not a valid date')
    })

    it('should throw for US format (not supported)', () => {
      expect(() => evaluate('03/15/2024')).toThrow('is not a valid date')
    })

    it('should throw for invalid date string', () => {
      expect(() => evaluate('not a date')).toThrow('is not a valid date')
    })

    it('should throw for invalid day', () => {
      expect(() => evaluate('32/03/2024')).toThrow('is not a valid date')
    })

    it('should throw for invalid month', () => {
      expect(() => evaluate('15/13/2024')).toThrow('is not a valid date')
    })

    it('should throw for invalid leap year date', () => {
      expect(() => evaluate('29/02/2023')).toThrow('is not a valid date')
    })

    it('should throw for wrong format', () => {
      expect(() => evaluate('2024/03/15')).toThrow('is not a valid date')
    })

    it('should throw for partial dates', () => {
      expect(() => evaluate('15/03')).toThrow('is not a valid date')
    })

    it('should throw error for non-string values', () => {
      expect(() => evaluate(123)).toThrow('Transformer.String.ToDate expects a string but received number.')
      expect(() => evaluate(null)).toThrow('Transformer.String.ToDate expects a string but received object.')
      expect(() => evaluate(undefined)).toThrow('Transformer.String.ToDate expects a string but received undefined.')
    })

    it('should return a function expression when called', () => {
      const expr = StringTransformers.ToDate()
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'ToDate',
        arguments: [],
      })
    })
  })

  describe('ToISODate', () => {
    const { evaluate } = StringTransformersRegistry.ToISODate

    it('should convert UK date format to ISO format', () => {
      expect(evaluate('15/03/2024')).toBe('2024-03-15')
    })

    it('should handle single digit day and month', () => {
      expect(evaluate('5/3/2024')).toBe('2024-03-05')
      expect(evaluate('1/1/2024')).toBe('2024-01-01')
    })

    it('should handle dash separator', () => {
      expect(evaluate('15-03-2024')).toBe('2024-03-15')
    })

    it('should handle leading/trailing whitespace', () => {
      expect(evaluate('  15/03/2024  ')).toBe('2024-03-15')
    })

    it('should handle end of year dates', () => {
      expect(evaluate('31/12/2024')).toBe('2024-12-31')
    })

    it('should handle leap year dates', () => {
      expect(evaluate('29/02/2024')).toBe('2024-02-29')
    })

    it('should throw for empty string', () => {
      expect(() => evaluate('')).toThrow('is not a valid date')
    })

    it('should throw for whitespace only', () => {
      expect(() => evaluate('   ')).toThrow('is not a valid date')
    })

    it('should throw for ISO format input', () => {
      expect(() => evaluate('2024-03-15')).toThrow('is not a valid UK date')
    })

    it('should throw for invalid day', () => {
      expect(() => evaluate('32/03/2024')).toThrow('is not a valid date')
    })

    it('should throw for invalid month', () => {
      expect(() => evaluate('15/13/2024')).toThrow('is not a valid date')
    })

    it('should throw for invalid leap year date', () => {
      expect(() => evaluate('29/02/2023')).toThrow('is not a valid date')
    })

    it('should throw for wrong format', () => {
      expect(() => evaluate('2024/03/15')).toThrow('is not a valid UK date')
    })

    it('should throw for partial dates', () => {
      expect(() => evaluate('15/03')).toThrow('is not a valid UK date')
    })

    it('should throw error for non-string values', () => {
      expect(() => evaluate(123)).toThrow('Transformer.String.ToISODate expects a string but received number.')
      expect(() => evaluate(null)).toThrow('Transformer.String.ToISODate expects a string but received object.')
      expect(() => evaluate(undefined)).toThrow('Transformer.String.ToISODate expects a string but received undefined.')
    })

    it('should return a function expression when called', () => {
      const expr = StringTransformers.ToISODate()
      expect(expr).toEqual({
        type: FunctionType.TRANSFORMER,
        name: 'ToISODate',
        arguments: [],
      })
    })
  })

  describe('ToSentenceLength', () => {
    const { evaluate } = StringTransformersRegistry.ToSentenceLength

    describe('basic duration calculations', () => {
      it('should calculate years only', () => {
        expect(evaluate('2024-01-01', '2026-01-01')).toBe('(2 years)')
      })

      it('should calculate months only', () => {
        expect(evaluate('2024-01-01', '2024-07-01')).toBe('(6 months)')
      })

      it('should calculate days only', () => {
        expect(evaluate('2024-01-01', '2024-01-15')).toBe('(14 days)')
      })

      it('should calculate years and months', () => {
        expect(evaluate('2024-01-01', '2025-07-01')).toBe('(1 year and 6 months)')
      })

      it('should calculate months and days', () => {
        expect(evaluate('2024-01-31', '2024-03-01')).toBe('(1 month and 1 day)')
      })

      it('should calculate years and days', () => {
        expect(evaluate('2024-01-01', '2025-01-15')).toBe('(1 year and 14 days)')
      })

      it('should calculate years, months, and days', () => {
        expect(evaluate('2024-01-01', '2025-03-15')).toBe('(1 year, 2 months and 14 days)')
      })
    })

    describe('pluralisation', () => {
      it('should use singular "year" for 1 year', () => {
        expect(evaluate('2024-01-01', '2025-01-01')).toBe('(1 year)')
      })

      it('should use plural "years" for multiple years', () => {
        expect(evaluate('2024-01-01', '2027-01-01')).toBe('(3 years)')
      })

      it('should use singular "month" for 1 month', () => {
        expect(evaluate('2024-01-01', '2024-02-01')).toBe('(1 month)')
      })

      it('should use plural "months" for multiple months', () => {
        expect(evaluate('2024-01-01', '2024-04-01')).toBe('(3 months)')
      })

      it('should use singular "day" for 1 day', () => {
        expect(evaluate('2024-01-01', '2024-01-02')).toBe('(1 day)')
      })

      it('should use plural "days" for multiple days', () => {
        expect(evaluate('2024-01-01', '2024-01-05')).toBe('(4 days)')
      })

      it('should handle mixed singular and plural', () => {
        expect(evaluate('2024-01-01', '2026-02-03')).toBe('(2 years, 1 month and 2 days)')
      })
    })

    describe('empty and invalid inputs', () => {
      it('should return empty string for empty start date', () => {
        expect(evaluate('', '2024-01-01')).toBe('')
      })

      it('should return empty string for empty end date', () => {
        expect(evaluate('2024-01-01', '')).toBe('')
      })

      it('should return empty string for both empty dates', () => {
        expect(evaluate('', '')).toBe('')
      })

      it('should return empty string for whitespace-only start date', () => {
        expect(evaluate('   ', '2024-01-01')).toBe('')
      })

      it('should return empty string for whitespace-only end date', () => {
        expect(evaluate('2024-01-01', '   ')).toBe('')
      })

      it('should handle dates with leading/trailing whitespace', () => {
        expect(evaluate('  2024-01-01  ', '  2025-01-01  ')).toBe('(1 year)')
      })

      it('should return empty string for same dates', () => {
        expect(evaluate('2024-01-01', '2024-01-01')).toBe('')
      })

      it('should throw for non-string start date', () => {
        expect(() => evaluate(123, '2024-01-01')).toThrow(
          'Transformer.String.ToSentenceLength (startDate) expects a string but received number.',
        )
      })

      it('should throw for non-string end date', () => {
        expect(() => evaluate('2024-01-01', 123)).toThrow(
          'Transformer.String.ToSentenceLength (endDate) expects a string but received number.',
        )
      })

      it('should throw for null start date', () => {
        expect(() => evaluate(null, '2024-01-01')).toThrow(
          'Transformer.String.ToSentenceLength (startDate) expects a string but received object.',
        )
      })

      it('should throw for undefined end date', () => {
        expect(() => evaluate('2024-01-01', undefined)).toThrow(
          'Transformer.String.ToSentenceLength (endDate) expects a string but received undefined.',
        )
      })
    })

    describe('negative durations (end date before start date)', () => {
      it('should return empty string when end date is before start date by years', () => {
        expect(evaluate('2025-01-01', '2024-01-01')).toBe('')
      })

      it('should return empty string when end date is before start date by months', () => {
        expect(evaluate('2024-06-01', '2024-01-01')).toBe('')
      })

      it('should return empty string when end date is before start date by days', () => {
        expect(evaluate('2024-01-15', '2024-01-01')).toBe('')
      })
    })

    describe('date boundary edge cases', () => {
      it('should handle month with 31 days to month with 28 days', () => {
        const result = evaluate('2024-01-31', '2024-02-28')
        expect(result).toBe('(28 days)')
      })

      it('should handle leap year February 29 to next February 28', () => {
        expect(evaluate('2024-02-29', '2025-02-28')).toBe('(1 year)')
      })

      it('should handle leap year February 29 to next March 1', () => {
        expect(evaluate('2024-02-29', '2025-03-01')).toBe('(1 year and 1 day)')
      })

      it('should handle crossing year boundary', () => {
        expect(evaluate('2024-12-01', '2025-02-01')).toBe('(2 months)')
      })

      it('should handle end of year to start of year', () => {
        expect(evaluate('2024-12-31', '2025-01-01')).toBe('(1 day)')
      })

      it('should handle full leap year', () => {
        expect(evaluate('2024-01-01', '2025-01-01')).toBe('(1 year)')
      })

      it('should handle multiple leap years', () => {
        expect(evaluate('2016-01-01', '2024-01-02')).toBe('(8 years and 1 day)')
      })
    })

    describe('large durations', () => {
      it('should handle multi-decade spans', () => {
        expect(evaluate('2000-01-01', '2050-01-01')).toBe('(50 years)')
      })
    })

    describe('expression builder', () => {
      it('should return a function expression when called', () => {
        const expr = StringTransformers.ToSentenceLength('2025-01-01')
        expect(expr).toEqual({
          type: FunctionType.TRANSFORMER,
          name: 'ToSentenceLength',
          arguments: ['2025-01-01'],
        })
      })
    })
  })
})
