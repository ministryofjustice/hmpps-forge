import { buildConditionFunction } from '@form-engine/registry/utils/buildCondition'
import { buildTransformerFunction } from '@form-engine/registry/utils/buildTransformer'
import RegistryDuplicateError from '@form-engine/errors/RegistryDuplicateError'
import RegistryValidationError from '@form-engine/errors/RegistryValidationError'
import FunctionRegistry from './FunctionRegistry'

describe('FunctionRegistry', () => {
  let registry: FunctionRegistry

  beforeEach(() => {
    registry = new FunctionRegistry()
  })

  describe('registerMany', () => {
    it('should register a single function successfully', () => {
      const mockFunction = buildConditionFunction('isTest', value => value === 'test')

      expect(() => registry.registerMany([mockFunction])).not.toThrow()
      expect(registry.has('isTest')).toBe(true)
    })

    it('should register multiple functions successfully', () => {
      const func1 = buildConditionFunction('isTest', value => value === 'test')
      const func2 = buildConditionFunction('isValid', value => value !== null)
      const func3 = buildTransformerFunction('toUpper', value => String(value).toUpperCase())

      registry.registerMany([func1, func2, func3])

      expect(registry.has('isTest')).toBe(true)
      expect(registry.has('isValid')).toBe(true)
      expect(registry.has('toUpper')).toBe(true)
      expect(registry.size()).toBe(3)
    })

    it('should handle empty array without throwing', () => {
      expect(() => registry.registerMany([])).not.toThrow()
      expect(registry.size()).toBe(0)
    })

    it('should handle null/undefined gracefully', () => {
      expect(() => registry.registerMany(null as any)).not.toThrow()
      expect(() => registry.registerMany(undefined as any)).not.toThrow()
      expect(registry.size()).toBe(0)
    })

    describe('duplicate registration', () => {
      it('should throw RegistryDuplicateError for duplicate function', () => {
        const func1 = buildConditionFunction('isTest', value => value === 'test')
        const func2 = buildConditionFunction('isTest', value => value !== 'test')

        registry.registerMany([func1])

        expect(() => registry.registerMany([func2])).toThrow(AggregateError)

        try {
          registry.registerMany([func2])
        } catch (error) {
          expect(error).toBeInstanceOf(AggregateError)
          if (error instanceof AggregateError) {
            expect(error.errors[0]).toBeInstanceOf(RegistryDuplicateError)
            const dupError = error.errors[0] as RegistryDuplicateError
            expect(dupError.registryType).toBe('function')
            expect(dupError.itemName).toBe('isTest')
          }
        }
      })

      it('should collect multiple duplicate errors', () => {
        const func1 = buildConditionFunction('test1', _value => true)
        const func2 = buildConditionFunction('test2', _value => true)

        registry.registerMany([func1, func2])

        const duplicates = [
          buildConditionFunction('test1', _value => false),
          buildConditionFunction('test2', _value => false),
        ]

        try {
          registry.registerMany(duplicates)
        } catch (error) {
          expect(error).toBeInstanceOf(AggregateError)
          if (error instanceof AggregateError) {
            expect(error.errors).toHaveLength(2)
            expect(error.errors.every(e => e instanceof RegistryDuplicateError)).toBe(true)
          }
        }
      })
    })

    describe('validation errors', () => {
      it('should throw RegistryValidationError for missing spec', () => {
        const invalidFunc = {} as any

        expect(() => registry.registerMany([invalidFunc])).toThrow(AggregateError)

        try {
          registry.registerMany([invalidFunc])
        } catch (error) {
          expect(error).toBeInstanceOf(AggregateError)
          if (error instanceof AggregateError) {
            expect(error.errors[0]).toBeInstanceOf(RegistryValidationError)
            const valError = error.errors[0] as RegistryValidationError
            expect(valError.registryType).toBe('function')
            expect(valError.expected).toContain('spec with name')
          }
        }
      })

      it('should throw RegistryValidationError for missing name', () => {
        const invalidFunc = {
          spec: {
            evaluate: () => true,
          },
        } as any

        expect(() => registry.registerMany([invalidFunc])).toThrow(AggregateError)
      })

      it('should throw RegistryValidationError for missing evaluate function', () => {
        const invalidFunc = {
          spec: {
            name: 'testFunc',
          },
        } as any

        try {
          registry.registerMany([invalidFunc])
        } catch (error) {
          expect(error).toBeInstanceOf(AggregateError)
          if (error instanceof AggregateError) {
            expect(error.errors[0]).toBeInstanceOf(RegistryValidationError)
            const valError = error.errors[0] as RegistryValidationError
            expect(valError.itemName).toBe('testFunc')
            expect(valError.expected).toContain('evaluate function')
          }
        }
      })

      it('should throw RegistryValidationError for non-function evaluate', () => {
        const invalidFunc = {
          spec: {
            name: 'testFunc',
            evaluate: 'not a function',
          },
        } as any

        expect(() => registry.registerMany([invalidFunc])).toThrow(AggregateError)
      })

      it('should collect multiple validation errors', () => {
        const invalidFuncs = [
          {}, // missing spec
          { spec: {} }, // missing name
          { spec: { name: 'test', evaluate: 'not a function' } }, // invalid evaluate
        ] as any[]

        try {
          registry.registerMany(invalidFuncs)
        } catch (error) {
          expect(error).toBeInstanceOf(AggregateError)
          if (error instanceof AggregateError) {
            expect(error.errors).toHaveLength(3)
            expect(error.errors.every(e => e instanceof RegistryValidationError)).toBe(true)
          }
        }
      })
    })
  })

  describe('get', () => {
    it('should return function spec when it exists', () => {
      const mockFunction = buildConditionFunction('isTest', value => value === 'test')
      registry.registerMany([mockFunction])

      const spec = registry.get('isTest')
      expect(spec).toBeDefined()
      expect(spec?.name).toBe('isTest')
      expect(typeof spec?.evaluate).toBe('function')
    })

    it('should return undefined for non-existent function', () => {
      const spec = registry.get('nonExistent')
      expect(spec).toBeUndefined()
    })
  })

  describe('has', () => {
    it('should return true for registered function', () => {
      const mockFunction = buildConditionFunction('isTest', value => value === 'test')
      registry.registerMany([mockFunction])

      expect(registry.has('isTest')).toBe(true)
    })

    it('should return false for non-registered function', () => {
      expect(registry.has('nonExistent')).toBe(false)
    })
  })

  describe('getAll', () => {
    it('should return all registered functions', () => {
      const func1 = buildConditionFunction('test1', _value => true)
      const func2 = buildConditionFunction('test2', _value => false)

      registry.registerMany([func1, func2])

      const all = registry.getAll()
      expect(all.size).toBe(2)
      expect(all.has('test1')).toBe(true)
      expect(all.has('test2')).toBe(true)
    })

    it('should return empty map when no functions registered', () => {
      const all = registry.getAll()
      expect(all.size).toBe(0)
    })

    it('should return a copy of the internal map', () => {
      const func = buildConditionFunction('test', _value => true)
      registry.registerMany([func])

      const all = registry.getAll()
      all.clear()

      expect(registry.size()).toBe(1) // Original should be unchanged
    })
  })

  describe('size', () => {
    it('should return correct count of registered functions', () => {
      expect(registry.size()).toBe(0)

      const func1 = buildConditionFunction('test1', _value => true)
      registry.registerMany([func1])
      expect(registry.size()).toBe(1)

      const func2 = buildConditionFunction('test2', _value => false)
      const func3 = buildConditionFunction('test3', _value => false)
      registry.registerMany([func2, func3])
      expect(registry.size()).toBe(3)
    })
  })
})
