import { safePropertyAccess } from '@form-engine/core/utils/propertyAccess'

describe('safePropertyAccess()', () => {
  it('should return property value for safe keys', () => {
    const obj = { email: 'user@example.com', age: 30 }

    expect(safePropertyAccess(obj, 'email')).toBe('user@example.com')
    expect(safePropertyAccess(obj, 'age')).toBe(30)
  })

  it('should handle array numeric indices', () => {
    const arr = ['first', 'second', 'third']

    expect(safePropertyAccess(arr, 0)).toBe('first')
    expect(safePropertyAccess(arr, 2)).toBe('third')
  })

  it('should return undefined for dangerous properties', () => {
    const obj = { email: 'user@example.com' }

    expect(safePropertyAccess(obj, '__proto__')).toBeUndefined()
    expect(safePropertyAccess(obj, 'constructor')).toBeUndefined()
    expect(safePropertyAccess(obj, 'prototype')).toBeUndefined()
  })

  it('should return undefined for null, undefined, or primitive inputs', () => {
    expect(safePropertyAccess(null, 'key')).toBeUndefined()
    expect(safePropertyAccess(undefined, 'key')).toBeUndefined()
    expect(safePropertyAccess('string', 'key')).toBeUndefined()
    expect(safePropertyAccess(123, 'key')).toBeUndefined()
    expect(safePropertyAccess(true, 'key')).toBeUndefined()
  })

  it('should return undefined for missing properties', () => {
    expect(safePropertyAccess({}, 'key')).toBeUndefined()
    expect(safePropertyAccess({ email: 'test' }, 'missing')).toBeUndefined()
  })

  it('should correctly return null and undefined property values', () => {
    const objWithNull: { value: null } = { value: null }
    const objWithUndefined: { value: undefined } = { value: undefined }

    expect(safePropertyAccess(objWithNull, 'value')).toBeNull()
    expect(safePropertyAccess(objWithUndefined, 'value')).toBeUndefined()
  })
})
