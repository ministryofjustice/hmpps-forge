import { ObjectConditions, ObjectConditionsRegistry } from './objectConditions'
import { FunctionType } from '../../form/types/enums'

describe('ObjectConditions', () => {
  describe('IsObject', () => {
    const { evaluate } = ObjectConditionsRegistry.IsObject

    test('should return true for plain objects', () => {
      expect(evaluate({})).toBe(true)
      expect(evaluate({ a: 1 })).toBe(true)
      expect(evaluate({ nested: { value: true } })).toBe(true)
      expect(evaluate(Object.create(null))).toBe(true)
    })

    test('should return false for null', () => {
      expect(evaluate(null)).toBe(false)
    })

    test('should return false for arrays', () => {
      expect(evaluate([])).toBe(false)
      expect(evaluate([1, 2, 3])).toBe(false)
      expect(evaluate([{ a: 1 }])).toBe(false)
    })

    test('should return false for primitive values', () => {
      expect(evaluate('string')).toBe(false)
      expect(evaluate(123)).toBe(false)
      expect(evaluate(true)).toBe(false)
      expect(evaluate(false)).toBe(false)
      expect(evaluate(undefined)).toBe(false)
    })

    test('should return false for other object types', () => {
      expect(evaluate(new Date())).toBe(true)
      expect(evaluate(new Map())).toBe(true)
      expect(evaluate(new Set())).toBe(true)
      expect(evaluate(/regex/)).toBe(true)
    })

    test('should return false for functions', () => {
      const arrowFn = () => 'test'
      const namedFn = function testFn() {
        return 'test'
      }
      expect(evaluate(arrowFn)).toBe(false)
      expect(evaluate(namedFn)).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = ObjectConditions.IsObject()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'IsObject',
        arguments: [],
      })
    })
  })

  describe('HasProperty', () => {
    const { evaluate } = ObjectConditionsRegistry.HasProperty

    test('should return true when object has the property', () => {
      expect(evaluate({ name: 'John' }, 'name')).toBe(true)
      expect(evaluate({ age: 0 }, 'age')).toBe(true)
      expect(evaluate({ active: false }, 'active')).toBe(true)
      expect(evaluate({ empty: '' }, 'empty')).toBe(true)
      expect(evaluate({ nil: null }, 'nil')).toBe(true)
    })

    test('should return false when object does not have the property', () => {
      expect(evaluate({}, 'name')).toBe(false)
      expect(evaluate({ name: 'John' }, 'age')).toBe(false)
    })

    test('should support dot notation for nested paths', () => {
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

    test('should return false for undefined nested paths', () => {
      const obj: { user: null } = { user: null }
      expect(evaluate(obj, 'user.name')).toBe(false)
    })

    test('should throw error when value is not an object', () => {
      expect(() => evaluate('string', 'prop')).toThrow(
        'Condition.Object.HasProperty expects an object but received string',
      )
      expect(() => evaluate(123, 'prop')).toThrow('Condition.Object.HasProperty expects an object but received number')
      expect(() => evaluate(null, 'prop')).toThrow('Condition.Object.HasProperty expects an object but received null')
      expect(() => evaluate(undefined, 'prop')).toThrow(
        'Condition.Object.HasProperty expects an object but received undefined',
      )
      expect(() => evaluate([], 'prop')).toThrow('Condition.Object.HasProperty expects an object but received array')
    })

    test('should build correct expression object', () => {
      const expr = ObjectConditions.HasProperty('user.address')
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'HasProperty',
        arguments: ['user.address'],
      })
    })
  })

  describe('PropertyIsEmpty', () => {
    const { evaluate } = ObjectConditionsRegistry.PropertyIsEmpty

    test('should return true when property is null', () => {
      expect(evaluate({ value: null }, 'value')).toBe(true)
    })

    test('should return true when property is undefined', () => {
      expect(evaluate({ value: undefined }, 'value')).toBe(true)
      expect(evaluate({}, 'value')).toBe(true)
    })

    test('should return true when property is empty string', () => {
      expect(evaluate({ value: '' }, 'value')).toBe(true)
    })

    test('should return true when property is whitespace-only string', () => {
      expect(evaluate({ value: '   ' }, 'value')).toBe(true)
      expect(evaluate({ value: '\t' }, 'value')).toBe(true)
      expect(evaluate({ value: '\n' }, 'value')).toBe(true)
      expect(evaluate({ value: '  \t\n  ' }, 'value')).toBe(true)
    })

    test('should return false when property has a value', () => {
      expect(evaluate({ value: 'text' }, 'value')).toBe(false)
      expect(evaluate({ value: 0 }, 'value')).toBe(false)
      expect(evaluate({ value: false }, 'value')).toBe(false)
      expect(evaluate({ value: [] }, 'value')).toBe(false)
      expect(evaluate({ value: {} }, 'value')).toBe(false)
    })

    test('should support dot notation for nested paths', () => {
      const obj: { user: { name: string; email: string; address: null } } = {
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

    test('should throw error when value is not an object', () => {
      expect(() => evaluate('string', 'prop')).toThrow(
        'Condition.Object.PropertyIsEmpty expects an object but received string',
      )
      expect(() => evaluate(123, 'prop')).toThrow(
        'Condition.Object.PropertyIsEmpty expects an object but received number',
      )
      expect(() => evaluate([], 'prop')).toThrow(
        'Condition.Object.PropertyIsEmpty expects an object but received array',
      )
    })

    test('should build correct expression object', () => {
      const expr = ObjectConditions.PropertyIsEmpty('user.email')
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'PropertyIsEmpty',
        arguments: ['user.email'],
      })
    })
  })

  describe('PropertyHasValue', () => {
    const { evaluate } = ObjectConditionsRegistry.PropertyHasValue

    test('should return true when property has a non-empty value', () => {
      expect(evaluate({ value: 'text' }, 'value')).toBe(true)
      expect(evaluate({ value: 0 }, 'value')).toBe(true)
      expect(evaluate({ value: false }, 'value')).toBe(true)
      expect(evaluate({ value: [] }, 'value')).toBe(true)
      expect(evaluate({ value: {} }, 'value')).toBe(true)
    })

    test('should return false when property is null', () => {
      expect(evaluate({ value: null }, 'value')).toBe(false)
    })

    test('should return false when property is undefined', () => {
      expect(evaluate({ value: undefined }, 'value')).toBe(false)
      expect(evaluate({}, 'value')).toBe(false)
    })

    test('should return false when property is empty string', () => {
      expect(evaluate({ value: '' }, 'value')).toBe(false)
    })

    test('should return false when property is whitespace-only string', () => {
      expect(evaluate({ value: '   ' }, 'value')).toBe(false)
      expect(evaluate({ value: '\t\n' }, 'value')).toBe(false)
    })

    test('should support dot notation for nested paths', () => {
      const obj: { user: { name: string; email: string; address: { city: string; postcode: null } } } = {
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

    test('should throw error when value is not an object', () => {
      expect(() => evaluate('string', 'prop')).toThrow(
        'Condition.Object.PropertyHasValue expects an object but received string',
      )
      expect(() => evaluate(null, 'prop')).toThrow(
        'Condition.Object.PropertyHasValue expects an object but received null',
      )
      expect(() => evaluate(undefined, 'prop')).toThrow(
        'Condition.Object.PropertyHasValue expects an object but received undefined',
      )
    })

    test('should build correct expression object', () => {
      const expr = ObjectConditions.PropertyHasValue('user.address.city')
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'PropertyHasValue',
        arguments: ['user.address.city'],
      })
    })
  })
})
