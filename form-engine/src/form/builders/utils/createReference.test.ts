import { ExpressionType, FunctionType, LogicType } from '../../types/enums'
import { ConditionFunctionExpr, ReferenceExpr, TransformerFunctionExpr } from '../../types/expressions.type'
import { createReference, BuildableReference } from './createReference'

describe('createReference', () => {
  const baseRef: ReferenceExpr = {
    type: ExpressionType.REFERENCE,
    path: ['answers', 'email'],
  }

  describe('pipe()', () => {
    it('should create a pipeline expression with no steps', () => {
      // Arrange
      const ref = createReference<BuildableReference>(baseRef)

      // Act
      const result = ref.pipe()

      // Assert
      expect(result).toEqual({
        type: ExpressionType.PIPELINE,
        input: baseRef,
        steps: [],
      })
    })

    it('should create a pipeline expression with single transformer step', () => {
      // Arrange
      const ref = createReference<BuildableReference>(baseRef)
      const trimTransformer: TransformerFunctionExpr = {
        type: FunctionType.TRANSFORMER,
        name: 'Trim',
        arguments: [],
      }

      // Act
      const result = ref.pipe(trimTransformer)

      // Assert
      expect(result).toEqual({
        type: ExpressionType.PIPELINE,
        input: baseRef,
        steps: [trimTransformer],
      })
    })

    it('should create a pipeline expression with multiple transformer steps', () => {
      // Arrange
      const ref = createReference<BuildableReference>(baseRef)
      const trimTransformer: TransformerFunctionExpr = {
        type: FunctionType.TRANSFORMER,
        name: 'Trim',
        arguments: [],
      }
      const toLowerCaseTransformer: TransformerFunctionExpr = {
        type: FunctionType.TRANSFORMER,
        name: 'ToLowerCase',
        arguments: [],
      }
      const substringTransformer: TransformerFunctionExpr = {
        type: FunctionType.TRANSFORMER,
        name: 'Substring',
        arguments: [0, 10],
      }

      // Act
      const result = ref.pipe(trimTransformer, toLowerCaseTransformer, substringTransformer)

      // Assert
      expect(result).toEqual({
        type: ExpressionType.PIPELINE,
        input: baseRef,
        steps: [trimTransformer, toLowerCaseTransformer, substringTransformer],
      })
    })

    it('should preserve the original reference as input', () => {
      // Arrange
      const dataRef: ReferenceExpr = {
        type: ExpressionType.REFERENCE,
        path: ['data', 'user', 'name'],
      }
      const ref = createReference<BuildableReference>(dataRef)
      const transformer: TransformerFunctionExpr = {
        type: FunctionType.TRANSFORMER,
        name: 'ToUpperCase',
        arguments: [],
      }

      // Act
      const result = ref.pipe(transformer)

      // Assert
      expect(result.input).toEqual(dataRef)
    })
  })

  describe('match()', () => {
    it('should create a predicate test expression', () => {
      // Arrange
      const ref = createReference<BuildableReference>(baseRef)
      const condition: ConditionFunctionExpr = {
        type: FunctionType.CONDITION,
        name: 'IsRequired',
        arguments: [],
      }

      // Act
      const result = ref.match(condition)

      // Assert
      expect(result).toEqual({
        type: LogicType.TEST,
        subject: baseRef,
        negate: false,
        condition,
      })
    })

    it('should create a negated predicate test expression with not.match()', () => {
      // Arrange
      const ref = createReference<BuildableReference>(baseRef)
      const condition: ConditionFunctionExpr = {
        type: FunctionType.CONDITION,
        name: 'IsRequired',
        arguments: [],
      }

      // Act
      const result = ref.not.match(condition)

      // Assert
      expect(result).toEqual({
        type: LogicType.TEST,
        subject: baseRef,
        negate: true,
        condition,
      })
    })
  })

  describe('proxy behavior', () => {
    it('should pass through original reference properties', () => {
      // Arrange
      const ref = createReference<BuildableReference>(baseRef)

      // Assert
      expect(ref.type).toBe(ExpressionType.REFERENCE)
      expect(ref.path).toEqual(['answers', 'email'])
    })

    it('should report pipe, not, and match as available properties', () => {
      // Arrange
      const ref = createReference<BuildableReference>(baseRef)

      // Assert
      expect('pipe' in ref).toBe(true)
      expect('not' in ref).toBe(true)
      expect('match' in ref).toBe(true)
    })
  })
})
