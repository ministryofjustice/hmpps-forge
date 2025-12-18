import RegistryValidationError from '@form-engine/errors/RegistryValidationError'
import FunctionRegistry from './FunctionRegistry'

describe('FunctionRegistry', () => {
  let registry: FunctionRegistry

  beforeEach(() => {
    registry = new FunctionRegistry()
  })

  describe('register', () => {
    it('should register a single function successfully', () => {
      const mockRegistry = {
        IsTest: {
          name: 'IsTest',
          evaluate: (value: any) => value === 'test',
          isAsync: false,
        },
      }

      expect(() => registry.register(mockRegistry)).not.toThrow()
      expect(registry.has('IsTest')).toBe(true)
    })

    it('should register multiple functions successfully', () => {
      const mockRegistry = {
        IsTest: { name: 'IsTest', evaluate: (value: any) => value === 'test', isAsync: false },
        IsValid: { name: 'IsValid', evaluate: (value: any) => value !== null, isAsync: false },
        ToUpper: { name: 'ToUpper', evaluate: (value: any) => String(value).toUpperCase(), isAsync: false },
      }

      registry.register(mockRegistry)

      expect(registry.has('IsTest')).toBe(true)
      expect(registry.has('IsValid')).toBe(true)
      expect(registry.has('ToUpper')).toBe(true)
      expect(registry.size()).toBe(3)
    })

    it('should handle empty object without throwing', () => {
      expect(() => registry.register({})).not.toThrow()
      expect(registry.size()).toBe(0)
    })

    it('should handle null/undefined gracefully', () => {
      expect(() => registry.register(null as any)).not.toThrow()
      expect(() => registry.register(undefined as any)).not.toThrow()
      expect(registry.size()).toBe(0)
    })

    it('should throw RegistryValidationError for missing name', () => {
      const invalidRegistry = {
        InvalidFunc: { evaluate: () => true } as any,
      }

      expect(() => registry.register(invalidRegistry)).toThrow(AggregateError)

      try {
        registry.register(invalidRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors[0]).toBeInstanceOf(RegistryValidationError)
          const valError = error.errors[0] as RegistryValidationError
          expect(valError.registryType).toBe('function')
          expect(valError.expected).toContain('name')
        }
      }
    })

    it('should throw RegistryValidationError for entry without name', () => {
      const invalidRegistry = {
        InvalidEntry: {} as any,
      }

      expect(() => registry.register(invalidRegistry)).toThrow(AggregateError)
    })

    it('should throw RegistryValidationError for missing evaluate function', () => {
      const invalidRegistry = {
        TestFunc: {
          name: 'TestFunc',
        } as any,
      }

      try {
        registry.register(invalidRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors[0]).toBeInstanceOf(RegistryValidationError)
          const valError = error.errors[0] as RegistryValidationError
          expect(valError.itemName).toBe('TestFunc')
          expect(valError.expected).toContain('evaluate function')
        }
      }
    })

    it('should throw RegistryValidationError for non-function evaluate', () => {
      const invalidRegistry = {
        TestFunc: {
          name: 'TestFunc',
          evaluate: 'not a function',
        } as any,
      }

      expect(() => registry.register(invalidRegistry)).toThrow(AggregateError)
    })

    it('should collect multiple validation errors', () => {
      const invalidRegistry = {
        Empty: {}, // missing both name and evaluate
        MissingEval: { name: 'Test' }, // missing evaluate
        InvalidEval: { name: 'Test2', evaluate: 'not a function' }, // invalid evaluate
      } as any

      try {
        registry.register(invalidRegistry)
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError)
        if (error instanceof AggregateError) {
          expect(error.errors).toHaveLength(3)
          expect(error.errors.every(e => e instanceof RegistryValidationError)).toBe(true)
        }
      }
    })
  })

  describe('get', () => {
    it('should return function when it exists', () => {
      const mockRegistry = {
        IsTest: { name: 'IsTest', evaluate: (value: any) => value === 'test', isAsync: false },
      }
      registry.register(mockRegistry)

      const spec = registry.get('IsTest')
      expect(spec).toBeDefined()
      expect(spec?.name).toBe('IsTest')
      expect(typeof spec?.evaluate).toBe('function')
    })

    it('should return undefined for non-existent function', () => {
      const spec = registry.get('nonExistent')
      expect(spec).toBeUndefined()
    })
  })

  describe('has', () => {
    it('should return true for registered function', () => {
      const mockRegistry = {
        IsTest: { name: 'IsTest', evaluate: (value: any) => value === 'test', isAsync: false },
      }
      registry.register(mockRegistry)

      expect(registry.has('IsTest')).toBe(true)
    })

    it('should return false for non-registered function', () => {
      expect(registry.has('nonExistent')).toBe(false)
    })
  })

  describe('getAll', () => {
    it('should return all registered functions', () => {
      const mockRegistry = {
        Test1: { name: 'Test1', evaluate: (_value: any) => true, isAsync: false },
        Test2: { name: 'Test2', evaluate: (_value: any) => false, isAsync: false },
      }

      registry.register(mockRegistry)

      const all = registry.getAll()
      expect(all.size).toBe(2)
      expect(all.has('Test1')).toBe(true)
      expect(all.has('Test2')).toBe(true)
    })

    it('should return empty map when no functions registered', () => {
      const all = registry.getAll()
      expect(all.size).toBe(0)
    })

    it('should return a copy of the internal map', () => {
      const mockRegistry = {
        Test: { name: 'Test', evaluate: (_value: any) => true, isAsync: false },
      }
      registry.register(mockRegistry)

      const all = registry.getAll()
      all.clear()

      expect(registry.size()).toBe(1) // Original should be unchanged
    })
  })

  describe('size', () => {
    it('should return correct count of registered functions', () => {
      expect(registry.size()).toBe(0)

      const registry1 = {
        Test1: { name: 'Test1', evaluate: (_value: any) => true, isAsync: false },
      }
      registry.register(registry1)
      expect(registry.size()).toBe(1)

      const registry2 = {
        Test2: { name: 'Test2', evaluate: (_value: any) => false, isAsync: false },
        Test3: { name: 'Test3', evaluate: (_value: any) => false, isAsync: false },
      }
      registry.register(registry2)
      expect(registry.size()).toBe(3)
    })
  })
})
