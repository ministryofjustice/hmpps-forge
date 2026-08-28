import { LoopReferenceBuilder } from './LoopReferenceBuilder'
import { ExpressionType } from '../../shared/taxonomy'

describe('LoopReferenceBuilder', () => {
  describe('create()', () => {
    it('should create builder at level 0', () => {
      // Arrange & Act
      const builder = LoopReferenceBuilder.create(0)

      // Assert
      expect(builder.Index0().expr.path).toEqual(['@loop', '0', 'index0'])
    })

    it('should create builder at specified level', () => {
      // Arrange & Act
      const builder = LoopReferenceBuilder.create(2)

      // Assert
      expect(builder.Index0().expr.path).toEqual(['@loop', '2', 'index0'])
    })
  })

  describe('Parent', () => {
    it('should return builder at next level up', () => {
      // Arrange
      const builder = LoopReferenceBuilder.create(0)

      // Act
      const parent = builder.Parent

      // Assert
      expect(parent.Index().expr.path).toEqual(['@loop', '1', 'index'])
    })

    it('should support chaining multiple Parent calls', () => {
      // Arrange
      const builder = LoopReferenceBuilder.create(0)

      // Act
      const grandparent = builder.Parent.Parent

      // Assert
      expect(grandparent.Index0().expr.path).toEqual(['@loop', '2', 'index0'])
    })

    it('should be immutable', () => {
      // Arrange
      const original = LoopReferenceBuilder.create(0)

      // Act
      const parent = original.Parent

      // Assert
      expect(original.Index0().expr.path).toEqual(['@loop', '0', 'index0'])
      expect(parent.Index0().expr.path).toEqual(['@loop', '1', 'index0'])
    })
  })

  describe('Item()', () => {
    it('should return item property paths under the loop namespace', () => {
      // Arrange
      const builder = LoopReferenceBuilder.create(0)

      // Act
      const ref = builder.Item().path('name')

      // Assert
      expect(ref.expr).toEqual({ _forge: ExpressionType.REFERENCE, path: ['@loop', '0', 'item', 'name'] })
    })

    it('should split dot notation in item property paths', () => {
      // Arrange
      const builder = LoopReferenceBuilder.create(0)

      // Act
      const ref = builder.Item().path('address.postcode')

      // Assert
      expect(ref.expr.path).toEqual(['@loop', '0', 'item', 'address', 'postcode'])
    })

    it('should return the bare item path from value()', () => {
      // Arrange
      const builder = LoopReferenceBuilder.create(0)

      // Act
      const ref = builder.Item().value()

      // Assert
      expect(ref.expr.path).toEqual(['@loop', '0', 'item'])
    })

    it('should return the item key path from key()', () => {
      // Arrange
      const builder = LoopReferenceBuilder.create(0)

      // Act
      const ref = builder.Item().key()

      // Assert
      expect(ref.expr.path).toEqual(['@loop', '0', 'item', '@key'])
    })

    it('should build a bare Item() into the whole-item reference', () => {
      // Arrange
      const builder = LoopReferenceBuilder.create(0)

      // Act
      const built = builder.Item().build()

      // Assert
      expect(built).toEqual({ _forge: ExpressionType.REFERENCE, path: ['@loop', '0', 'item'] })
    })

    it('should follow the builder level when reached through Parent', () => {
      // Arrange
      const builder = LoopReferenceBuilder.create(0)

      // Act
      const ref = builder.Parent.Parent.Item().path('groupId')

      // Assert
      expect(ref.expr.path).toEqual(['@loop', '2', 'item', 'groupId'])
    })
  })

  describe('metadata methods', () => {
    it('should return loop reference paths for all metadata values', () => {
      // Arrange
      const builder = LoopReferenceBuilder.create(0)

      // Act
      const index = builder.Index()
      const index0 = builder.Index0()
      const revIndex = builder.RevIndex()
      const revIndex0 = builder.RevIndex0()
      const first = builder.First()
      const last = builder.Last()
      const length = builder.Length()

      // Assert
      expect(index.expr).toEqual({ _forge: ExpressionType.REFERENCE, path: ['@loop', '0', 'index'] })
      expect(index0.expr).toEqual({ _forge: ExpressionType.REFERENCE, path: ['@loop', '0', 'index0'] })
      expect(revIndex.expr).toEqual({ _forge: ExpressionType.REFERENCE, path: ['@loop', '0', 'revindex'] })
      expect(revIndex0.expr).toEqual({ _forge: ExpressionType.REFERENCE, path: ['@loop', '0', 'revindex0'] })
      expect(first.expr).toEqual({ _forge: ExpressionType.REFERENCE, path: ['@loop', '0', 'first'] })
      expect(last.expr).toEqual({ _forge: ExpressionType.REFERENCE, path: ['@loop', '0', 'last'] })
      expect(length.expr).toEqual({ _forge: ExpressionType.REFERENCE, path: ['@loop', '0', 'length'] })
    })

    it('should return ReferenceBuilder instances that support chaining', () => {
      // Arrange
      const builder = LoopReferenceBuilder.create(0)

      // Act
      const ref = builder.Index0()

      // Assert
      expect(ref.expr._forge).toBe(ExpressionType.REFERENCE)
      expect(typeof ref.pipe).toBe('function')
      expect(typeof ref.match).toBe('function')
    })
  })
})
