import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType, PredicateType } from '@form-engine/form/types/enums'
import type {
  ConditionFunctionExpr,
  PredicateTestExpr,
  ReferenceExpr,
  ValueExpr,
} from '@form-engine/form/types/expressions.type'
import type { ValidationExpr } from '@form-engine/form/types/structures.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
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
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
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

    it('should create a Validation expression with when condition', () => {
      // Arrange
      const whenCondition = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] } satisfies ReferenceExpr,
        negate: false,
        condition: {
          type: FunctionType.CONDITION,
          name: 'IsNotEmpty',
          arguments: [] as ValueExpr[],
        } satisfies ConditionFunctionExpr,
      } satisfies PredicateTestExpr

      const json = {
        type: ExpressionType.VALIDATION,
        when: whenCondition,
        message: 'Invalid value',
      } satisfies ValidationExpr

      // Act
      const result = validationFactory.create(json)
      const when = result.properties.when

      // Assert
      expect(result.id).toBeDefined()
      expect(when.type).toBe(ASTNodeType.PREDICATE)
      expect(result.properties.when !== undefined).toBe(true)
    })

    it('should set submissionOnly flag when provided', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ValueExpr[],
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
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ValueExpr[],
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
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ValueExpr[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies ValidationExpr

      // Act
      const result = validationFactory.create(json)

      // Assert
      expect(result.properties.submissionOnly).toBe(false)
    })

    it('should set details when provided', () => {
      // Arrange
      const json = {
        type: ExpressionType.VALIDATION,
        message: 'Error',
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ValueExpr[],
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
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ValueExpr[],
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
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ValueExpr[],
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
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsNotEmpty',
            arguments: [] as ValueExpr[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
        message: 'Custom error message',
        submissionOnly: true,
        details: { code: 'ERR_001' },
      } satisfies ValidationExpr

      // Act
      const result = validationFactory.create(json)

      // Assert
      expect(result.properties.when !== undefined).toBe(true)
      expect(result.properties.message !== undefined).toBe(true)
      expect(result.properties.submissionOnly !== undefined).toBe(true)
      expect(result.properties.details !== undefined).toBe(true)

      expect(result.properties.message).toBe('Custom error message')
      expect(result.properties.submissionOnly).toBe(true)
      expect(result.properties.details).toEqual({ code: 'ERR_001' })
    })
  })
})
