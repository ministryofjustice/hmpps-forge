import { ExpressionBuilder } from './ExpressionBuilder'
import { ConditionFunctionExpr, PipelineExpr, ReferenceExpr, TransformerFunctionExpr } from '../types/expressions.type'
import { ExpressionType, FunctionType, LogicType } from '../types/enums'

describe('ExpressionBuilder', () => {
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

  // Helper to create a mock reference
  const mockRef = (): ReferenceExpr => ({
    type: ExpressionType.REFERENCE,
    path: ['answers', 'email'],
  })

  describe('from()', () => {
    it('should create builder from ReferenceExpr', () => {
      // Arrange
      const ref = mockRef()

      // Act
      const builder = ExpressionBuilder.from(ref)

      // Assert
      expect(builder.expr).toEqual(ref)
    })

    it('should create builder from string literal', () => {
      // Arrange
      const value = 'test string'

      // Act
      const builder = ExpressionBuilder.from(value)

      // Assert
      expect(builder.expr).toBe(value)
    })

    it('should create builder from number literal', () => {
      // Arrange
      const value = 42

      // Act
      const builder = ExpressionBuilder.from(value)

      // Assert
      expect(builder.expr).toBe(value)
    })
  })

  describe('pipeline()', () => {
    it('should create builder wrapping a PipelineExpr', () => {
      // Arrange
      const ref = mockRef()
      const transformer = mockTransformer('trim')

      // Act
      const builder = ExpressionBuilder.pipeline(ref, [transformer])

      // Assert
      expect(builder.expr).toEqual({
        type: ExpressionType.PIPELINE,
        input: ref,
        steps: [transformer],
      })
    })

    it('should create pipeline with multiple steps', () => {
      // Arrange
      const ref = mockRef()
      const steps = [mockTransformer('trim'), mockTransformer('toLowerCase')]

      // Act
      const builder = ExpressionBuilder.pipeline(ref, steps)

      // Assert
      expect(builder.expr.steps).toHaveLength(2)
    })
  })

  describe('build()', () => {
    it('should return the underlying expression', () => {
      // Arrange
      const ref = mockRef()
      const builder = ExpressionBuilder.from(ref)

      // Act
      const result = builder.build()

      // Assert
      expect(result).toEqual(ref)
    })
  })

  describe('pipe()', () => {
    it('should return new builder with PipelineExpr', () => {
      // Arrange
      const ref = mockRef()
      const builder = ExpressionBuilder.from(ref)
      const transformer = mockTransformer('trim')

      // Act
      const piped = builder.pipe(transformer)

      // Assert
      expect(piped.expr.type).toBe(ExpressionType.PIPELINE)
      expect((piped.expr as PipelineExpr).input).toEqual(ref)
      expect((piped.expr as PipelineExpr).steps).toEqual([transformer])
    })

    it('should support multiple transformers in single pipe call', () => {
      // Arrange
      const ref = mockRef()
      const builder = ExpressionBuilder.from(ref)
      const t1 = mockTransformer('trim')
      const t2 = mockTransformer('toLowerCase')

      // Act
      const piped = builder.pipe(t1, t2)

      // Assert
      expect((piped.expr as PipelineExpr).steps).toEqual([t1, t2])
    })

    it('should support chaining multiple pipe() calls (nested pipelines)', () => {
      // Arrange
      const ref = mockRef()
      const builder = ExpressionBuilder.from(ref)
      const t1 = mockTransformer('trim')
      const t2 = mockTransformer('toLowerCase')

      // Act
      const result = builder.pipe(t1).pipe(t2)

      // Assert
      // The outer pipeline should have the inner pipeline as input
      const outerPipeline = result.expr as PipelineExpr
      expect(outerPipeline.type).toBe(ExpressionType.PIPELINE)
      expect(outerPipeline.steps).toEqual([t2])

      const innerPipeline = outerPipeline.input as PipelineExpr
      expect(innerPipeline.type).toBe(ExpressionType.PIPELINE)
      expect(innerPipeline.steps).toEqual([t1])
    })

    it('should support match() after pipe()', () => {
      // Arrange
      const ref = mockRef()
      const builder = ExpressionBuilder.from(ref)
      const transformer = mockTransformer('trim')
      const condition = mockCondition('isRequired')

      // Act
      const result = builder.pipe(transformer).match(condition)

      // Assert
      expect(result.type).toBe(LogicType.TEST)
      expect(result.negate).toBe(false)
      expect((result.subject as PipelineExpr).type).toBe(ExpressionType.PIPELINE)
      expect(result.condition).toEqual(condition)
    })

    it('should support not.match() after pipe()', () => {
      // Arrange
      const ref = mockRef()
      const builder = ExpressionBuilder.from(ref)
      const transformer = mockTransformer('trim')
      const condition = mockCondition('isRequired')

      // Act
      const result = builder.pipe(transformer).not.match(condition)

      // Assert
      expect(result.type).toBe(LogicType.TEST)
      expect(result.negate).toBe(true)
      expect((result.subject as PipelineExpr).type).toBe(ExpressionType.PIPELINE)
    })
  })

  describe('match()', () => {
    it('should create PredicateTestExpr with negate: false', () => {
      // Arrange
      const ref = mockRef()
      const builder = ExpressionBuilder.from(ref)
      const condition = mockCondition('isRequired')

      // Act
      const result = builder.match(condition)

      // Assert
      expect(result).toEqual({
        type: LogicType.TEST,
        subject: ref,
        negate: false,
        condition,
      })
    })
  })

  describe('not', () => {
    it('should return new builder with negation toggled', () => {
      // Arrange
      const ref = mockRef()
      const builder = ExpressionBuilder.from(ref)

      // Act
      const negated = builder.not

      // Assert
      expect(negated).not.toBe(builder) // New instance
      expect(negated.expr).toEqual(ref) // Same expression
    })

    it('should create PredicateTestExpr with negate: true when using not.match()', () => {
      // Arrange
      const ref = mockRef()
      const builder = ExpressionBuilder.from(ref)
      const condition = mockCondition('isRequired')

      // Act
      const result = builder.not.match(condition)

      // Assert
      expect(result.negate).toBe(true)
    })

    it('should support double negation', () => {
      // Arrange
      const ref = mockRef()
      const builder = ExpressionBuilder.from(ref)
      const condition = mockCondition('isRequired')

      // Act
      const result = builder.not.not.match(condition)

      // Assert
      expect(result.negate).toBe(false)
    })

    it('should support triple negation', () => {
      // Arrange
      const ref = mockRef()
      const builder = ExpressionBuilder.from(ref)
      const condition = mockCondition('isRequired')

      // Act
      const result = builder.not.not.not.match(condition)

      // Assert
      expect(result.negate).toBe(true)
    })
  })

  describe('immutability', () => {
    it('should not mutate original builder when calling pipe()', () => {
      // Arrange
      const ref = mockRef()
      const original = ExpressionBuilder.from(ref)
      const transformer = mockTransformer('trim')

      // Act
      const piped = original.pipe(transformer)

      // Assert
      expect(original.expr.type).toBe(ExpressionType.REFERENCE)
      expect(piped.expr.type).toBe(ExpressionType.PIPELINE)
    })

    it('should not mutate original builder when calling not', () => {
      // Arrange
      const ref = mockRef()
      const original = ExpressionBuilder.from(ref)
      const condition = mockCondition('isRequired')

      // Act
      const negated = original.not
      const originalResult = original.match(condition)
      const negatedResult = negated.match(condition)

      // Assert
      expect(originalResult.negate).toBe(false)
      expect(negatedResult.negate).toBe(true)
    })

    it('should allow multiple match() calls on same builder', () => {
      // Arrange
      const ref = mockRef()
      const builder = ExpressionBuilder.from(ref)
      const c1 = mockCondition('isRequired')
      const c2 = mockCondition('isEmail')

      // Act
      const result1 = builder.match(c1)
      const result2 = builder.match(c2)

      // Assert
      expect(result1.condition.name).toBe('isRequired')
      expect(result2.condition.name).toBe('isEmail')
    })

    it('should allow match() after not without affecting original', () => {
      // Arrange
      const ref = mockRef()
      const builder = ExpressionBuilder.from(ref)
      const condition = mockCondition('isRequired')

      // Act
      const negatedResult = builder.not.match(condition)
      const normalResult = builder.match(condition)

      // Assert
      expect(negatedResult.negate).toBe(true)
      expect(normalResult.negate).toBe(false)
    })
  })
})
