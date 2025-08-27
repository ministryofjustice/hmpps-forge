import { getByPath } from './utils'

describe('utils', () => {
  describe('getByPath', () => {
    it('should extract properties using dot notation paths', () => {
      const obj = {
        name: 'John',
        user: {
          profile: {
            age: 25,
            active: true,
          },
        },
      }

      expect(getByPath(obj, 'name')).toBe('John')
      expect(getByPath(obj, 'user.profile.age')).toBe(25)
      expect(getByPath(obj, 'user.profile.active')).toBe(true)
    })

    it('should return undefined for missing properties', () => {
      const obj = { user: { name: 'John' } }

      expect(getByPath(obj, 'nonexistent')).toBeUndefined()
      expect(getByPath(obj, 'user.missing')).toBeUndefined()
      expect(getByPath(obj, 'missing.nested.path')).toBeUndefined()
    })

    it('should handle invalid inputs gracefully', () => {
      expect(getByPath(null, 'path')).toBeUndefined()
      expect(getByPath({ name: 'John' }, null as any)).toBeUndefined()
    })
  })
})
