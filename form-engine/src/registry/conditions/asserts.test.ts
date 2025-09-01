import { assertNumber, assertDate, assertString, assertArray, assertObject } from '@form-engine/registry/utils/asserts'

describe('asserts', () => {
  describe('assertNumber', () => {
    it('should pass for valid numbers', () => {
      expect(() => assertNumber(42, 'testFunction')).not.toThrow()
      expect(() => assertNumber(0, 'testFunction')).not.toThrow()
      expect(() => assertNumber(-10, 'testFunction')).not.toThrow()
      expect(() => assertNumber(3.14, 'testFunction')).not.toThrow()
      expect(() => assertNumber(Number.MAX_VALUE, 'testFunction')).not.toThrow()
      expect(() => assertNumber(Number.MIN_VALUE, 'testFunction')).not.toThrow()
    })

    it('should throw for NaN', () => {
      expect(() => assertNumber(NaN, 'testFunction')).toThrow('testFunction expects a number but received NaN')
    })

    it('should throw for non-number types', () => {
      expect(() => assertNumber('123', 'testFunction')).toThrow('testFunction expects a number but received string')
      expect(() => assertNumber(true, 'testFunction')).toThrow('testFunction expects a number but received boolean')
      expect(() => assertNumber(null, 'testFunction')).toThrow('testFunction expects a number but received object')
      expect(() => assertNumber(undefined, 'testFunction')).toThrow(
        'testFunction expects a number but received undefined',
      )
      expect(() => assertNumber([], 'testFunction')).toThrow('testFunction expects a number but received object')
      expect(() => assertNumber({}, 'testFunction')).toThrow('testFunction expects a number but received object')
    })

    it('should include transformer suggestion in error message', () => {
      expect(() => assertNumber('123', 'testFunction')).toThrow(
        'Add Transformer.String.ToInt() or Transformer.String.ToFloat() to the field configuration',
      )
    })
  })

  describe('assertDate', () => {
    it('should pass for valid Date objects', () => {
      expect(() => assertDate(new Date(), 'testFunction')).not.toThrow()
      expect(() => assertDate(new Date('2023-01-01'), 'testFunction')).not.toThrow()
      expect(() => assertDate(new Date(2023, 0, 1), 'testFunction')).not.toThrow()
    })

    it('should throw for non-Date objects', () => {
      expect(() => assertDate('2023-01-01', 'testFunction')).toThrow(
        'testFunction expects a Date object but received string',
      )
      expect(() => assertDate(1640995200000, 'testFunction')).toThrow(
        'testFunction expects a Date object but received number',
      )
      expect(() => assertDate(null, 'testFunction')).toThrow('testFunction expects a Date object but received object')
      expect(() => assertDate(undefined, 'testFunction')).toThrow(
        'testFunction expects a Date object but received undefined',
      )
    })

    it('should throw for invalid Date objects', () => {
      expect(() => assertDate(new Date('invalid'), 'testFunction')).toThrow(
        'testFunction received an invalid Date object',
      )
      expect(() => assertDate(new Date(NaN), 'testFunction')).toThrow('testFunction received an invalid Date object')
    })

    it('should include transformer suggestion in error messages', () => {
      expect(() => assertDate('2023-01-01', 'testFunction')).toThrow(
        'Add Transformer.String.ToDate() to the field configuration',
      )
      expect(() => assertDate(new Date('invalid'), 'testFunction')).toThrow(
        'Ensure the date is properly parsed in your transformer',
      )
    })
  })

  describe('assertString', () => {
    it('should pass for valid strings', () => {
      expect(() => assertString('hello', 'testFunction')).not.toThrow()
      expect(() => assertString('', 'testFunction')).not.toThrow()
      expect(() => assertString('123', 'testFunction')).not.toThrow()
      expect(() => assertString(' whitespace ', 'testFunction')).not.toThrow()
    })

    it('should throw for non-string types', () => {
      expect(() => assertString(123, 'testFunction')).toThrow('testFunction expects a string but received number')
      expect(() => assertString(true, 'testFunction')).toThrow('testFunction expects a string but received boolean')
      expect(() => assertString(null, 'testFunction')).toThrow('testFunction expects a string but received object')
      expect(() => assertString(undefined, 'testFunction')).toThrow(
        'testFunction expects a string but received undefined',
      )
      expect(() => assertString([], 'testFunction')).toThrow('testFunction expects a string but received object')
      expect(() => assertString({}, 'testFunction')).toThrow('testFunction expects a string but received object')
    })

    it('should include helpful message in error', () => {
      expect(() => assertString(123, 'testFunction')).toThrow('Ensure the field value is a string')
    })
  })

  describe('assertArray', () => {
    it('should pass for valid arrays', () => {
      expect(() => assertArray([], 'testFunction')).not.toThrow()
      expect(() => assertArray([1, 2, 3], 'testFunction')).not.toThrow()
      expect(() => assertArray(['a', 'b'], 'testFunction')).not.toThrow()
      expect(() => assertArray([null, undefined], 'testFunction')).not.toThrow()
      expect(() => assertArray([{}, []], 'testFunction')).not.toThrow()
    })

    it('should throw for non-array types', () => {
      expect(() => assertArray('hello', 'testFunction')).toThrow('testFunction expects an array but received string')
      expect(() => assertArray(123, 'testFunction')).toThrow('testFunction expects an array but received number')
      expect(() => assertArray(true, 'testFunction')).toThrow('testFunction expects an array but received boolean')
      expect(() => assertArray(null, 'testFunction')).toThrow('testFunction expects an array but received object')
      expect(() => assertArray(undefined, 'testFunction')).toThrow(
        'testFunction expects an array but received undefined',
      )
      expect(() => assertArray({}, 'testFunction')).toThrow('testFunction expects an array but received object')
    })

    it('should include helpful message in error', () => {
      expect(() => assertArray({}, 'testFunction')).toThrow('Ensure the field value is an array')
    })
  })

  describe('assertObject', () => {
    it('should pass for valid objects', () => {
      expect(() => assertObject({}, 'testFunction')).not.toThrow()
      expect(() => assertObject({ key: 'value' }, 'testFunction')).not.toThrow()
      expect(() => assertObject(new Date(), 'testFunction')).not.toThrow()
      expect(() => assertObject(/test/, 'testFunction')).not.toThrow()
    })

    it('should throw for null', () => {
      expect(() => assertObject(null, 'testFunction')).toThrow('testFunction expects an object but received null')
    })

    it('should throw for undefined', () => {
      expect(() => assertObject(undefined, 'testFunction')).toThrow(
        'testFunction expects an object but received undefined',
      )
    })

    it('should throw for primitive types', () => {
      expect(() => assertObject('string', 'testFunction')).toThrow('testFunction expects an object but received string')
      expect(() => assertObject(123, 'testFunction')).toThrow('testFunction expects an object but received number')
      expect(() => assertObject(true, 'testFunction')).toThrow('testFunction expects an object but received boolean')
    })

    it('should throw for arrays', () => {
      expect(() => assertObject([], 'testFunction')).toThrow('testFunction expects an object but received array')
      expect(() => assertObject([1, 2, 3], 'testFunction')).toThrow('testFunction expects an object but received array')
    })

    it('should include helpful message in error', () => {
      expect(() => assertObject('string', 'testFunction')).toThrow('Ensure the field value is an object')
    })
  })

  describe('function name parameter', () => {
    it('should include the function name in error messages', () => {
      expect(() => assertNumber('invalid', 'myCustomFunction')).toThrow('myCustomFunction expects a number')
      expect(() => assertString(123, 'anotherFunction')).toThrow('anotherFunction expects a string')
    })
  })
})
