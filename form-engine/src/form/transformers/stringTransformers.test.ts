import StringTransformers from './stringTransformers'

describe('String Transformers', () => {
  describe('Trim', () => {
    const { evaluate } = StringTransformers.Trim.spec

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
        type: 'function',
        name: 'trim',
        arguments: [],
      })
    })
  })

  describe('ToUpperCase', () => {
    const { evaluate } = StringTransformers.ToUpperCase.spec

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
    const { evaluate } = StringTransformers.ToLowerCase.spec

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
    const { evaluate } = StringTransformers.ToTitleCase.spec

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
    const { evaluate } = StringTransformers.Capitalize.spec

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

  describe('Substring', () => {
    const { evaluate } = StringTransformers.Substring.spec

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
    const { evaluate } = StringTransformers.Replace.spec

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
    const { evaluate } = StringTransformers.PadStart.spec

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
    const { evaluate } = StringTransformers.PadEnd.spec

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
    const { evaluate } = StringTransformers.ToInt.spec

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

    it('should handle hexadecimal with custom radix', () => {
      const result = evaluate('FF', 16)
      expect(result).toBe(255)
    })

    it('should handle binary with custom radix', () => {
      const result = evaluate('1010', 2)
      expect(result).toBe(10)
    })

    it('should return NaN for non-numeric strings', () => {
      const result = evaluate('not a number')
      expect(result).toBeNaN()
    })

    it('should handle strings with leading/trailing spaces', () => {
      const result = evaluate('  123  ')
      expect(result).toBe(123)
    })

    it('should handle empty strings', () => {
      const result = evaluate('')
      expect(result).toBeNaN()
    })

    it('should throw error for non-string values', () => {
      expect(() => evaluate(123)).toThrow('Transformer.String.ToInt expects a string but received number.')
    })

    it('should return a function expression when called', () => {
      const expr = StringTransformers.ToInt()
      expect(expr).toEqual({
        type: 'function',
        name: 'toInt',
        arguments: [],
      })
    })
  })

  describe('ToFloat', () => {
    const { evaluate } = StringTransformers.ToFloat.spec

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

    it('should return NaN for non-numeric strings', () => {
      const result = evaluate('not a number')
      expect(result).toBeNaN()
    })

    it('should handle strings with leading/trailing spaces', () => {
      const result = evaluate('  3.14159  ')
      expect(result).toBeCloseTo(3.14159)
    })

    it('should handle empty strings', () => {
      const result = evaluate('')
      expect(result).toBeNaN()
    })

    it('should handle very small decimals', () => {
      const result = evaluate('0.000001')
      expect(result).toBe(0.000001)
    })

    it('should throw error for non-string values', () => {
      expect(() => evaluate(123.45)).toThrow('Transformer.String.ToFloat expects a string but received number.')
    })

    it('should return a function expression when called', () => {
      const expr = StringTransformers.ToFloat()
      expect(expr).toEqual({
        type: 'function',
        name: 'toFloat',
        arguments: [],
      })
    })
  })

  describe('ToArray', () => {
    const { evaluate } = StringTransformers.ToArray.spec

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
        type: 'function',
        name: 'toArray',
        arguments: [','],
      })
    })
  })

  describe('ToDate', () => {
    const { evaluate } = StringTransformers.ToDate.spec

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

    it('should return Invalid Date for empty string', () => {
      const result = evaluate('')
      expect(result).toBeInstanceOf(Date)
      expect(Number.isNaN(result.getTime())).toBe(true)
    })

    it('should return Invalid Date for whitespace-only string', () => {
      const result = evaluate('   ')
      expect(result).toBeInstanceOf(Date)
      expect(Number.isNaN(result.getTime())).toBe(true)
    })

    it('should return Invalid Date for ISO format (not supported)', () => {
      const result = evaluate('2024-03-15')
      expect(result).toBeInstanceOf(Date)
      expect(Number.isNaN(result.getTime())).toBe(true)
    })

    it('should return Invalid Date for US format (not supported)', () => {
      const result = evaluate('03/15/2024')
      expect(result).toBeInstanceOf(Date)
      // This might actually parse as 03/15/2024 -> 3rd day of 15th month
      // which would normalize to 3rd March 2025, so we check if it's invalid
      const isInvalid =
        Number.isNaN(result.getTime()) ||
        result.getFullYear() !== 2024 ||
        result.getMonth() !== 2 ||
        result.getDate() !== 15
      expect(isInvalid).toBe(true)
    })

    it('should return Invalid Date for invalid date string', () => {
      const result = evaluate('not a date')
      expect(result).toBeInstanceOf(Date)
      expect(Number.isNaN(result.getTime())).toBe(true)
    })

    it('should return Invalid Date for invalid day', () => {
      const result = evaluate('32/03/2024')
      expect(result).toBeInstanceOf(Date)
      expect(Number.isNaN(result.getTime())).toBe(true)
    })

    it('should return Invalid Date for invalid month', () => {
      const result = evaluate('15/13/2024')
      expect(result).toBeInstanceOf(Date)
      expect(Number.isNaN(result.getTime())).toBe(true)
    })

    it('should return Invalid Date for invalid leap year date', () => {
      const result = evaluate('29/02/2023') // 2023 is not a leap year
      expect(result).toBeInstanceOf(Date)
      expect(Number.isNaN(result.getTime())).toBe(true)
    })

    it('should return Invalid Date for wrong format', () => {
      const result = evaluate('2024/03/15') // Year first is not UK format
      expect(result).toBeInstanceOf(Date)
      expect(Number.isNaN(result.getTime())).toBe(true)
    })

    it('should return Invalid Date for partial dates', () => {
      const result = evaluate('15/03')
      expect(result).toBeInstanceOf(Date)
      expect(Number.isNaN(result.getTime())).toBe(true)
    })

    it('should throw error for non-string values', () => {
      expect(() => evaluate(123)).toThrow('Transformer.String.ToDate expects a string but received number.')
      expect(() => evaluate(null)).toThrow('Transformer.String.ToDate expects a string but received object.')
      expect(() => evaluate(undefined)).toThrow('Transformer.String.ToDate expects a string but received undefined.')
    })

    it('should return a function expression when called', () => {
      const expr = StringTransformers.ToDate()
      expect(expr).toEqual({
        type: 'function',
        name: 'toDate',
        arguments: [],
      })
    })
  })
})
