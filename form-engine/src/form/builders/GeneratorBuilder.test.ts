import { GeneratorBuilder } from './GeneratorBuilder'
import { ConditionFunctionExpr, PipelineExpr, TransformerFunctionExpr } from '../types/expressions.type'
import { ExpressionType, FunctionType, LogicType } from '../types/enums'

describe('GeneratorBuilder', () => {
  // Helper to create a mock condition
  const mockCondition = (name: string): ConditionFunctionExpr<any> => ({
    type: FunctionType.CONDITION,
    name,
    arguments: [],
  })

  // Helper to create a mock transformer
  const mockTransformer = (name: string, args: any[] = []): TransformerFunctionExpr<any> => ({
    type: FunctionType.TRANSFORMER,
    name,
    arguments: args,
  })

  describe('create()', () => {
    it('should create builder with generator expression', () => {
      // Arrange
      const name = 'Now'

      // Act
      const builder = GeneratorBuilder.create(name, [])

      // Assert
      expect(builder.expr).toEqual({
        type: FunctionType.GENERATOR,
        name: 'Now',
        arguments: [],
      })
    })

    it('should create builder with arguments', () => {
      // Arrange
      const name = 'WithPrefix'
      const args = ['prefix-', 123]

      // Act
      const builder = GeneratorBuilder.create(name, args)

      // Assert
      expect(builder.expr).toEqual({
        type: FunctionType.GENERATOR,
        name: 'WithPrefix',
        arguments: ['prefix-', 123],
      })
    })
  })

  describe('build()', () => {
    it('should return the underlying generator expression', () => {
      // Arrange
      const builder = GeneratorBuilder.create('Now', [])

      // Act
      const result = builder.build()

      // Assert
      expect(result).toEqual({
        type: FunctionType.GENERATOR,
        name: 'Now',
        arguments: [],
      })
    })
  })

  describe('pipe()', () => {
    it('should return ExpressionBuilder wrapping PipelineExpr', () => {
      // Arrange
      const builder = GeneratorBuilder.create('Now', [])
      const transformer = mockTransformer('AddDays', [7])

      // Act
      const result = builder.pipe(transformer)

      // Assert
      expect(result.expr.type).toBe(ExpressionType.PIPELINE)
      expect((result.expr as PipelineExpr).input).toEqual({
        type: FunctionType.GENERATOR,
        name: 'Now',
        arguments: [],
      })
      expect((result.expr as PipelineExpr).steps).toEqual([transformer])
    })

    it('should support multiple transformers in single pipe call', () => {
      // Arrange
      const builder = GeneratorBuilder.create('Now', [])
      const t1 = mockTransformer('AddDays', [7])
      const t2 = mockTransformer('Format', ['YYYY-MM-DD'])

      // Act
      const result = builder.pipe(t1, t2)

      // Assert
      expect((result.expr as PipelineExpr).steps).toEqual([t1, t2])
    })

    it('should support chaining pipe().match()', () => {
      // Arrange
      const builder = GeneratorBuilder.create('Now', [])
      const transformer = mockTransformer('AddDays', [7])
      const condition = mockCondition('IsFutureDate')

      // Act
      const result = builder.pipe(transformer).match(condition)

      // Assert
      expect(result.type).toBe(LogicType.TEST)
      expect((result.subject as PipelineExpr).type).toBe(ExpressionType.PIPELINE)
      expect(result.condition).toEqual(condition)
    })

    it('should support chaining pipe().not.match()', () => {
      // Arrange
      const builder = GeneratorBuilder.create('Now', [])
      const transformer = mockTransformer('AddDays', [7])
      const condition = mockCondition('IsPast')

      // Act
      const result = builder.pipe(transformer).not.match(condition)

      // Assert
      expect(result.negate).toBe(true)
    })

    it('should support chaining multiple pipe() calls (nested pipelines)', () => {
      // Arrange
      const builder = GeneratorBuilder.create('Now', [])
      const t1 = mockTransformer('AddDays', [7])
      const t2 = mockTransformer('Format', ['YYYY-MM-DD'])

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
  })

  describe('match()', () => {
    it('should create PredicateTestExpr with negate: false', () => {
      // Arrange
      const builder = GeneratorBuilder.create('Now', [])
      const condition = mockCondition('IsFutureDate')

      // Act
      const result = builder.match(condition)

      // Assert
      expect(result).toEqual({
        type: LogicType.TEST,
        subject: {
          type: FunctionType.GENERATOR,
          name: 'Now',
          arguments: [],
        },
        negate: false,
        condition,
      })
    })
  })

  describe('not', () => {
    it('should return new builder (immutable)', () => {
      // Arrange
      const original = GeneratorBuilder.create('Now', [])

      // Act
      const negated = original.not

      // Assert
      expect(negated).not.toBe(original)
    })

    it('should create PredicateTestExpr with negate: true', () => {
      // Arrange
      const builder = GeneratorBuilder.create('Now', [])
      const condition = mockCondition('IsPast')

      // Act
      const result = builder.not.match(condition)

      // Assert
      expect(result.negate).toBe(true)
    })

    it('should support double negation', () => {
      // Arrange
      const builder = GeneratorBuilder.create('Now', [])
      const condition = mockCondition('IsPast')

      // Act
      const result = builder.not.not.match(condition)

      // Assert
      expect(result.negate).toBe(false)
    })

    it('should support triple negation', () => {
      // Arrange
      const builder = GeneratorBuilder.create('Now', [])
      const condition = mockCondition('IsPast')

      // Act
      const result = builder.not.not.not.match(condition)

      // Assert
      expect(result.negate).toBe(true)
    })
  })

  describe('immutability', () => {
    it('should not mutate original builder when calling pipe()', () => {
      // Arrange
      const original = GeneratorBuilder.create('Now', [])
      const transformer = mockTransformer('AddDays', [7])

      // Act
      const piped = original.pipe(transformer)

      // Assert
      expect(original.expr.type).toBe(FunctionType.GENERATOR)
      expect(piped.expr.type).toBe(ExpressionType.PIPELINE)
    })

    it('should not mutate original builder when calling not', () => {
      // Arrange
      const original = GeneratorBuilder.create('Now', [])
      const condition = mockCondition('IsPast')

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
      const builder = GeneratorBuilder.create('Now', [])
      const c1 = mockCondition('IsFutureDate')
      const c2 = mockCondition('IsPast')

      // Act
      const result1 = builder.match(c1)
      const result2 = builder.match(c2)

      // Assert
      expect(result1.condition.name).toBe('IsFutureDate')
      expect(result2.condition.name).toBe('IsPast')
    })

    it('should allow multiple pipe() calls on same builder', () => {
      // Arrange
      const builder = GeneratorBuilder.create('Now', [])
      const t1 = mockTransformer('AddDays', [7])
      const t2 = mockTransformer('SubtractDays', [3])

      // Act
      const result1 = builder.pipe(t1)
      const result2 = builder.pipe(t2)

      // Assert
      const expr1 = result1.expr as PipelineExpr
      const expr2 = result2.expr as PipelineExpr
      expect(expr1.steps[0].name).toBe('AddDays')
      expect(expr2.steps[0].name).toBe('SubtractDays')
    })
  })
})
