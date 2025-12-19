import { Iterator } from './IteratorBuilder'
import { IteratorType, LogicType } from '../types/enums'
import { PredicateTestExpr } from '../types/expressions.type'

describe('Iterator', () => {
  // Helper to create a mock predicate
  const mockPredicate = (): PredicateTestExpr => ({
    type: LogicType.TEST,
    subject: { type: 'ExpressionType.Reference' as any, path: ['@scope', '0', 'active'] },
    negate: false,
    condition: { type: 'FunctionType.Condition' as any, name: 'isTrue', arguments: [] },
  })

  describe('Map()', () => {
    it('should create MapIteratorConfig with yield template', () => {
      // Arrange
      const yieldTemplate = { label: 'test', value: 'id' }

      // Act
      const result = Iterator.Map(yieldTemplate)

      // Assert
      expect(result.type).toBe(IteratorType.MAP)
      expect(result.yield).toBe(yieldTemplate)
    })

    it('should create MapIteratorConfig with complex yield template', () => {
      // Arrange
      const yieldTemplate = {
        label: { type: 'ExpressionType.Reference', path: ['@scope', '0', 'name'] },
        value: { type: 'ExpressionType.Reference', path: ['@scope', '0', 'id'] },
        metadata: {
          index: { type: 'ExpressionType.Reference', path: ['@scope', '0', '@index'] },
        },
      }

      // Act
      const result = Iterator.Map(yieldTemplate)

      // Assert
      expect(result.type).toBe(IteratorType.MAP)
      expect(result.yield).toEqual(yieldTemplate)
    })

    it('should create MapIteratorConfig with primitive yield', () => {
      // Arrange
      const yieldTemplate = { type: 'ExpressionType.Reference', path: ['@scope', '0', 'name'] }

      // Act
      const result = Iterator.Map(yieldTemplate)

      // Assert
      expect(result.type).toBe(IteratorType.MAP)
      expect(result.yield).toEqual(yieldTemplate)
    })

    it('should create MapIteratorConfig with array yield', () => {
      // Arrange
      const yieldTemplate = [{ label: 'a' }, { label: 'b' }]

      // Act
      const result = Iterator.Map(yieldTemplate)

      // Assert
      expect(result.type).toBe(IteratorType.MAP)
      expect(result.yield).toEqual(yieldTemplate)
    })
  })

  describe('Filter()', () => {
    it('should create FilterIteratorConfig with predicate', () => {
      // Arrange
      const predicate = mockPredicate()

      // Act
      const result = Iterator.Filter(predicate)

      // Assert
      expect(result.type).toBe(IteratorType.FILTER)
      expect(result.predicate).toBe(predicate)
    })

    it('should preserve predicate reference', () => {
      // Arrange
      const predicate = mockPredicate()

      // Act
      const result = Iterator.Filter(predicate)

      // Assert
      expect(result.predicate).toBe(predicate) // Same reference
    })
  })

  describe('Find()', () => {
    it('should create FindIteratorConfig with predicate', () => {
      // Arrange
      const predicate = mockPredicate()

      // Act
      const result = Iterator.Find(predicate)

      // Assert
      expect(result.type).toBe(IteratorType.FIND)
      expect(result.predicate).toBe(predicate)
    })

    it('should preserve predicate reference', () => {
      // Arrange
      const predicate = mockPredicate()

      // Act
      const result = Iterator.Find(predicate)

      // Assert
      expect(result.predicate).toBe(predicate) // Same reference
    })
  })

  describe('type safety', () => {
    it('should produce MapIteratorConfig type from Map()', () => {
      // Arrange
      const config = Iterator.Map({})

      // Act & Assert
      expect(config.type).toBe(IteratorType.MAP)
      expect('yield' in config).toBe(true)
      expect('predicate' in config).toBe(false)
    })

    it('should produce FilterIteratorConfig type from Filter()', () => {
      // Arrange
      const config = Iterator.Filter(mockPredicate())

      // Act & Assert
      expect(config.type).toBe(IteratorType.FILTER)
      expect('predicate' in config).toBe(true)
      expect('yield' in config).toBe(false)
    })

    it('should produce FindIteratorConfig type from Find()', () => {
      // Arrange
      const config = Iterator.Find(mockPredicate())

      // Act & Assert
      expect(config.type).toBe(IteratorType.FIND)
      expect('predicate' in config).toBe(true)
      expect('yield' in config).toBe(false)
    })
  })
})
