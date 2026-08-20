import { ASTNodeType } from '../../../contracts/ast/enums'
import { ExpressionType, FunctionType, OutcomeType, PredicateType } from '../../../../../authoring/types/enums'
import type {
  ConditionFunctionExpr,
  PredicateTestExpr,
  RedirectOutcome,
  ReferenceExpr,
  ResolvableValue,
  GeneratorFunctionExpr,
  ThrowErrorOutcome,
} from '../../../../../authoring/types/expressions.type'
import { NodeIDGenerator } from '../ast-state/NodeIDGenerator'
import { NodeFactory } from './NodeFactory'
import { ASTNode } from '../../../contracts/ast/engine.type'
import { ExpressionASTNode, FunctionASTNode } from '../../../contracts/ast/expressions.type'
import { PredicateASTNode } from '../../../contracts/ast/predicates.type'
import { FORMAT_STRING_GENERATOR_NAME } from '../../../../../built-ins/functions/generators/formatGenerators'
import { createRedirectOutcomeNode, createThrowErrorOutcomeNode } from './outcomes'

describe('outcomes', () => {
  describe('createRedirectOutcomeNode()', () => {
    let nodeIDGenerator: NodeIDGenerator
    let nodeFactory: NodeFactory

    beforeEach(() => {
      nodeIDGenerator = new NodeIDGenerator()
      nodeFactory = new NodeFactory(nodeIDGenerator)
    })

    it('should create a Redirect outcome with goto as string', () => {
      // Arrange
      const json = {
        type: OutcomeType.REDIRECT,
        goto: '/next-step',
      } satisfies RedirectOutcome

      // Act
      const result = createRedirectOutcomeNode(json, nodeFactory.context)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.OUTCOME)
      expect(result.outcomeType).toBe(OutcomeType.REDIRECT)

      expect(result.properties.goto).toBe('/next-step')
      expect(result.properties.when).toBeUndefined()
    })

    it('should create a Redirect outcome with goto as expression', () => {
      // Arrange
      const json = {
        type: OutcomeType.REDIRECT,
        goto: { type: ExpressionType.REFERENCE, path: ['data', 'nextStep'] } satisfies ReferenceExpr,
      } satisfies RedirectOutcome

      // Act
      const result = createRedirectOutcomeNode(json, nodeFactory.context)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.OUTCOME)
      expect(result.outcomeType).toBe(OutcomeType.REDIRECT)

      expect(result.properties.goto).toHaveProperty('id')
      expect((result.properties.goto as ASTNode).type).toBe(ASTNodeType.EXPRESSION)
      expect((result.properties.goto as ExpressionASTNode).expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should create a Redirect outcome with when condition', () => {
      // Arrange
      const json = {
        type: OutcomeType.REDIRECT,
        goto: '/conditional-step',
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['data', 'shouldRedirect'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies RedirectOutcome

      // Act
      const result = createRedirectOutcomeNode(json, nodeFactory.context)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.properties.goto).toBe('/conditional-step')
      expect(result.properties.when).toBeDefined()
      expect(result.properties.when!.type).toBe(ASTNodeType.PREDICATE)
      expect((result.properties.when! as PredicateASTNode).predicateType).toBe(PredicateType.TEST)
    })

    it('should create a Redirect outcome with both dynamic goto and when condition', () => {
      // Arrange
      const json = {
        type: OutcomeType.REDIRECT,
        goto: { type: ExpressionType.REFERENCE, path: ['data', 'dynamicStep'] } satisfies ReferenceExpr,
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['data', 'condition'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsNotEmpty',
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies RedirectOutcome

      // Act
      const result = createRedirectOutcomeNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.goto).toHaveProperty('id')
      expect((result.properties.goto as ASTNode).type).toBe(ASTNodeType.EXPRESSION)
      expect(result.properties.when).toBeDefined()
      expect(result.properties.when!.type).toBe(ASTNodeType.PREDICATE)
    })

    it('should generate unique node IDs', () => {
      // Arrange
      const json = {
        type: OutcomeType.REDIRECT,
        goto: '/step-1',
      } satisfies RedirectOutcome

      // Act
      const result1 = createRedirectOutcomeNode(json, nodeFactory.context)
      const result2 = createRedirectOutcomeNode(json, nodeFactory.context)

      // Assert
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })
  })

  describe('createThrowErrorOutcomeNode()', () => {
    let nodeIDGenerator: NodeIDGenerator
    let nodeFactory: NodeFactory

    beforeEach(() => {
      nodeIDGenerator = new NodeIDGenerator()
      nodeFactory = new NodeFactory(nodeIDGenerator)
    })

    it('should create a ThrowError outcome with string message', () => {
      // Arrange
      const json = {
        type: OutcomeType.THROW_ERROR,
        status: 404,
        message: 'Item not found',
      } satisfies ThrowErrorOutcome

      // Act
      const result = createThrowErrorOutcomeNode(json, nodeFactory.context)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.OUTCOME)
      expect(result.outcomeType).toBe(OutcomeType.THROW_ERROR)

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
          type: FunctionType.GENERATOR,
          name: FORMAT_STRING_GENERATOR_NAME,
          arguments: [
            'Failed to save: %1',
            { type: ExpressionType.REFERENCE, path: ['data', 'errorMessage'] } satisfies ReferenceExpr,
          ],
        } satisfies GeneratorFunctionExpr,
      } satisfies ThrowErrorOutcome

      // Act
      const result = createThrowErrorOutcomeNode(json, nodeFactory.context)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.OUTCOME)
      expect(result.outcomeType).toBe(OutcomeType.THROW_ERROR)

      expect(result.properties.status).toBe(500)
      expect(result.properties.message).toHaveProperty('id')
      expect((result.properties.message as ASTNode).type).toBe(ASTNodeType.EXPRESSION)
      expect((result.properties.message as ExpressionASTNode).expressionType).toBe(FunctionType.GENERATOR)
      expect((result.properties.message as FunctionASTNode).properties.name).toBe(FORMAT_STRING_GENERATOR_NAME)
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
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies ThrowErrorOutcome

      // Act
      const result = createThrowErrorOutcomeNode(json, nodeFactory.context)

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
            arguments: [] as ResolvableValue[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies ThrowErrorOutcome

      // Act
      const result = createThrowErrorOutcomeNode(json, nodeFactory.context)

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
      const result1 = createThrowErrorOutcomeNode(json, nodeFactory.context)
      const result2 = createThrowErrorOutcomeNode(json, nodeFactory.context)

      // Assert
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })
  })
})
