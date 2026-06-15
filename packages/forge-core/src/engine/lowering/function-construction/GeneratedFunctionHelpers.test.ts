import { generatedFunctionHelpers, type ScopeFrame } from './GeneratedFunctionHelpers'

const { resolveScopeReferences } = generatedFunctionHelpers

function createFrame(overrides: Partial<ScopeFrame> = {}): ScopeFrame {
  return {
    item: { name: 'Alice', '@key': 'person-0', '@value': 42 },
    index: 0,
    rawItem: { name: 'Alice' },
    inputLength: 3,
    ...overrides,
  }
}

function scopeRef(level: number | string, ...rest: string[]): Record<string, unknown> {
  return {
    type: 'AstNode.Template',
    originalType: 'AstNode.Expression',
    expressionType: 'ExpressionType.Reference',
    id: 'template:1',
    properties: { path: ['@scope', level, ...rest] },
  }
}

function loopRef(level: number | string, property: string): Record<string, unknown> {
  return {
    type: 'AstNode.Template',
    originalType: 'AstNode.Expression',
    expressionType: 'ExpressionType.Reference',
    id: 'template:2',
    properties: { path: ['@loop', level, property] },
  }
}

function functionNode(name: string, args: unknown[]): Record<string, unknown> {
  return {
    type: 'AstNode.Template',
    originalType: 'AstNode.Expression',
    expressionType: 'ExpressionType.Function',
    id: 'template:3',
    properties: { name, arguments: args },
  }
}

