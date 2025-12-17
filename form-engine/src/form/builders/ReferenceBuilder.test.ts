import { ReferenceBuilder } from './ReferenceBuilder'
import { ConditionFunctionExpr, PipelineExpr, TransformerFunctionExpr } from '../types/expressions.type'
import { ExpressionType, FunctionType, LogicType } from '../types/enums'

describe('ReferenceBuilder', () => {
  // Helper to create a mock condition
  const mockCondition = (name: string): ConditionFunctionExpr<any> => ({
    type: FunctionType.CONDITION,
    name,
    arguments: [],
  })

  // Helper to create a mock transformer
  const mockTransformer = (name: string): TransformerFunctionExpr<any> => ({
    type: FunctionType.TRANSFORMER,
    name,
    arguments: [],
  })

  describe('create()', () => {
    it('should create builder with given path segments', () => {
      // Arrange
      const path = ['answers', 'email']

      // Act
      const builder = ReferenceBuilder.create(path)

      // Assert
      expect(builder.expr).toEqual({
        type: ExpressionType.REFERENCE,
        path: ['answers', 'email'],
      })
    })

    it('should create builder with nested path', () => {
      // Arrange
      const path = ['data', 'user', 'address', 'postcode']

      // Act
      const builder = ReferenceBuilder.create(path)

      // Assert
      expect(builder.expr.path).toEqual(['data', 'user', 'address', 'postcode'])
    })
  })

  describe('build()', () => {
    it('should return the underlying ReferenceExpr', () => {
      // Arrange
      const builder = ReferenceBuilder.create(['answers', 'email'])

      // Act
      const result = builder.build()

      // Assert
      expect(result).toEqual({
        type: ExpressionType.REFERENCE,
        path: ['answers', 'email'],
      })
    })
  })

  describe('path()', () => {
    it('should append single key to path', () => {
      // Arrange
      const builder = ReferenceBuilder.create(['data', 'user'])

      // Act
      const result = builder.path('email')

      // Assert
      expect(result.expr.path).toEqual(['data', 'user', 'email'])
    })

    it('should handle dot notation', () => {
      // Arrange
      const builder = ReferenceBuilder.create(['data'])

      // Act
      const result = builder.path('user.address.city')

      // Assert
      expect(result.expr.path).toEqual(['data', 'user', 'address', 'city'])
    })

    it('should be chainable', () => {
      // Arrange
      const builder = ReferenceBuilder.create(['data'])

      // Act
      const result = builder.path('user').path('address').path('postcode')

      // Assert
      expect(result.expr.path).toEqual(['data', 'user', 'address', 'postcode'])
    })

    it('should return new builder (immutable)', () => {
      // Arrange
      const original = ReferenceBuilder.create(['data', 'user'])

      // Act
      const extended = original.path('email')

      // Assert
      expect(original.expr.path).toEqual(['data', 'user'])
      expect(extended.expr.path).toEqual(['data', 'user', 'email'])
    })
  })

  describe('pipe()', () => {
    it('should return ExpressionBuilder wrapping PipelineExpr', () => {
      // Arrange
      const builder = ReferenceBuilder.create(['answers', 'email'])
      const transformer = mockTransformer('trim')

      // Act
      const result = builder.pipe(transformer)

      // Assert
      expect(result.expr.type).toBe(ExpressionType.PIPELINE)
      expect((result.expr as PipelineExpr).input).toEqual({
        type: ExpressionType.REFERENCE,
        path: ['answers', 'email'],
      })
      expect((result.expr as PipelineExpr).steps).toEqual([transformer])
    })

    it('should support multiple transformers', () => {
      // Arrange
      const builder = ReferenceBuilder.create(['answers', 'email'])
      const t1 = mockTransformer('trim')
      const t2 = mockTransformer('toLowerCase')

      // Act
      const result = builder.pipe(t1, t2)

      // Assert
      expect((result.expr as PipelineExpr).steps).toEqual([t1, t2])
    })

    it('should support chaining pipe().match()', () => {
      // Arrange
      const builder = ReferenceBuilder.create(['answers', 'quantity'])
      const transformer = mockTransformer('parse')
      const condition = mockCondition('greaterThan')

      // Act
      const result = builder.pipe(transformer).match(condition)

      // Assert
      expect(result.type).toBe(LogicType.TEST)
      expect((result.subject as PipelineExpr).type).toBe(ExpressionType.PIPELINE)
      expect(result.condition).toEqual(condition)
    })

    it('should support chaining pipe().not.match()', () => {
      // Arrange
      const builder = ReferenceBuilder.create(['answers', 'email'])
      const transformer = mockTransformer('trim')
      const condition = mockCondition('isEmpty')

      // Act
      const result = builder.pipe(transformer).not.match(condition)

      // Assert
      expect(result.negate).toBe(true)
    })

    it('should support chaining multiple pipe() calls', () => {
      // Arrange
      const builder = ReferenceBuilder.create(['answers', 'email'])
      const t1 = mockTransformer('trim')
      const t2 = mockTransformer('toLowerCase')

      // Act
      const result = builder.pipe(t1).pipe(t2)

      // Assert
      // Outer pipeline wraps inner pipeline
      const outer = result.expr as PipelineExpr
      expect(outer.type).toBe(ExpressionType.PIPELINE)
      expect(outer.steps).toEqual([t2])

      const inner = outer.input as PipelineExpr
      expect(inner.type).toBe(ExpressionType.PIPELINE)
      expect(inner.steps).toEqual([t1])
    })
  })

  describe('match()', () => {
    it('should create PredicateTestExpr with negate: false', () => {
      // Arrange
      const builder = ReferenceBuilder.create(['answers', 'email'])
      const condition = mockCondition('isRequired')

      // Act
      const result = builder.match(condition)

      // Assert
      expect(result).toEqual({
        type: LogicType.TEST,
        subject: {
          type: ExpressionType.REFERENCE,
          path: ['answers', 'email'],
        },
        negate: false,
        condition,
      })
    })
  })

  describe('not', () => {
    it('should return new builder (immutable)', () => {
      // Arrange
      const original = ReferenceBuilder.create(['answers', 'email'])

      // Act
      const negated = original.not

      // Assert
      expect(negated).not.toBe(original)
    })

    it('should create PredicateTestExpr with negate: true', () => {
      // Arrange
      const builder = ReferenceBuilder.create(['answers', 'email'])
      const condition = mockCondition('isRequired')

      // Act
      const result = builder.not.match(condition)

      // Assert
      expect(result.negate).toBe(true)
    })

    it('should support double negation', () => {
      // Arrange
      const builder = ReferenceBuilder.create(['answers', 'email'])
      const condition = mockCondition('isRequired')

      // Act
      const result = builder.not.not.match(condition)

      // Assert
      expect(result.negate).toBe(false)
    })
  })

  describe('immutability', () => {
    it('should not mutate original builder when calling path()', () => {
      // Arrange
      const original = ReferenceBuilder.create(['data', 'user'])

      // Act
      const extended = original.path('email')

      // Assert
      expect(original.expr.path).toEqual(['data', 'user'])
      expect(extended.expr.path).toEqual(['data', 'user', 'email'])
    })

    it('should not mutate original builder when calling not', () => {
      // Arrange
      const original = ReferenceBuilder.create(['answers', 'email'])
      const condition = mockCondition('isRequired')

      // Act
      const negatedResult = original.not.match(condition)
      const normalResult = original.match(condition)

      // Assert
      expect(negatedResult.negate).toBe(true)
      expect(normalResult.negate).toBe(false)
    })
  })
})
