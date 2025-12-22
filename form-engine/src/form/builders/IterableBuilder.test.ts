import { IterableBuilder } from './IterableBuilder'
import { Iterator } from './IteratorBuilder'
import {
  ConditionFunctionExpr,
  IterateExpr,
  PipelineExpr,
  ReferenceExpr,
  TransformerFunctionExpr,
} from '../types/expressions.type'
import { ExpressionType, FunctionType, IteratorType, LogicType } from '../types/enums'

describe('IterableBuilder', () => {
  // Helper to create a mock reference (data source)
  const mockRef = (): ReferenceExpr => ({
    type: ExpressionType.REFERENCE,
    path: ['data', 'items'],
  })

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

  // Helper to create a mock predicate for filter
  const mockPredicate = () => ({
    type: LogicType.TEST as const,
    subject: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'active'] },
    negate: false,
    condition: mockCondition('isTrue'),
  })

  describe('create()', () => {
    it('should create IterableBuilder with Map iterator', () => {
      // Arrange
      const input = mockRef()
      const iterator = Iterator.Map({ label: 'test' })

      // Act
      const builder = IterableBuilder.create(input, iterator)

      // Assert
      expect(builder.expr.type).toBe(ExpressionType.ITERATE)
      expect(builder.expr.input).toBe(input)
      expect(builder.expr.iterator.type).toBe(IteratorType.MAP)
    })

    it('should create IterableBuilder with Filter iterator', () => {
      // Arrange
      const input = mockRef()
      const iterator = Iterator.Filter(mockPredicate())

      // Act
      const builder = IterableBuilder.create(input, iterator)

      // Assert
      expect(builder.expr.type).toBe(ExpressionType.ITERATE)
      expect(builder.expr.input).toBe(input)
      expect(builder.expr.iterator.type).toBe(IteratorType.FILTER)
    })
  })

  describe('build()', () => {
    it('should return the underlying IterateExpr', () => {
      // Arrange
      const input = mockRef()
      const iterator = Iterator.Map({})
      const builder = IterableBuilder.create(input, iterator)

      // Act
      const result = builder.build()

      // Assert
      expect(result.type).toBe(ExpressionType.ITERATE)
      expect(result.input).toBe(input)
      expect(result.iterator).toBe(iterator)
    })
  })

  describe('each()', () => {
    it('should chain another iterator and return new IterableBuilder', () => {
      // Arrange
      const input = mockRef()
      const filterIterator = Iterator.Filter(mockPredicate())
      const mapIterator = Iterator.Map({ label: 'name' })

      // Act
      const builder = IterableBuilder.create(input, filterIterator)
      const chained = builder.each(mapIterator)

      // Assert
      expect(chained.expr.type).toBe(ExpressionType.ITERATE)
      expect(chained.expr.iterator.type).toBe(IteratorType.MAP)
      // Input should be the previous iterate expression
      const chainedInput = chained.expr.input as IterateExpr
      expect(chainedInput.type).toBe(ExpressionType.ITERATE)
      expect(chainedInput.iterator.type).toBe(IteratorType.FILTER)
    })

    it('should support multiple chained each() calls', () => {
      // Arrange
      const input = mockRef()
      const filter1 = Iterator.Filter(mockPredicate())
      const filter2 = Iterator.Filter(mockPredicate())
      const map = Iterator.Map({})

      // Act
      const result = IterableBuilder.create(input, filter1).each(filter2).each(map)

      // Assert
      expect(result.expr.type).toBe(ExpressionType.ITERATE)
      expect(result.expr.iterator.type).toBe(IteratorType.MAP)

      // Second level should be filter2
      const level2 = result.expr.input as IterateExpr
      expect(level2.type).toBe(ExpressionType.ITERATE)
      expect(level2.iterator.type).toBe(IteratorType.FILTER)

      // Third level should be filter1
      const level3 = level2.input as IterateExpr
      expect(level3.type).toBe(ExpressionType.ITERATE)
      expect(level3.iterator.type).toBe(IteratorType.FILTER)

      // Bottom level should be the original reference
      expect(level3.input).toBe(input)
    })

    it('should not mutate original builder', () => {
      // Arrange
      const input = mockRef()
      const filter = Iterator.Filter(mockPredicate())
      const map = Iterator.Map({})
      const original = IterableBuilder.create(input, filter)

      // Act
      const chained = original.each(map)

      // Assert
      expect(original.expr.iterator.type).toBe(IteratorType.FILTER)
      expect(chained.expr.iterator.type).toBe(IteratorType.MAP)
    })
  })

  describe('pipe()', () => {
    it('should exit iteration mode and return ExpressionBuilder with PipelineExpr', () => {
      // Arrange
      const input = mockRef()
      const iterator = Iterator.Map({})
      const transformer = mockTransformer('slice')

      // Act
      const result = IterableBuilder.create(input, iterator).pipe(transformer)

      // Assert
      expect(result.expr.type).toBe(ExpressionType.PIPELINE)
      const pipeline = result.expr as PipelineExpr
      expect(pipeline.steps).toEqual([transformer])
      // Input should be the iterate expression
      expect((pipeline.input as IterateExpr).type).toBe(ExpressionType.ITERATE)
    })

    it('should support multiple transformers in pipe()', () => {
      // Arrange
      const input = mockRef()
      const iterator = Iterator.Map({})
      const t1 = mockTransformer('slice')
      const t2 = mockTransformer('reverse')

      // Act
      const result = IterableBuilder.create(input, iterator).pipe(t1, t2)

      // Assert
      const pipeline = result.expr as PipelineExpr
      expect(pipeline.steps).toEqual([t1, t2])
    })

    it('should allow further chaining after pipe()', () => {
      // Arrange
      const input = mockRef()
      const iterator = Iterator.Map({})
      const transformer = mockTransformer('slice')
      const condition = mockCondition('isNotEmpty')

      // Act
      const result = IterableBuilder.create(input, iterator).pipe(transformer).match(condition)

      // Assert
      expect(result.type).toBe(LogicType.TEST)
      expect(result.condition).toEqual(condition)
    })
  })

  describe('match()', () => {
    it('should create PredicateTestExpr with negate: false', () => {
      // Arrange
      const input = mockRef()
      const iterator = Iterator.Map({})
      const condition = mockCondition('isNotEmpty')

      // Act
      const result = IterableBuilder.create(input, iterator).match(condition)

      // Assert
      expect(result.type).toBe(LogicType.TEST)
      expect(result.negate).toBe(false)
      expect(result.condition).toEqual(condition)
      expect((result.subject as IterateExpr).type).toBe(ExpressionType.ITERATE)
    })
  })

  describe('not', () => {
    it('should return new builder with negation toggled', () => {
      // Arrange
      const input = mockRef()
      const iterator = Iterator.Map({})
      const builder = IterableBuilder.create(input, iterator)

      // Act
      const negated = builder.not

      // Assert
      expect(negated).not.toBe(builder) // New instance
      expect(negated.expr).toEqual(builder.expr) // Same expression
    })

    it('should create PredicateTestExpr with negate: true when using not.match()', () => {
      // Arrange
      const input = mockRef()
      const iterator = Iterator.Map({})
      const condition = mockCondition('isNotEmpty')

      // Act
      const result = IterableBuilder.create(input, iterator).not.match(condition)

      // Assert
      expect(result.negate).toBe(true)
    })

    it('should support double negation', () => {
      // Arrange
      const input = mockRef()
      const iterator = Iterator.Map({})
      const condition = mockCondition('isNotEmpty')

      // Act
      const result = IterableBuilder.create(input, iterator).not.not.match(condition)

      // Assert
      expect(result.negate).toBe(false)
    })
  })

  describe('immutability', () => {
    it('should not mutate original builder when calling each()', () => {
      // Arrange
      const input = mockRef()
      const filter = Iterator.Filter(mockPredicate())
      const map = Iterator.Map({})
      const original = IterableBuilder.create(input, filter)

      // Act
      original.each(map)

      // Assert
      expect(original.expr.iterator.type).toBe(IteratorType.FILTER)
    })

    it('should not mutate original builder when calling pipe()', () => {
      // Arrange
      const input = mockRef()
      const iterator = Iterator.Map({})
      const original = IterableBuilder.create(input, iterator)
      const transformer = mockTransformer('slice')

      // Act
      original.pipe(transformer)

      // Assert
      expect(original.expr.type).toBe(ExpressionType.ITERATE)
    })

    it('should not mutate original builder when calling not', () => {
      // Arrange
      const input = mockRef()
      const iterator = Iterator.Map({})
      const original = IterableBuilder.create(input, iterator)
      const condition = mockCondition('isNotEmpty')

      // Act
      const negated = original.not
      const originalResult = original.match(condition)
      const negatedResult = negated.match(condition)

      // Assert
      expect(originalResult.negate).toBe(false)
      expect(negatedResult.negate).toBe(true)
    })
  })

  describe('path()', () => {
    it('should create ReferenceExpr with iterate expression as base', () => {
      // Arrange
      const input = mockRef()
      const iterator = Iterator.Find(mockPredicate())

      // Act
      const result = IterableBuilder.create(input, iterator).path('goals')

      // Assert
      const refExpr = result.expr as ReferenceExpr
      expect(refExpr.type).toBe(ExpressionType.REFERENCE)
      expect(refExpr.path).toEqual(['goals'])
      expect(refExpr.base).toBeDefined()
      expect((refExpr.base as IterateExpr).type).toBe(ExpressionType.ITERATE)
    })

    it('should split dot-notation path into segments', () => {
      // Arrange
      const input = mockRef()
      const iterator = Iterator.Find(mockPredicate())

      // Act
      const result = IterableBuilder.create(input, iterator).path('profile.settings.theme')

      // Assert
      const refExpr = result.expr as ReferenceExpr
      expect(refExpr.path).toEqual(['profile', 'settings', 'theme'])
    })

    it('should preserve the iterate expression in base', () => {
      // Arrange - simulates: Data('areas').each(Iterator.Find(...)).path('goals')
      const dataRef: ReferenceExpr = { type: ExpressionType.REFERENCE, path: ['data', 'areas'] }
      const findIterator = Iterator.Find(mockPredicate())

      // Act
      const result = IterableBuilder.create(dataRef, findIterator).path('goals')

      // Assert
      const refExpr = result.expr as ReferenceExpr
      const baseExpr = refExpr.base as IterateExpr
      expect(baseExpr.type).toBe(ExpressionType.ITERATE)
      expect(baseExpr.iterator.type).toBe(IteratorType.FIND)
      expect(baseExpr.input).toEqual(dataRef)
    })

    it('should return ExpressionBuilder allowing further chaining with pipe()', () => {
      // Arrange
      const input = mockRef()
      const iterator = Iterator.Find(mockPredicate())
      const transformer = mockTransformer('toUpperCase')

      // Act
      const result = IterableBuilder.create(input, iterator).path('name').pipe(transformer)

      // Assert
      const pipelineExpr = result.expr as PipelineExpr
      expect(pipelineExpr.type).toBe(ExpressionType.PIPELINE)
      expect(pipelineExpr.steps).toEqual([transformer])
      // Input to pipeline should be the reference with base
      const inputRef = pipelineExpr.input as ReferenceExpr
      expect(inputRef.type).toBe(ExpressionType.REFERENCE)
      expect(inputRef.base).toBeDefined()
    })

    it('should return ExpressionBuilder allowing further chaining with match()', () => {
      // Arrange
      const input = mockRef()
      const iterator = Iterator.Find(mockPredicate())
      const condition = mockCondition('isNotEmpty')

      // Act
      const result = IterableBuilder.create(input, iterator).path('goals').match(condition)

      // Assert
      expect(result.type).toBe(LogicType.TEST)
      expect(result.negate).toBe(false)
      expect(result.condition).toEqual(condition)
      // Subject should be the reference with base
      const subject = result.subject as ReferenceExpr
      expect(subject.type).toBe(ExpressionType.REFERENCE)
      expect(subject.base).toBeDefined()
    })

    it('should work after chained each() calls', () => {
      // Arrange - simulates: Data('items').each(Iterator.Filter(...)).each(Iterator.Find(...)).path('value')
      const input = mockRef()
      const filter = Iterator.Filter(mockPredicate())
      const find = Iterator.Find(mockPredicate())

      // Act
      // Note: .each(Find) now returns ExpressionBuilder (not IterableBuilder)
      // so the structure is: Reference(path: ['value'], base: Reference(path: [], base: Iterate(Find)))
      const result = IterableBuilder.create(input, filter).each(find).path('value')

      // Assert
      const refExpr = result.expr as ReferenceExpr
      expect(refExpr.type).toBe(ExpressionType.REFERENCE)
      expect(refExpr.path).toEqual(['value'])

      // Base is the reference wrapper from .each(Find)
      const wrapperRef = refExpr.base as ReferenceExpr
      expect(wrapperRef.type).toBe(ExpressionType.REFERENCE)
      expect(wrapperRef.path).toEqual([])

      // Which wraps the Find iterate
      const findExpr = wrapperRef.base as IterateExpr
      expect(findExpr.iterator.type).toBe(IteratorType.FIND)

      // Which has the filter as its input
      const filterExpr = findExpr.input as IterateExpr
      expect(filterExpr.iterator.type).toBe(IteratorType.FILTER)
    })

    it('should not mutate original builder', () => {
      // Arrange
      const input = mockRef()
      const iterator = Iterator.Find(mockPredicate())
      const original = IterableBuilder.create(input, iterator)

      // Act
      original.path('goals')

      // Assert
      expect(original.expr.type).toBe(ExpressionType.ITERATE)
    })
  })

  describe('integration with ReferenceBuilder pattern', () => {
    it('should work with typical Data().each() pattern', () => {
      // This simulates: Data('items').each(Iterator.Filter(...)).each(Iterator.Map(...))

      // Arrange
      const dataRef: ReferenceExpr = { type: ExpressionType.REFERENCE, path: ['data', 'items'] }
      const filter = Iterator.Filter(mockPredicate())
      const map = Iterator.Map({
        label: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
      })

      // Act
      const result = IterableBuilder.create(dataRef, filter).each(map).build()

      // Assert
      expect(result.type).toBe(ExpressionType.ITERATE)
      expect(result.iterator.type).toBe(IteratorType.MAP)

      const filterStep = result.input as IterateExpr
      expect(filterStep.type).toBe(ExpressionType.ITERATE)
      expect(filterStep.iterator.type).toBe(IteratorType.FILTER)

      expect(filterStep.input).toEqual(dataRef)
    })
  })
})
