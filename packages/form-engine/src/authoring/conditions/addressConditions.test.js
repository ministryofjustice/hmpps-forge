Object.defineProperty(exports, '__esModule', { value: true })
const addressConditions_1 = require('./addressConditions')
const defineFunction_1 = require('../utils/defineFunction')
const enums_1 = require('../types/enums')

describe('AddressConditions', function () {
  const registry = (0, defineFunction_1.createFunctionsRegistry)(addressConditions_1.AddressConditionsImplementations)
  describe('IsValidPostcode', function () {
    const evaluate = registry.IsValidPostcode.evaluate
    test('should return true for valid UK postcodes', function () {
      expect(evaluate('SW1A 1AA')).toBe(true)
      expect(evaluate('SW1A1AA')).toBe(true)
      expect(evaluate('EC1A 1BB')).toBe(true)
      expect(evaluate('EC1A1BB')).toBe(true)
      expect(evaluate('W1A 0AX')).toBe(true)
      expect(evaluate('W1A0AX')).toBe(true)
      expect(evaluate('M1 1AE')).toBe(true)
      expect(evaluate('M11AE')).toBe(true)
      expect(evaluate('B33 8TH')).toBe(true)
      expect(evaluate('B338TH')).toBe(true)
      expect(evaluate('CR2 6XH')).toBe(true)
      expect(evaluate('CR26XH')).toBe(true)
      expect(evaluate('DN55 1PT')).toBe(true)
      expect(evaluate('DN551PT')).toBe(true)
    })
    test('should be case insensitive', function () {
      expect(evaluate('sw1a 1aa')).toBe(true)
      expect(evaluate('Sw1A 1Aa')).toBe(true)
      expect(evaluate('SW1A 1AA')).toBe(true)
      expect(evaluate('sw1a1aa')).toBe(true)
    })
    test('should handle different valid formats', function () {
      expect(evaluate('N1 1AA')).toBe(true)
      expect(evaluate('N11 1AA')).toBe(true)
      expect(evaluate('NW1 1AA')).toBe(true)
      expect(evaluate('NW11 1AA')).toBe(true)
      expect(evaluate('N1W 1AA')).toBe(true)
      expect(evaluate('NW1W 1AA')).toBe(true)
    })
    test('should return false for invalid postcodes', function () {
      expect(evaluate('1234567')).toBe(false)
      expect(evaluate('')).toBe(false)
      expect(evaluate('ABC 123')).toBe(false)
      expect(evaluate('SW1A')).toBe(false)
      expect(evaluate('SW1A 1')).toBe(false)
      expect(evaluate('SW1A 1A')).toBe(false)
      expect(evaluate('SW1A 1AAA')).toBe(false)
      expect(evaluate('SW 1A 1AA')).toBe(false)
      expect(evaluate('SW1 A1AA')).toBe(false)
      expect(evaluate('notapostcode')).toBe(false)
      expect(evaluate('123 456')).toBe(false)
      expect(evaluate('SW1A 111')).toBe(false)
      expect(evaluate('SW1A AAA')).toBe(false)
    })
    test('should handle edge cases', function () {
      expect(evaluate('SW1A  1AA')).toBe(false)
      expect(evaluate(' SW1A 1AA')).toBe(false)
      expect(evaluate('SW1A 1AA ')).toBe(false)
      expect(evaluate('SW1A-1AA')).toBe(false)
      expect(evaluate('SW1A.1AA')).toBe(false)
    })
    test('should throw error when value is not a string', function () {
      expect(function () {
        return evaluate(123456)
      }).toThrow('Condition.Address.IsValidPostcode expects a string but received number')
      expect(function () {
        return evaluate(null)
      }).toThrow('Condition.Address.IsValidPostcode expects a string but received object')
      expect(function () {
        return evaluate(undefined)
      }).toThrow('Condition.Address.IsValidPostcode expects a string but received undefined')
      expect(function () {
        return evaluate([])
      }).toThrow('Condition.Address.IsValidPostcode expects a string but received object')
      expect(function () {
        return evaluate({})
      }).toThrow('Condition.Address.IsValidPostcode expects a string but received object')
      expect(function () {
        return evaluate(true)
      }).toThrow('Condition.Address.IsValidPostcode expects a string but received boolean')
    })
    test('should build correct expression object', function () {
      const expr = addressConditions_1.AddressConditions.IsValidPostcode()
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'IsValidPostcode',
        arguments: [],
      })
    })
  })
})
