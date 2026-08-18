import { buildComponent } from '../../../components/utils/buildComponent'
import ComponentRegistry from './ComponentRegistry'
import ScopedComponentRegistry from './ScopedComponentRegistry'

describe('ScopedComponentRegistry', () => {
  function comp(variant: string, html = `<${variant} />`) {
    return buildComponent(variant, () => html)
  }

  describe('get()', () => {
    it('should return local component when it exists', () => {
      // Arrange
      const parent = new ComponentRegistry()
      const scoped = new ScopedComponentRegistry(parent)

      scoped.registerMany([comp('local-input', '<local />')])

      // Act & Assert
      expect(scoped.get('local-input')?.variant).toBe('local-input')
    })

    it('should fall back to parent when component is not in local scope', () => {
      // Arrange
      const parent = new ComponentRegistry()
      parent.registerMany([comp('parent-input')])

      const scoped = new ScopedComponentRegistry(parent)

      // Act & Assert
      expect(scoped.get('parent-input')?.variant).toBe('parent-input')
    })

    it('should return undefined when component exists in neither scope', () => {
      // Arrange
      const parent = new ComponentRegistry()
      const scoped = new ScopedComponentRegistry(parent)

      // Act & Assert
      expect(scoped.get('nonexistent')).toBeUndefined()
    })

    it('should shadow parent component with local component of same variant', () => {
      // Arrange
      const parent = new ComponentRegistry()
      parent.registerMany([comp('text-input', '<parent />')])

      const scoped = new ScopedComponentRegistry(parent)
      scoped.registerMany([comp('text-input', '<local />')])

      // Act
      const result = scoped.get('text-input')

      // Assert
      expect(result?.render({} as any)).toBe('<local />')
    })
  })

  describe('has()', () => {
    it('should return true for local component', () => {
      // Arrange
      const parent = new ComponentRegistry()
      const scoped = new ScopedComponentRegistry(parent)

      scoped.registerMany([comp('local-comp')])

      // Act & Assert
      expect(scoped.has('local-comp')).toBe(true)
    })

    it('should return true for parent component', () => {
      // Arrange
      const parent = new ComponentRegistry()
      parent.registerMany([comp('parent-comp')])

      const scoped = new ScopedComponentRegistry(parent)

      // Act & Assert
      expect(scoped.has('parent-comp')).toBe(true)
    })

    it('should return false when component exists in neither scope', () => {
      // Arrange
      const parent = new ComponentRegistry()
      const scoped = new ScopedComponentRegistry(parent)

      // Act & Assert
      expect(scoped.has('nonexistent')).toBe(false)
    })
  })

  describe('getAll()', () => {
    it('should merge local and parent components', () => {
      // Arrange
      const parent = new ComponentRegistry()
      parent.registerMany([comp('parent-comp')])

      const scoped = new ScopedComponentRegistry(parent)
      scoped.registerMany([comp('local-comp')])

      // Act
      const all = scoped.getAll()

      // Assert
      expect(all.size).toBe(2)
      expect(all.has('parent-comp')).toBe(true)
      expect(all.has('local-comp')).toBe(true)
    })

    it('should prefer local over parent when variants overlap', () => {
      // Arrange
      const parent = new ComponentRegistry()
      parent.registerMany([comp('text-input', '<parent />')])

      const scoped = new ScopedComponentRegistry(parent)
      scoped.registerMany([comp('text-input', '<local />')])

      // Act
      const all = scoped.getAll()

      // Assert
      expect(all.size).toBe(1)
      expect(all.get('text-input')?.render({} as any)).toBe('<local />')
    })

    it('should return a copy that does not affect the registry', () => {
      // Arrange
      const parent = new ComponentRegistry()
      parent.registerMany([comp('parent-comp')])

      const scoped = new ScopedComponentRegistry(parent)
      scoped.registerMany([comp('local-comp')])

      // Act
      const all = scoped.getAll()
      all.clear()

      // Assert
      expect(scoped.size()).toBe(2)
    })
  })

  describe('size()', () => {
    it('should count both local and parent components', () => {
      // Arrange
      const parent = new ComponentRegistry()
      parent.registerMany([comp('parent-comp')])

      const scoped = new ScopedComponentRegistry(parent)
      scoped.registerMany([comp('local-comp')])

      // Act & Assert
      expect(scoped.size()).toBe(2)
    })

    it('should not double-count shadowed components', () => {
      // Arrange
      const parent = new ComponentRegistry()
      parent.registerMany([comp('text-input', '<parent />')])

      const scoped = new ScopedComponentRegistry(parent)
      scoped.registerMany([comp('text-input', '<local />')])

      // Act & Assert
      expect(scoped.size()).toBe(1)
    })
  })

  describe('isolation between scoped registries', () => {
    it('should allow two scoped registries to define same-variant components', () => {
      // Arrange
      const parent = new ComponentRegistry()

      const scopeA = new ScopedComponentRegistry(parent)
      scopeA.registerMany([comp('custom-input', '<scope-a />')])

      const scopeB = new ScopedComponentRegistry(parent)
      scopeB.registerMany([comp('custom-input', '<scope-b />')])

      // Act & Assert
      expect(scopeA.get('custom-input')?.render({} as any)).toBe('<scope-a />')
      expect(scopeB.get('custom-input')?.render({} as any)).toBe('<scope-b />')
    })

    it('should share parent components across scoped registries', () => {
      // Arrange
      const parent = new ComponentRegistry()
      parent.registerMany([comp('shared-comp')])

      const scopeA = new ScopedComponentRegistry(parent)
      const scopeB = new ScopedComponentRegistry(parent)

      // Act & Assert
      expect(scopeA.has('shared-comp')).toBe(true)
      expect(scopeB.has('shared-comp')).toBe(true)
    })

    it('should not leak local components between scoped registries', () => {
      // Arrange
      const parent = new ComponentRegistry()

      const scopeA = new ScopedComponentRegistry(parent)
      scopeA.registerMany([comp('only-in-a')])

      const scopeB = new ScopedComponentRegistry(parent)
      scopeB.registerMany([comp('only-in-b')])

      // Act & Assert
      expect(scopeA.has('only-in-a')).toBe(true)
      expect(scopeA.has('only-in-b')).toBe(false)
      expect(scopeB.has('only-in-b')).toBe(true)
      expect(scopeB.has('only-in-a')).toBe(false)
    })
  })
})
