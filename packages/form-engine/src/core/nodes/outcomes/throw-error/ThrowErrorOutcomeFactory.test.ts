import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType, OutcomeType, PredicateType } from '@form-engine/form/types/enums'
import type {
  ConditionFunctionExpr,
  FormatExpr,
  PredicateTestExpr,
  ReferenceExpr,
  ThrowErrorOutcome,
  ValueExpr,
} from '@form-engine/form/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { ExpressionASTNode } from '@form-engine/core/types/expressions.type'
import { PredicateASTNode } from '@form-engine/core/types/predicates.type'
import ThrowErrorOutcomeFactory from './ThrowErrorOutcomeFactory'

describe('ThrowErrorOutcomeFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let throwErrorOutcomeFactory: ThrowErrorOutcomeFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    throwErrorOutcomeFactory = new ThrowErrorOutcomeFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create a ThrowError outcome with string message', () => {
      // Arrange
      const json = {
        type: OutcomeType.THROW_ERROR,
        status: 404,
        message: 'Item not found',
      } satisfies ThrowErrorOutcome

      // Act
      const result = throwErrorOutcomeFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.OUTCOME)
      expect(result.outcomeType).toBe(OutcomeType.THROW_ERROR)
      expect(result.raw).toBe(json)

      expect(result.properties.status).toBe(404)
      expect(result.properties.message).toBe('Item not found')
      expect(result.properties.when).toBeUndefined()
    })

    it('should create a ThrowError outcome with dynamic message', () => {
      // Arrange
      const json = {
        type: OutcomeType.THROW_ERROR,
        status: 500,
        message: {
          type: ExpressionType.FORMAT,
          template: 'Failed to save: %1',
          arguments: [{ type: ExpressionType.REFERENCE, path: ['data', 'errorMessage'] } satisfies ReferenceExpr],
        } satisfies FormatExpr,
      } satisfies ThrowErrorOutcome

      // Act
      const result = throwErrorOutcomeFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.OUTCOME)
      expect(result.outcomeType).toBe(OutcomeType.THROW_ERROR)

      expect(result.properties.status).toBe(500)
      expect(result.properties.message).toHaveProperty('id')
      expect((result.properties.message as ASTNode).type).toBe(ASTNodeType.EXPRESSION)
      expect((result.properties.message as ExpressionASTNode).expressionType).toBe(ExpressionType.FORMAT)
    })

    it('should create a ThrowError outcome with when condition', () => {
      // Arrange
      const json = {
        type: OutcomeType.THROW_ERROR,
        status: 403,
        message: 'Access denied',
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['data', 'noPermission'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ValueExpr[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies ThrowErrorOutcome

      // Act
      const result = throwErrorOutcomeFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.properties.status).toBe(403)
      expect(result.properties.message).toBe('Access denied')
      expect(result.properties.when).toBeDefined()
      expect(result.properties.when!.type).toBe(ASTNodeType.PREDICATE)
      expect((result.properties.when! as PredicateASTNode).predicateType).toBe(PredicateType.TEST)
    })

    it('should create a ThrowError outcome with dynamic message and when condition', () => {
      // Arrange
      const json = {
        type: OutcomeType.THROW_ERROR,
        status: 409,
        message: { type: ExpressionType.REFERENCE, path: ['data', 'conflictMessage'] } satisfies ReferenceExpr,
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['data', 'hasConflict'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ValueExpr[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies ThrowErrorOutcome

      // Act
      const result = throwErrorOutcomeFactory.create(json)

      // Assert
      expect(result.properties.status).toBe(409)
      expect(result.properties.message).toHaveProperty('id')
      expect((result.properties.message as ASTNode).type).toBe(ASTNodeType.EXPRESSION)
      expect(result.properties.when).toBeDefined()
      expect(result.properties.when!.type).toBe(ASTNodeType.PREDICATE)
    })

    it('should generate unique node IDs', () => {
      // Arrange
      const json = {
        type: OutcomeType.THROW_ERROR,
        status: 500,
        message: 'Internal error',
      } satisfies ThrowErrorOutcome

      // Act
      const result1 = throwErrorOutcomeFactory.create(json)
      const result2 = throwErrorOutcomeFactory.create(json)

      // Assert
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })
  })
})
