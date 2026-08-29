import { z } from 'zod'
import type { ComponentRegistryEntry } from '../../../components/types/components.type'
import ForgeRegistryDuplicateError from '../../errors/ForgeRegistryDuplicateError'
import ForgeRegistryValidationError from '../../errors/ForgeRegistryValidationError'
import ComponentRegistry from './ComponentRegistry'

function createTestComponent(
  variant: string,
  render: ComponentRegistryEntry<object, string>['render'] = () => '',
): ComponentRegistryEntry<object, string> {
  return { variant, render }
}

describe('ComponentRegistry', () => {
  let registry: ComponentRegistry

  beforeEach(() => {
    registry = new ComponentRegistry()
  })

  describe('registerMany', () => {
    it('should register a single component successfully', () => {
      const mockComponent = createTestComponent('text-input', (_block: object) => {
        return `<input type="text" />`
      })

      expect(() => registry.registerMany([mockComponent])).not.toThrow()
      expect(registry.has('text-input')).toBe(true)
    })

    it('should register multiple components successfully', () => {
      const comp1 = createTestComponent('text', () => '<input type="text" />')
      const comp2 = createTestComponent('radio', () => '<input type="radio" />')
      const comp3 = createTestComponent('checkbox', () => '<input type="checkbox" />')

      registry.registerMany([comp1, comp2, comp3])

      expect(registry.has('text')).toBe(true)
      expect(registry.has('radio')).toBe(true)
      expect(registry.has('checkbox')).toBe(true)
      expect(registry.size()).toBe(3)
    })

    it('should compile a component input schema when registering it', () => {
      // Arrange
      const inputSchema = z.object({ value: z.string() })
      const component = { ...createTestComponent('text'), inputSchema }

      // Act
      registry.registerMany([component])

      // Assert
      expect(registry.get('text')?.inputSchema).not.toBe(inputSchema)
      expect(registry.get('text')?.inputSchema?.safeParse({ value: 'Ada' }).success).toBe(true)
    })

    it('should retain only the input side of a transforming component schema', () => {
      // Arrange
      const inputSchema = z.object({ value: z.string().transform(value => value.length) })
      const component = { ...createTestComponent('text'), inputSchema }

      // Act
      registry.registerMany([component])
      const parsed = registry.get('text')?.inputSchema?.safeParse({ value: 'Ada' })

      // Assert
      expect(parsed).toEqual({ success: true, data: { value: 'Ada' } })
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
      it('should throw ForgeRegistryDuplicateError for duplicate component', () => {
        const comp1 = createTestComponent('text', () => '<input />')
        const comp2 = createTestComponent('text', () => '<textarea />')

        registry.registerMany([comp1])

        expect(() => registry.registerMany([comp2])).toThrow(AggregateError)

        try {
          registry.registerMany([comp2])
        } catch (error) {
          expect(error).toBeInstanceOf(AggregateError)
          if (error instanceof AggregateError) {
            expect(error.errors[0]).toBeInstanceOf(ForgeRegistryDuplicateError)
            const dupError = error.errors[0] as ForgeRegistryDuplicateError
            expect(dupError.registryType).toBe('component')
            expect(dupError.itemName).toBe('text')
          }
        }
      })

      it('should collect multiple duplicate errors', () => {
        const comp1 = createTestComponent('text', () => '<input />')
        const comp2 = createTestComponent('radio', () => '<radio />')

        registry.registerMany([comp1, comp2])

        const duplicates = [
          createTestComponent('text', () => '<different-input />'),
          createTestComponent('radio', () => '<different-radio />'),
        ]

        try {
          registry.registerMany(duplicates)
        } catch (error) {
          expect(error).toBeInstanceOf(AggregateError)
          if (error instanceof AggregateError) {
            expect(error.errors).toHaveLength(2)
            expect(error.errors.every(e => e instanceof ForgeRegistryDuplicateError)).toBe(true)
          }
        }
      })
    })

    describe('validation errors', () => {
      it('should throw ForgeRegistryValidationError for missing variant', () => {
        const invalidComponent = {} as any

        expect(() => registry.registerMany([invalidComponent])).toThrow(AggregateError)

        try {
          registry.registerMany([invalidComponent])
        } catch (error) {
          expect(error).toBeInstanceOf(AggregateError)
          if (error instanceof AggregateError) {
            expect(error.errors[0]).toBeInstanceOf(ForgeRegistryValidationError)
            const valError = error.errors[0] as ForgeRegistryValidationError
            expect(valError.registryType).toBe('component')
            expect(valError.expected).toContain('variant')
          }
        }
      })

      it('should throw ForgeRegistryValidationError for component with render but no variant', () => {
        const invalidComponent = {
          render: () => '<div />',
        } as any

        expect(() => registry.registerMany([invalidComponent])).toThrow(AggregateError)
      })

      it('should throw ForgeRegistryValidationError for missing render function', () => {
        const invalidComponent = {
          variant: 'test-component',
        } as any

        try {
          registry.registerMany([invalidComponent])
        } catch (error) {
          expect(error).toBeInstanceOf(AggregateError)
          if (error instanceof AggregateError) {
            expect(error.errors[0]).toBeInstanceOf(ForgeRegistryValidationError)
            const valError = error.errors[0] as ForgeRegistryValidationError
            expect(valError.itemName).toBe('test-component')
            expect(valError.expected).toContain('render function')
          }
        }
      })

      it('should throw ForgeRegistryValidationError for non-function render', () => {
        const invalidComponent = {
          variant: 'test-component',
          render: 'not a function',
        } as any

        expect(() => registry.registerMany([invalidComponent])).toThrow(AggregateError)
      })

      it('should collect multiple validation errors', () => {
        const invalidComponents = [
          {}, // missing variant
          { render: () => '<div />' }, // missing variant
          { variant: 'test', render: 'not a function' }, // invalid render
        ] as any[]

        try {
          registry.registerMany(invalidComponents)
        } catch (error) {
          expect(error).toBeInstanceOf(AggregateError)
          if (error instanceof AggregateError) {
            expect(error.errors).toHaveLength(3)
            expect(error.errors.every(e => e instanceof ForgeRegistryValidationError)).toBe(true)
          }
        }
      })
    })
  })

  describe('get', () => {
    it('should return component spec when it exists', () => {
      const mockComponent = createTestComponent('text', () => '<input />')
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
      const mockComponent = createTestComponent('text', () => '<input />')
      registry.registerMany([mockComponent])

      expect(registry.has('text')).toBe(true)
    })

    it('should return false for non-registered component', () => {
      expect(registry.has('nonExistent')).toBe(false)
    })
  })

  describe('getAll', () => {
    it('should return all registered components', () => {
      const comp1 = createTestComponent('text', () => '<input />')
      const comp2 = createTestComponent('radio', () => '<radio />')

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
      const comp = createTestComponent('text', () => '<input />')
      registry.registerMany([comp])

      const all = registry.getAll()
      all.clear()

      expect(registry.size()).toBe(1) // Original should be unchanged
    })
  })

  describe('size', () => {
    it('should return correct count of registered components', () => {
      expect(registry.size()).toBe(0)

      const comp1 = createTestComponent('text', () => '<input />')
      registry.registerMany([comp1])
      expect(registry.size()).toBe(1)

      const comp2 = createTestComponent('radio', () => '<radio />')
      const comp3 = createTestComponent('checkbox', () => '<checkbox />')
      registry.registerMany([comp2, comp3])
      expect(registry.size()).toBe(3)
    })
  })
})
