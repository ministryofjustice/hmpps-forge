import { ScopedReferenceBuilder } from './ScopedReferenceBuilder'
import { ExpressionType } from '../../shared/taxonomy'

describe('ScopedReferenceBuilder', () => {
  describe('create()', () => {
    it('should create builder at level 0', () => {
      // Arrange & Act
      const builder = ScopedReferenceBuilder.create(0)

      // Assert
      expect(builder.value().expr.path).toEqual(['@scope', '0'])
    })

    it('should create builder at specified level', () => {
      // Arrange & Act
      const builder = ScopedReferenceBuilder.create(2)

      // Assert
      expect(builder.value().expr.path).toEqual(['@scope', '2'])
    })
  })

  describe('parent', () => {
    it('should return builder at next level up', () => {
      // Arrange
      const builder = ScopedReferenceBuilder.create(0)

      // Act
      const parent = builder.parent

      // Assert
      expect(parent.value().expr.path).toEqual(['@scope', '1'])
    })

    it('should support chaining multiple parent calls', () => {
      // Arrange
      const builder = ScopedReferenceBuilder.create(0)

      // Act
      const grandparent = builder.parent.parent

      // Assert
      expect(grandparent.value().expr.path).toEqual(['@scope', '2'])
    })

    it('should be immutable', () => {
      // Arrange
      const original = ScopedReferenceBuilder.create(0)

      // Act
      const parent = original.parent

      // Assert
      expect(original.value().expr.path).toEqual(['@scope', '0'])
      expect(parent.value().expr.path).toEqual(['@scope', '1'])
    })
  })

  describe('path()', () => {
    it('should return ReferenceBuilder with property path', () => {
      // Arrange
      const builder = ScopedReferenceBuilder.create(0)

      // Act
      const result = builder.path('name')

      // Assert
      expect(result.expr).toEqual({
        _forge: ExpressionType.REFERENCE,
        path: ['@scope', '0', 'name'],
      })
    })

    it('should handle dot notation', () => {
      // Arrange
      const builder = ScopedReferenceBuilder.create(0)

      // Act
      const result = builder.path('address.city')

      // Assert
      expect(result.expr.path).toEqual(['@scope', '0', 'address', 'city'])
    })

    it('should work with parent navigation', () => {
      // Arrange
      const builder = ScopedReferenceBuilder.create(0)

      // Act
      const result = builder.parent.path('groupId')

      // Assert
      expect(result.expr.path).toEqual(['@scope', '1', 'groupId'])
    })

    it('should return ReferenceBuilder that supports chaining', () => {
      // Arrange
      const builder = ScopedReferenceBuilder.create(0)

      // Act - path() returns ReferenceBuilder which has pipe() and match()
      const ref = builder.path('price')

      // Assert
      expect(ref.expr._forge).toBe(ExpressionType.REFERENCE)
      expect(typeof ref.pipe).toBe('function')
      expect(typeof ref.match).toBe('function')
    })
  })

  describe('build()', () => {
    it('should build a bare Item() into the whole-item reference', () => {
      // Arrange
      const builder = ScopedReferenceBuilder.create(0)

      // Act
      const built = builder.build()

      // Assert
      expect(built).toEqual({
        _forge: ExpressionType.REFERENCE,
        path: ['@scope', '0'],
      })
    })
  })

  describe('value()', () => {
    it('should return ReferenceBuilder for whole item', () => {
      // Arrange
      const builder = ScopedReferenceBuilder.create(0)

      // Act
      const result = builder.value()

      // Assert
      expect(result.expr).toEqual({
        _forge: ExpressionType.REFERENCE,
        path: ['@scope', '0'],
      })
    })

    it('should work with parent navigation', () => {
      // Arrange
      const builder = ScopedReferenceBuilder.create(0)

      // Act
      const result = builder.parent.value()

      // Assert
      expect(result.expr.path).toEqual(['@scope', '1'])
    })

    it('should return ReferenceBuilder that supports chaining', () => {
      // Arrange
      const builder = ScopedReferenceBuilder.create(0)

      // Act
      const ref = builder.value()

      // Assert
      expect(ref.expr._forge).toBe(ExpressionType.REFERENCE)
      expect(typeof ref.pipe).toBe('function')
      expect(typeof ref.match).toBe('function')
    })
  })

  describe('integration', () => {
    it('should support complex navigation patterns', () => {
      // Arrange
      const builder = ScopedReferenceBuilder.create(0)

      // Act - Navigate to grandparent's address city
      const result = builder.parent.parent.path('address.city')

      // Assert
      expect(result.expr.path).toEqual(['@scope', '2', 'address', 'city'])
    })

    it('should work like Item() factory function', () => {
      // Arrange - Simulating Item() which calls create(0)
      const item = ScopedReferenceBuilder.create(0)

      // Act
      const name = item.path('name')
      const value = item.value()
      const parentName = item.parent.path('groupName')

      // Assert
      expect(name.expr.path).toEqual(['@scope', '0', 'name'])
      expect(value.expr.path).toEqual(['@scope', '0'])
      expect(parentName.expr.path).toEqual(['@scope', '1', 'groupName'])
    })
  })
})