describe('resolveScopeReferences()', () => {
  describe('primitives', () => {
    it('should pass through strings unchanged', () => {
      expect(resolveScopeReferences('hello', [createFrame()])).toBe('hello')
    })

    it('should pass through numbers unchanged', () => {
      expect(resolveScopeReferences(42, [createFrame()])).toBe(42)
    })

    it('should pass through booleans unchanged', () => {
      expect(resolveScopeReferences(true, [createFrame()])).toBe(true)
    })

    it('should pass through null unchanged', () => {
      expect(resolveScopeReferences(null, [createFrame()])).toBeNull()
    })

    it('should pass through undefined unchanged', () => {
      expect(resolveScopeReferences(undefined, [createFrame()])).toBeUndefined()
    })
  })

  describe('@scope references', () => {
    it('should resolve item property', () => {
      // Arrange
      const frame = createFrame({ item: { name: 'Alice' } })

      // Act
      const result = resolveScopeReferences(scopeRef(0, 'name'), [frame])

      // Assert
      expect(result).toBe('Alice')
    })

    it('should resolve bare scope to rawItem', () => {
      // Arrange
      const frame = createFrame({ rawItem: { name: 'Bob' } })

      // Act
      const result = resolveScopeReferences(scopeRef(0), [frame])

      // Assert
      expect(result).toEqual({ name: 'Bob' })
    })

    it('should resolve @key property', () => {
      // Arrange
      const frame = createFrame({ item: { '@key': 'person-0', name: 'Alice' } })

      // Act
      const result = resolveScopeReferences(scopeRef(0, '@key'), [frame])

      // Assert
      expect(result).toBe('person-0')
    })

    it('should resolve @item to rawItem', () => {
      // Arrange
      const frame = createFrame({ rawItem: 'rawValue' })

      // Act
      const result = resolveScopeReferences(scopeRef(0, '@item'), [frame])

      // Assert
      expect(result).toBe('rawValue')
    })

    it('should resolve @value property', () => {
      // Arrange
      const frame = createFrame({ item: { '@value': 42 } })

      // Act
      const result = resolveScopeReferences(scopeRef(0, '@value'), [frame])

      // Assert
      expect(result).toBe(42)
    })

    it('should resolve nested property path', () => {
      // Arrange
      const frame = createFrame({ item: { address: { city: 'London' } } })

      // Act
      const result = resolveScopeReferences(scopeRef(0, 'address', 'city'), [frame])

      // Assert
      expect(result).toBe('London')
    })

    it('should return undefined for missing nested path', () => {
      // Arrange
      const frame = createFrame({ item: { name: 'Alice' } })

      // Act
      const result = resolveScopeReferences(scopeRef(0, 'missing', 'deep'), [frame])

      // Assert
      expect(result).toBeUndefined()
    })

    it('should handle string level numbers', () => {
      // Arrange
      const frame = createFrame({ item: { name: 'Alice' } })

      // Act
      const result = resolveScopeReferences(scopeRef('0', 'name'), [frame])

      // Assert
      expect(result).toBe('Alice')
    })
  })

  describe('@loop references', () => {
    it('should resolve index (1-based)', () => {
      // Arrange
      const frame = createFrame({ index: 2 })

      // Act / Assert
      expect(resolveScopeReferences(loopRef(0, 'index'), [frame])).toBe(3)
    })

    it('should resolve index0 (0-based)', () => {
      // Arrange
      const frame = createFrame({ index: 2 })

      // Act / Assert
      expect(resolveScopeReferences(loopRef(0, 'index0'), [frame])).toBe(2)
    })

    it('should resolve first', () => {
      // Act / Assert
      expect(resolveScopeReferences(loopRef(0, 'first'), [createFrame({ index: 0 })])).toBe(true)
      expect(resolveScopeReferences(loopRef(0, 'first'), [createFrame({ index: 1 })])).toBe(false)
    })

    it('should resolve last', () => {
      // Act / Assert
      expect(resolveScopeReferences(loopRef(0, 'last'), [createFrame({ index: 2, inputLength: 3 })])).toBe(true)
      expect(resolveScopeReferences(loopRef(0, 'last'), [createFrame({ index: 0, inputLength: 3 })])).toBe(false)
    })

    it('should resolve length', () => {
      // Arrange
      const frame = createFrame({ inputLength: 5 })

      // Act / Assert
      expect(resolveScopeReferences(loopRef(0, 'length'), [frame])).toBe(5)
    })

    it('should resolve revindex', () => {
      // Arrange
      const frame = createFrame({ index: 1, inputLength: 4 })

      // Act / Assert
      expect(resolveScopeReferences(loopRef(0, 'revindex'), [frame])).toBe(3)
    })

    it('should resolve revindex0', () => {
      // Arrange
      const frame = createFrame({ index: 1, inputLength: 4 })

      // Act / Assert
      expect(resolveScopeReferences(loopRef(0, 'revindex0'), [frame])).toBe(2)
    })
  })

  describe('multi-level scope stack', () => {
    it('should resolve level 1 against the parent frame', () => {
      // Arrange
      const innerFrame = createFrame({ item: { street: 'A St' } })
      const outerFrame = createFrame({ item: { name: 'Alice' } })

      // Act
      const result = resolveScopeReferences(scopeRef(1, 'name'), [innerFrame, outerFrame])

      // Assert
      expect(result).toBe('Alice')
    })

    it('should resolve level 0 against the innermost frame', () => {
      // Arrange
      const innerFrame = createFrame({ item: { street: 'A St' } })
      const outerFrame = createFrame({ item: { name: 'Alice' } })

      // Act
      const result = resolveScopeReferences(scopeRef(0, 'street'), [innerFrame, outerFrame])

      // Assert
      expect(result).toBe('A St')
    })
  })

  describe('non-scope template nodes', () => {
    it('should preserve function call nodes with children recursed', () => {
      // Arrange
      const node = functionNode('Format', ['Person %1', scopeRef(0, 'name')])

      // Act
      const result = resolveScopeReferences(node, [createFrame({ item: { name: 'Alice' } })]) as Record<string, unknown>

      // Assert
      expect(result.type).toBe('AstNode.Template')
      expect(result.expressionType).toBe('ExpressionType.Function')
      const props = result.properties as Record<string, unknown>
      expect(props.name).toBe('Format')
      expect((props.arguments as unknown[])[0]).toBe('Person %1')
      expect((props.arguments as unknown[])[1]).toBe('Alice')
    })
  })

  describe('arrays', () => {
    it('should resolve scope refs within arrays', () => {
      // Arrange
      const value = ['static', scopeRef(0, 'name'), 42]

      // Act
      const result = resolveScopeReferences(value, [createFrame({ item: { name: 'Alice' } })]) as unknown[]

      // Assert
      expect(result).toEqual(['static', 'Alice', 42])
    })
  })

  describe('plain objects', () => {
    it('should recurse into plain object values', () => {
      // Arrange
      const value = { label: scopeRef(0, 'name'), hint: 'static' }

      // Act
      const result = resolveScopeReferences(value, [createFrame({ item: { name: 'Alice' } })]) as Record<
        string,
        unknown
      >

      // Assert
      expect(result.label).toBe('Alice')
      expect(result.hint).toBe('static')
    })
  })
})
