import { ObjectConditions, objectConditionsRegistry } from './objectConditions'
import { FunctionType } from '../../../authoring/types/enums'
import { FunctionRegistryTestHarness } from '../../../testing/functions/FunctionRegistryTestHarness'

describe('ObjectConditions', () => {
  const harness = new FunctionRegistryTestHarness(objectConditionsRegistry)

  describe('IsObject', () => {
    test('should return true for plain objects', () => {
      expect(harness.evaluate(ObjectConditions.IsObject()).withInput({})).toBe(true)
      expect(harness.evaluate(ObjectConditions.IsObject()).withInput({ a: 1 })).toBe(true)
      expect(harness.evaluate(ObjectConditions.IsObject()).withInput({ nested: { value: true } })).toBe(true)
      expect(harness.evaluate(ObjectConditions.IsObject()).withInput(Object.create(null))).toBe(true)
    })

    test('should return false for null', () => {
      expect(harness.evaluate(ObjectConditions.IsObject()).withInput(null)).toBe(false)
    })

    test('should return false for arrays', () => {
      expect(harness.evaluate(ObjectConditions.IsObject()).withInput([])).toBe(false)
      expect(harness.evaluate(ObjectConditions.IsObject()).withInput([1, 2, 3])).toBe(false)
      expect(harness.evaluate(ObjectConditions.IsObject()).withInput([{ a: 1 }])).toBe(false)
    })

    test('should return false for primitive values', () => {
      expect(harness.evaluate(ObjectConditions.IsObject()).withInput('string')).toBe(false)
      expect(harness.evaluate(ObjectConditions.IsObject()).withInput(123)).toBe(false)
      expect(harness.evaluate(ObjectConditions.IsObject()).withInput(true)).toBe(false)
      expect(harness.evaluate(ObjectConditions.IsObject()).withInput(false)).toBe(false)
      expect(harness.evaluate(ObjectConditions.IsObject()).withInput(undefined)).toBe(false)
    })

    test('should return false for other object types', () => {
      expect(harness.evaluate(ObjectConditions.IsObject()).withInput(new Date())).toBe(true)
      expect(harness.evaluate(ObjectConditions.IsObject()).withInput(new Map())).toBe(true)
      expect(harness.evaluate(ObjectConditions.IsObject()).withInput(new Set())).toBe(true)
      expect(harness.evaluate(ObjectConditions.IsObject()).withInput(/regex/)).toBe(true)
    })

    test('should return false for functions', () => {
      const arrowFn = () => 'test'
      const namedFn = function testFn() {
        return 'test'
      }
      expect(harness.evaluate(ObjectConditions.IsObject()).withInput(arrowFn)).toBe(false)
      expect(harness.evaluate(ObjectConditions.IsObject()).withInput(namedFn)).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = ObjectConditions.IsObject()
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Object.IsObject',
        arguments: [],
      })
    })
  })

  describe('HasProperty', () => {
    test('should return true when object has the property', () => {
      expect(harness.evaluate(ObjectConditions.HasProperty('name')).withInput({ name: 'John' })).toBe(true)
      expect(harness.evaluate(ObjectConditions.HasProperty('age')).withInput({ age: 0 })).toBe(true)
      expect(harness.evaluate(ObjectConditions.HasProperty('active')).withInput({ active: false })).toBe(true)
      expect(harness.evaluate(ObjectConditions.HasProperty('empty')).withInput({ empty: '' })).toBe(true)
      expect(harness.evaluate(ObjectConditions.HasProperty('nil')).withInput({ nil: null })).toBe(true)
    })

    test('should return false when object does not have the property', () => {
      expect(harness.evaluate(ObjectConditions.HasProperty('name')).withInput({})).toBe(false)
      expect(harness.evaluate(ObjectConditions.HasProperty('age')).withInput({ name: 'John' })).toBe(false)
    })

    test('should support dot notation for nested paths', () => {
      const obj = {
        user: {
          address: {
            city: 'London',
          },
        },
      }

      expect(harness.evaluate(ObjectConditions.HasProperty('user')).withInput(obj)).toBe(true)
      expect(harness.evaluate(ObjectConditions.HasProperty('user.address')).withInput(obj)).toBe(true)
      expect(harness.evaluate(ObjectConditions.HasProperty('user.address.city')).withInput(obj)).toBe(true)
      expect(harness.evaluate(ObjectConditions.HasProperty('user.address.postcode')).withInput(obj)).toBe(false)
      expect(harness.evaluate(ObjectConditions.HasProperty('user.name')).withInput(obj)).toBe(false)
    })

    test('should return false for undefined nested paths', () => {
      const obj: { user: null } = { user: null }
      expect(harness.evaluate(ObjectConditions.HasProperty('user.name')).withInput(obj)).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = ObjectConditions.HasProperty('user.address')
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Object.HasProperty',
        arguments: ['user.address'],
      })
    })
  })

  describe('PropertyIsEmpty', () => {
    test('should return true when property is null', () => {
      expect(harness.evaluate(ObjectConditions.PropertyIsEmpty('value')).withInput({ value: null })).toBe(true)
    })

    test('should return true when property is undefined', () => {
      expect(harness.evaluate(ObjectConditions.PropertyIsEmpty('value')).withInput({ value: undefined })).toBe(true)
      expect(harness.evaluate(ObjectConditions.PropertyIsEmpty('value')).withInput({})).toBe(true)
    })

    test('should return true when property is empty string', () => {
      expect(harness.evaluate(ObjectConditions.PropertyIsEmpty('value')).withInput({ value: '' })).toBe(true)
    })

    test('should return true when property is whitespace-only string', () => {
      expect(harness.evaluate(ObjectConditions.PropertyIsEmpty('value')).withInput({ value: '   ' })).toBe(true)
      expect(harness.evaluate(ObjectConditions.PropertyIsEmpty('value')).withInput({ value: '\t' })).toBe(true)
      expect(harness.evaluate(ObjectConditions.PropertyIsEmpty('value')).withInput({ value: '\n' })).toBe(true)
      expect(harness.evaluate(ObjectConditions.PropertyIsEmpty('value')).withInput({ value: '  \t\n  ' })).toBe(true)
    })

    test('should return false when property has a value', () => {
      expect(harness.evaluate(ObjectConditions.PropertyIsEmpty('value')).withInput({ value: 'text' })).toBe(false)
      expect(harness.evaluate(ObjectConditions.PropertyIsEmpty('value')).withInput({ value: 0 })).toBe(false)
      expect(harness.evaluate(ObjectConditions.PropertyIsEmpty('value')).withInput({ value: false })).toBe(false)
      expect(harness.evaluate(ObjectConditions.PropertyIsEmpty('value')).withInput({ value: [] })).toBe(false)
      expect(harness.evaluate(ObjectConditions.PropertyIsEmpty('value')).withInput({ value: {} })).toBe(false)
    })

    test('should support dot notation for nested paths', () => {
      const obj: { user: { name: string; email: string; address: null } } = {
        user: {
          name: 'John',
          email: '',
          address: null,
        },
      }

      expect(harness.evaluate(ObjectConditions.PropertyIsEmpty('user.name')).withInput(obj)).toBe(false)
      expect(harness.evaluate(ObjectConditions.PropertyIsEmpty('user.email')).withInput(obj)).toBe(true)
      expect(harness.evaluate(ObjectConditions.PropertyIsEmpty('user.address')).withInput(obj)).toBe(true)
      expect(harness.evaluate(ObjectConditions.PropertyIsEmpty('user.phone')).withInput(obj)).toBe(true)
    })

    test('should build correct expression object', () => {
      const expr = ObjectConditions.PropertyIsEmpty('user.email')
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Object.PropertyIsEmpty',
        arguments: ['user.email'],
      })
    })
  })

  describe('PropertyHasValue', () => {
    test('should return true when property has a non-empty value', () => {
      expect(harness.evaluate(ObjectConditions.PropertyHasValue('value')).withInput({ value: 'text' })).toBe(true)
      expect(harness.evaluate(ObjectConditions.PropertyHasValue('value')).withInput({ value: 0 })).toBe(true)
      expect(harness.evaluate(ObjectConditions.PropertyHasValue('value')).withInput({ value: false })).toBe(true)
      expect(harness.evaluate(ObjectConditions.PropertyHasValue('value')).withInput({ value: [] })).toBe(true)
      expect(harness.evaluate(ObjectConditions.PropertyHasValue('value')).withInput({ value: {} })).toBe(true)
    })

    test('should return false when property is null', () => {
      expect(harness.evaluate(ObjectConditions.PropertyHasValue('value')).withInput({ value: null })).toBe(false)
    })

    test('should return false when property is undefined', () => {
      expect(harness.evaluate(ObjectConditions.PropertyHasValue('value')).withInput({ value: undefined })).toBe(false)
      expect(harness.evaluate(ObjectConditions.PropertyHasValue('value')).withInput({})).toBe(false)
    })

    test('should return false when property is empty string', () => {
      expect(harness.evaluate(ObjectConditions.PropertyHasValue('value')).withInput({ value: '' })).toBe(false)
    })

    test('should return false when property is whitespace-only string', () => {
      expect(harness.evaluate(ObjectConditions.PropertyHasValue('value')).withInput({ value: '   ' })).toBe(false)
      expect(harness.evaluate(ObjectConditions.PropertyHasValue('value')).withInput({ value: '\t\n' })).toBe(false)
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

      expect(harness.evaluate(ObjectConditions.PropertyHasValue('user.name')).withInput(obj)).toBe(true)
      expect(harness.evaluate(ObjectConditions.PropertyHasValue('user.email')).withInput(obj)).toBe(false)
      expect(harness.evaluate(ObjectConditions.PropertyHasValue('user.address.city')).withInput(obj)).toBe(true)
      expect(harness.evaluate(ObjectConditions.PropertyHasValue('user.address.postcode')).withInput(obj)).toBe(false)
      expect(harness.evaluate(ObjectConditions.PropertyHasValue('user.phone')).withInput(obj)).toBe(false)
    })

    test('should build correct expression object', () => {
      const expr = ObjectConditions.PropertyHasValue('user.address.city')
      expect(expr).toEqual({
        type: FunctionType.CONDITION,
        name: 'Object.PropertyHasValue',
        arguments: ['user.address.city'],
      })
    })
  })
})
