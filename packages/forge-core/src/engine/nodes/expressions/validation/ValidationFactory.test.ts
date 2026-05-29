import { ASTNodeType } from '../../../types/enums'
import { ExpressionType, FunctionType, PredicateType } from '../../../../authoring/types/enums'
import type {
  ConditionFunctionExpr,
  PredicateTestExpr,
  ReferenceExpr,
  ResolvableValue,
} from '../../../../authoring/types/expressions.type'
import type { ValidationExpr } from '../../../../authoring/types/structures.type'
import { NodeIDCategory, NodeIDGenerator } from '../../../compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '../../NodeFactory'
import ValidationFactory from './ValidationFactory'

describe('ValidationFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let validationFactory: ValidationFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    validationFactory = new ValidationFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create a Validation expression with message', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Field is required',
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        } satisfies PredicateTestExpr,
      } satisfies ValidationExpr

      // Act
      const result = validationFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.VALIDATION)
      expect(result.raw).toBe(json)

      expect(result.properties.message !== undefined).toBe(true)
      expect(result.properties.message).toBe('Field is required')
    })

    it('should create a Validation expression with condition predicate', () => {
      // Arrange
      const conditionPredicate = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] } satisfies ReferenceExpr,
        negate: false,
        condition: {
          type: FunctionType.CONDITION,
          name: 'IsNotEmpty',
          arguments: [] as ResolvableValue[],
        } satisfies ConditionFunctionExpr,
      } satisfies PredicateTestExpr

      const json = {
        type: ExpressionType.VALIDATION,
        condition: conditionPredicate,
        message: 'Invalid value',
      } satisfies ValidationExpr

      // Act
      const result = validationFactory.create(json)
      const condition = result.properties.condition

      // Assert
      expect(result.id).toBeDefined()
      expect(condition.type).toBe(ASTNodeType.PREDICATE)
      expect(result.properties.condition !== undefined).toBe(true)
    })

    it('should set submissionOnly flag when provided', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
        submissionOnly: true,
      } satisfies ValidationExpr

      // Act
      const result = validationFactory.create(json)

      // Assert
      expect(result.properties.submissionOnly !== undefined).toBe(true)
      expect(result.properties.submissionOnly).toBe(true)
    })

    it('should set submissionOnly to false when explicitly false', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
        submissionOnly: false,
      } satisfies ValidationExpr

      // Act
      const result = validationFactory.create(json)

      // Assert
      expect(result.properties.submissionOnly !== undefined).toBe(true)
      expect(result.properties.submissionOnly).toBe(false)
    })

    it('should default submissionOnly to false when undefined', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies ValidationExpr

      // Act
      const result = validationFactory.create(json)

      // Assert
      expect(result.properties.submissionOnly).toBe(false)
    })

    it('should default groups to default when omitted', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies ValidationExpr

      // Act
      const result = validationFactory.create(json)

      // Assert
      expect(result.properties.groups).toEqual(['default'])
    })

    it('should set groups when provided', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
        groups: ['lookup', 'default'],
      } satisfies ValidationExpr

      // Act
      const result = validationFactory.create(json)

      // Assert
      expect(result.properties.groups).toEqual(['lookup', 'default'])
    })

    it('should set details when provided', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
        details: { code: 'VALIDATION_001', severity: 'error' },
      } satisfies ValidationExpr

      // Act
      const result = validationFactory.create(json)

      // Assert
      expect(result.properties.details !== undefined).toBe(true)
      expect(result.properties.details).toEqual({
        code: 'VALIDATION_001',
        severity: 'error',
      })
    })

    it('should not set details when not provided', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies ValidationExpr

      // Act
      const result = validationFactory.create(json)

      // Assert
      expect(result.properties.details !== undefined).toBe(false)
    })

    it('should default message to empty string when not provided', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: '',
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies ValidationExpr

      // Act
      const result = validationFactory.create(json)

      // Assert
      expect(result.properties.message).toBe('')
    })

    it('should create a Validation expression with all properties', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsNotEmpty',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
        message: 'Custom error message',
        submissionOnly: true,
        details: { code: 'ERR_001' },
      } satisfies ValidationExpr

      // Act
      const result = validationFactory.create(json)

      // Assert
      expect(result.properties.condition !== undefined).toBe(true)
      expect(result.properties.message !== undefined).toBe(true)
      expect(result.properties.submissionOnly !== undefined).toBe(true)
      expect(result.properties.details !== undefined).toBe(true)

      expect(result.properties.message).toBe('Custom error message')
      expect(result.properties.submissionOnly).toBe(true)
      expect(result.properties.details).toEqual({ code: 'ERR_001' })
    })
  })
})
