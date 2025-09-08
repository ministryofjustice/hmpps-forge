import { buildComponent } from '@form-engine/registry/utils/buildComponent'
import RegistryDuplicateError from '@form-engine/errors/RegistryDuplicateError'
import RegistryValidationError from '@form-engine/errors/RegistryValidationError'
import { BlockDefinition, EvaluatedBlock } from '@form-engine/form/types/structures.type'
import ComponentRegistry from './ComponentRegistry'

describe('ComponentRegistry', () => {
  let registry: ComponentRegistry

  beforeEach(() => {
    registry = new ComponentRegistry()
  })

  describe('registerMany', () => {
    it('should register a single component successfully', () => {
      const mockComponent = buildComponent('text-input', async (_block: EvaluatedBlock<BlockDefinition>) => {
        return `<input type="text" />`
      })

      expect(() => registry.registerMany([mockComponent])).not.toThrow()
      expect(registry.has('text-input')).toBe(true)
    })

    it('should register multiple components successfully', () => {
      const comp1 = buildComponent('text', async () => '<input type="text" />')
      const comp2 = buildComponent('radio', async () => '<input type="radio" />')
      const comp3 = buildComponent('checkbox', async () => '<input type="checkbox" />')

      registry.registerMany([comp1, comp2, comp3])

      expect(registry.has('text')).toBe(true)
      expect(registry.has('radio')).toBe(true)
      expect(registry.has('checkbox')).toBe(true)
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
      it('should throw RegistryDuplicateError for duplicate component', () => {
        const comp1 = buildComponent('text', async () => '<input />')
        const comp2 = buildComponent('text', async () => '<textarea />')

        registry.registerMany([comp1])

        expect(() => registry.registerMany([comp2])).toThrow(AggregateError)

        try {
          registry.registerMany([comp2])
        } catch (error) {
          expect(error).toBeInstanceOf(AggregateError)
          if (error instanceof AggregateError) {
            expect(error.errors[0]).toBeInstanceOf(RegistryDuplicateError)
            const dupError = error.errors[0] as RegistryDuplicateError
            expect(dupError.registryType).toBe('component')
            expect(dupError.itemName).toBe('text')
          }
        }
      })

      it('should collect multiple duplicate errors', () => {
        const comp1 = buildComponent('text', async () => '<input />')
        const comp2 = buildComponent('radio', async () => '<radio />')

        registry.registerMany([comp1, comp2])

        const duplicates = [
          buildComponent('text', async () => '<different-input />'),
          buildComponent('radio', async () => '<different-radio />'),
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
        const invalidComponent = {} as any

        expect(() => registry.registerMany([invalidComponent])).toThrow(AggregateError)

        try {
          registry.registerMany([invalidComponent])
        } catch (error) {
          expect(error).toBeInstanceOf(AggregateError)
          if (error instanceof AggregateError) {
            expect(error.errors[0]).toBeInstanceOf(RegistryValidationError)
            const valError = error.errors[0] as RegistryValidationError
            expect(valError.registryType).toBe('component')
            expect(valError.expected).toContain('spec with variant')
          }
        }
      })

      it('should throw RegistryValidationError for missing variant', () => {
        const invalidComponent = {
          spec: {
            render: async () => '<div />',
          },
        } as any

        expect(() => registry.registerMany([invalidComponent])).toThrow(AggregateError)
      })

      it('should throw RegistryValidationError for missing render function', () => {
        const invalidComponent = {
          spec: {
            variant: 'test-component',
          },
        } as any

        try {
          registry.registerMany([invalidComponent])
        } catch (error) {
          expect(error).toBeInstanceOf(AggregateError)
          if (error instanceof AggregateError) {
            expect(error.errors[0]).toBeInstanceOf(RegistryValidationError)
            const valError = error.errors[0] as RegistryValidationError
            expect(valError.itemName).toBe('test-component')
            expect(valError.expected).toContain('render function')
          }
        }
      })

      it('should throw RegistryValidationError for non-function render', () => {
        const invalidComponent = {
          spec: {
            variant: 'test-component',
            render: 'not a function',
          },
        } as any

        expect(() => registry.registerMany([invalidComponent])).toThrow(AggregateError)
      })

      it('should collect multiple validation errors', () => {
        const invalidComponents = [
          {}, // missing spec
          { spec: {} }, // missing variant
          { spec: { variant: 'test', render: 'not a function' } }, // invalid render
        ] as any[]

        try {
          registry.registerMany(invalidComponents)
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
    it('should return component spec when it exists', () => {
      const mockComponent = buildComponent('text', async () => '<input />')
      registry.registerMany([mockComponent])

      const spec = registry.get('text')
      expect(spec).toBeDefined()
      expect(spec?.variant).toBe('text')
      expect(typeof spec?.render).toBe('function')
    })

    it('should return undefined for non-existent component', () => {
      const spec = registry.get('nonExistent')
      expect(spec).toBeUndefined()
    })
  })

  describe('has', () => {
    it('should return true for registered component', () => {
      const mockComponent = buildComponent('text', async () => '<input />')
      registry.registerMany([mockComponent])

      expect(registry.has('text')).toBe(true)
    })

    it('should return false for non-registered component', () => {
      expect(registry.has('nonExistent')).toBe(false)
    })
  })

  describe('getAll', () => {
    it('should return all registered components', () => {
      const comp1 = buildComponent('text', async () => '<input />')
      const comp2 = buildComponent('radio', async () => '<radio />')

      registry.registerMany([comp1, comp2])

      const all = registry.getAll()
      expect(all.size).toBe(2)
      expect(all.has('text')).toBe(true)
      expect(all.has('radio')).toBe(true)
    })

    it('should return empty map when no components registered', () => {
      const all = registry.getAll()
      expect(all.size).toBe(0)
    })

    it('should return a copy of the internal map', () => {
      const comp = buildComponent('text', async () => '<input />')
      registry.registerMany([comp])

      const all = registry.getAll()
      all.clear()

      expect(registry.size()).toBe(1) // Original should be unchanged
    })
  })

  describe('size', () => {
    it('should return correct count of registered components', () => {
      expect(registry.size()).toBe(0)

      const comp1 = buildComponent('text', async () => '<input />')
      registry.registerMany([comp1])
      expect(registry.size()).toBe(1)

      const comp2 = buildComponent('radio', async () => '<radio />')
      const comp3 = buildComponent('checkbox', async () => '<checkbox />')
      registry.registerMany([comp2, comp3])
      expect(registry.size()).toBe(3)
    })
  })
})
