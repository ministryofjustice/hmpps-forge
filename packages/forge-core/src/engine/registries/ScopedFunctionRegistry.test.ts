import FunctionRegistry from './FunctionRegistry'
import ScopedFunctionRegistry from './ScopedFunctionRegistry'

describe('ScopedFunctionRegistry', () => {
  function createEntry(name: string, returnValue: unknown = true) {
    return {
      name,
      evaluate: () => returnValue,
      isAsync: false,
    }
  }

  describe('get()', () => {
    it('should return local function when it exists', () => {
      // Arrange
      const parent = new FunctionRegistry()
      const scoped = new ScopedFunctionRegistry(parent)

      scoped.register({ LocalFn: createEntry('LocalFn', 'local') })

      // Act
      const result = scoped.get('LocalFn')

      // Assert
      expect(result?.evaluate()).toBe('local')
    })

    it('should fall back to parent when function is not in local scope', () => {
      // Arrange
      const parent = new FunctionRegistry()
      parent.register({ ParentFn: createEntry('ParentFn', 'parent') })

      const scoped = new ScopedFunctionRegistry(parent)

      // Act
      const result = scoped.get('ParentFn')

      // Assert
      expect(result?.evaluate()).toBe('parent')
    })

    it('should return undefined when function exists in neither scope', () => {
      // Arrange
      const parent = new FunctionRegistry()
      const scoped = new ScopedFunctionRegistry(parent)

      // Act & Assert
      expect(scoped.get('NonExistent')).toBeUndefined()
    })

    it('should shadow parent function with local function of same name', () => {
      // Arrange
      const parent = new FunctionRegistry()
      parent.register({ SharedName: createEntry('SharedName', 'parent') })

      const scoped = new ScopedFunctionRegistry(parent)
      scoped.register({ SharedName: createEntry('SharedName', 'local') })

      // Act & Assert
      expect(scoped.get('SharedName')?.evaluate()).toBe('local')
    })
  })

  describe('has()', () => {
    it('should return true for local function', () => {
      // Arrange
      const parent = new FunctionRegistry()
      const scoped = new ScopedFunctionRegistry(parent)

      scoped.register({ LocalFn: createEntry('LocalFn') })

      // Act & Assert
      expect(scoped.has('LocalFn')).toBe(true)
    })

    it('should return true for parent function', () => {
      // Arrange
      const parent = new FunctionRegistry()
      parent.register({ ParentFn: createEntry('ParentFn') })

      const scoped = new ScopedFunctionRegistry(parent)

      // Act & Assert
      expect(scoped.has('ParentFn')).toBe(true)
    })

    it('should return false when function exists in neither scope', () => {
      // Arrange
      const parent = new FunctionRegistry()
      const scoped = new ScopedFunctionRegistry(parent)

      // Act & Assert
      expect(scoped.has('NonExistent')).toBe(false)
    })
  })

  describe('getAll()', () => {
    it('should merge local and parent functions', () => {
      // Arrange
      const parent = new FunctionRegistry()
      parent.register({ ParentFn: createEntry('ParentFn') })

      const scoped = new ScopedFunctionRegistry(parent)
      scoped.register({ LocalFn: createEntry('LocalFn') })

      // Act
      const all = scoped.getAll()

      // Assert
      expect(all.size).toBe(2)
      expect(all.has('ParentFn')).toBe(true)
      expect(all.has('LocalFn')).toBe(true)
    })

    it('should prefer local over parent when names overlap', () => {
      // Arrange
      const parent = new FunctionRegistry()
      parent.register({ SharedName: createEntry('SharedName', 'parent') })

      const scoped = new ScopedFunctionRegistry(parent)
      scoped.register({ SharedName: createEntry('SharedName', 'local') })

      // Act
      const all = scoped.getAll()

      // Assert
      expect(all.size).toBe(1)
      expect(all.get('SharedName')?.evaluate()).toBe('local')
    })

    it('should return a copy that does not affect the registry', () => {
      // Arrange
      const parent = new FunctionRegistry()
      parent.register({ ParentFn: createEntry('ParentFn') })

      const scoped = new ScopedFunctionRegistry(parent)
      scoped.register({ LocalFn: createEntry('LocalFn') })

      // Act
      const all = scoped.getAll()
      all.clear()

      // Assert
      expect(scoped.size()).toBe(2)
    })
  })

  describe('size()', () => {
    it('should count both local and parent functions', () => {
      // Arrange
      const parent = new FunctionRegistry()
      parent.register({ ParentFn: createEntry('ParentFn') })

      const scoped = new ScopedFunctionRegistry(parent)
      scoped.register({ LocalFn: createEntry('LocalFn') })

      // Act & Assert
      expect(scoped.size()).toBe(2)
    })

    it('should not double-count shadowed functions', () => {
      // Arrange
      const parent = new FunctionRegistry()
      parent.register({ SharedName: createEntry('SharedName', 'parent') })

      const scoped = new ScopedFunctionRegistry(parent)
      scoped.register({ SharedName: createEntry('SharedName', 'local') })

      // Act & Assert
      expect(scoped.size()).toBe(1)
    })

    it('should return zero when both scopes are empty', () => {
      // Arrange
      const parent = new FunctionRegistry()
      const scoped = new ScopedFunctionRegistry(parent)

      // Act & Assert
      expect(scoped.size()).toBe(0)
    })
  })

  describe('isolation between scoped registries', () => {
    it('should allow two scoped registries to define same-named functions', () => {
      // Arrange
      const parent = new FunctionRegistry()

      const scopeA = new ScopedFunctionRegistry(parent)
      scopeA.register({ LoadAnswers: createEntry('LoadAnswers', 'scope-a') })

      const scopeB = new ScopedFunctionRegistry(parent)
      scopeB.register({ LoadAnswers: createEntry('LoadAnswers', 'scope-b') })

      // Act & Assert
      expect(scopeA.get('LoadAnswers')?.evaluate()).toBe('scope-a')
      expect(scopeB.get('LoadAnswers')?.evaluate()).toBe('scope-b')
    })

    it('should share parent functions across scoped registries', () => {
      // Arrange
      const parent = new FunctionRegistry()
      parent.register({ IsRequired: createEntry('IsRequired', 'built-in') })

      const scopeA = new ScopedFunctionRegistry(parent)
      const scopeB = new ScopedFunctionRegistry(parent)

      // Act & Assert
      expect(scopeA.get('IsRequired')?.evaluate()).toBe('built-in')
      expect(scopeB.get('IsRequired')?.evaluate()).toBe('built-in')
    })

    it('should not leak local functions between scoped registries', () => {
      // Arrange
      const parent = new FunctionRegistry()

      const scopeA = new ScopedFunctionRegistry(parent)
      scopeA.register({ OnlyInA: createEntry('OnlyInA') })

      const scopeB = new ScopedFunctionRegistry(parent)
      scopeB.register({ OnlyInB: createEntry('OnlyInB') })

      // Act & Assert
      expect(scopeA.has('OnlyInA')).toBe(true)
      expect(scopeA.has('OnlyInB')).toBe(false)
      expect(scopeB.has('OnlyInB')).toBe(true)
      expect(scopeB.has('OnlyInA')).toBe(false)
    })
  })
})
