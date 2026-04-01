Object.defineProperty(exports, '__esModule', { value: true })
const objectConditions_1 = require('./objectConditions')
const defineFunction_1 = require('../utils/defineFunction')
const enums_1 = require('../types/enums')

describe('ObjectConditions', function () {
  const registry = (0, defineFunction_1.createFunctionsRegistry)(objectConditions_1.ObjectConditionsImplementations)
  describe('IsObject', function () {
    const evaluate = registry.IsObject.evaluate
    test('should return true for plain objects', function () {
      expect(evaluate({})).toBe(true)
      expect(evaluate({ a: 1 })).toBe(true)
      expect(evaluate({ nested: { value: true } })).toBe(true)
      expect(evaluate(Object.create(null))).toBe(true)
    })
    test('should return false for null', function () {
      expect(evaluate(null)).toBe(false)
    })
    test('should return false for arrays', function () {
      expect(evaluate([])).toBe(false)
      expect(evaluate([1, 2, 3])).toBe(false)
      expect(evaluate([{ a: 1 }])).toBe(false)
    })
    test('should return false for primitive values', function () {
      expect(evaluate('string')).toBe(false)
      expect(evaluate(123)).toBe(false)
      expect(evaluate(true)).toBe(false)
      expect(evaluate(false)).toBe(false)
      expect(evaluate(undefined)).toBe(false)
    })
    test('should return false for other object types', function () {
      expect(evaluate(new Date())).toBe(true)
      expect(evaluate(new Map())).toBe(true)
      expect(evaluate(new Set())).toBe(true)
      expect(evaluate(/regex/)).toBe(true)
    })
    test('should return false for functions', function () {
      const arrowFn = function () {
        return 'test'
      }
      const namedFn = function testFn() {
        return 'test'
      }
      expect(evaluate(arrowFn)).toBe(false)
      expect(evaluate(namedFn)).toBe(false)
    })
    test('should build correct expression object', function () {
      const expr = objectConditions_1.ObjectConditions.IsObject()
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'IsObject',
        arguments: [],
      })
    })
  })
  describe('HasProperty', function () {
    const evaluate = registry.HasProperty.evaluate
    test('should return true when object has the property', function () {
      expect(evaluate({ name: 'John' }, 'name')).toBe(true)
      expect(evaluate({ age: 0 }, 'age')).toBe(true)
      expect(evaluate({ active: false }, 'active')).toBe(true)
      expect(evaluate({ empty: '' }, 'empty')).toBe(true)
      expect(evaluate({ nil: null }, 'nil')).toBe(true)
    })
    test('should return false when object does not have the property', function () {
      expect(evaluate({}, 'name')).toBe(false)
      expect(evaluate({ name: 'John' }, 'age')).toBe(false)
    })
    test('should support dot notation for nested paths', function () {
      const obj = {
        user: {
          address: {
            city: 'London',
          },
        },
      }
      expect(evaluate(obj, 'user')).toBe(true)
      expect(evaluate(obj, 'user.address')).toBe(true)
      expect(evaluate(obj, 'user.address.city')).toBe(true)
      expect(evaluate(obj, 'user.address.postcode')).toBe(false)
      expect(evaluate(obj, 'user.name')).toBe(false)
    })
    test('should return false for undefined nested paths', function () {
      const obj = { user: null }
      expect(evaluate(obj, 'user.name')).toBe(false)
    })
    test('should throw error when value is not an object', function () {
      expect(function () {
        return evaluate('string', 'prop')
      }).toThrow('Condition.Object.HasProperty expects an object but received string')
      expect(function () {
        return evaluate(123, 'prop')
      }).toThrow('Condition.Object.HasProperty expects an object but received number')
      expect(function () {
        return evaluate(null, 'prop')
      }).toThrow('Condition.Object.HasProperty expects an object but received null')
      expect(function () {
        return evaluate(undefined, 'prop')
      }).toThrow('Condition.Object.HasProperty expects an object but received undefined')
      expect(function () {
        return evaluate([], 'prop')
      }).toThrow('Condition.Object.HasProperty expects an object but received array')
    })
    test('should build correct expression object', function () {
      const expr = objectConditions_1.ObjectConditions.HasProperty('user.address')
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'HasProperty',
        arguments: ['user.address'],
      })
    })
  })
  describe('PropertyIsEmpty', function () {
    const evaluate = registry.PropertyIsEmpty.evaluate
    test('should return true when property is null', function () {
      expect(evaluate({ value: null }, 'value')).toBe(true)
    })
    test('should return true when property is undefined', function () {
      expect(evaluate({ value: undefined }, 'value')).toBe(true)
      expect(evaluate({}, 'value')).toBe(true)
    })
    test('should return true when property is empty string', function () {
      expect(evaluate({ value: '' }, 'value')).toBe(true)
    })
    test('should return true when property is whitespace-only string', function () {
      expect(evaluate({ value: '   ' }, 'value')).toBe(true)
      expect(evaluate({ value: '\t' }, 'value')).toBe(true)
      expect(evaluate({ value: '\n' }, 'value')).toBe(true)
      expect(evaluate({ value: '  \t\n  ' }, 'value')).toBe(true)
    })
    test('should return false when property has a value', function () {
      expect(evaluate({ value: 'text' }, 'value')).toBe(false)
      expect(evaluate({ value: 0 }, 'value')).toBe(false)
      expect(evaluate({ value: false }, 'value')).toBe(false)
      expect(evaluate({ value: [] }, 'value')).toBe(false)
      expect(evaluate({ value: {} }, 'value')).toBe(false)
    })
    test('should support dot notation for nested paths', function () {
      const obj = {
        user: {
          name: 'John',
          email: '',
          address: null,
        },
      }
      expect(evaluate(obj, 'user.name')).toBe(false)
      expect(evaluate(obj, 'user.email')).toBe(true)
      expect(evaluate(obj, 'user.address')).toBe(true)
      expect(evaluate(obj, 'user.phone')).toBe(true)
    })
    test('should throw error when value is not an object', function () {
      expect(function () {
        return evaluate('string', 'prop')
      }).toThrow('Condition.Object.PropertyIsEmpty expects an object but received string')
      expect(function () {
        return evaluate(123, 'prop')
      }).toThrow('Condition.Object.PropertyIsEmpty expects an object but received number')
      expect(function () {
        return evaluate([], 'prop')
      }).toThrow('Condition.Object.PropertyIsEmpty expects an object but received array')
    })
    test('should build correct expression object', function () {
      const expr = objectConditions_1.ObjectConditions.PropertyIsEmpty('user.email')
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'PropertyIsEmpty',
        arguments: ['user.email'],
      })
    })
  })
  describe('PropertyHasValue', function () {
    const evaluate = registry.PropertyHasValue.evaluate
    test('should return true when property has a non-empty value', function () {
      expect(evaluate({ value: 'text' }, 'value')).toBe(true)
      expect(evaluate({ value: 0 }, 'value')).toBe(true)
      expect(evaluate({ value: false }, 'value')).toBe(true)
      expect(evaluate({ value: [] }, 'value')).toBe(true)
      expect(evaluate({ value: {} }, 'value')).toBe(true)
    })
    test('should return false when property is null', function () {
      expect(evaluate({ value: null }, 'value')).toBe(false)
    })
    test('should return false when property is undefined', function () {
      expect(evaluate({ value: undefined }, 'value')).toBe(false)
      expect(evaluate({}, 'value')).toBe(false)
    })
    test('should return false when property is empty string', function () {
      expect(evaluate({ value: '' }, 'value')).toBe(false)
    })
    test('should return false when property is whitespace-only string', function () {
      expect(evaluate({ value: '   ' }, 'value')).toBe(false)
      expect(evaluate({ value: '\t\n' }, 'value')).toBe(false)
    })
    test('should support dot notation for nested paths', function () {
      const obj = {
        user: {
          name: 'John',
          email: '',
          address: {
            city: 'London',
            postcode: null,
          },
        },
      }
      expect(evaluate(obj, 'user.name')).toBe(true)
      expect(evaluate(obj, 'user.email')).toBe(false)
      expect(evaluate(obj, 'user.address.city')).toBe(true)
      expect(evaluate(obj, 'user.address.postcode')).toBe(false)
      expect(evaluate(obj, 'user.phone')).toBe(false)
    })
    test('should throw error when value is not an object', function () {
      expect(function () {
        return evaluate('string', 'prop')
      }).toThrow('Condition.Object.PropertyHasValue expects an object but received string')
      expect(function () {
        return evaluate(null, 'prop')
      }).toThrow('Condition.Object.PropertyHasValue expects an object but received null')
      expect(function () {
        return evaluate(undefined, 'prop')
      }).toThrow('Condition.Object.PropertyHasValue expects an object but received undefined')
    })
    test('should build correct expression object', function () {
      const expr = objectConditions_1.ObjectConditions.PropertyHasValue('user.address.city')
      expect(expr).toEqual({
        type: enums_1.FunctionType.CONDITION,
        name: 'PropertyHasValue',
        arguments: ['user.address.city'],
      })
    })
  })
})
