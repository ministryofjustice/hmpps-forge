import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType, OutcomeType, PredicateType } from '@form-engine/form/types/enums'
import type {
  ConditionFunctionExpr,
  PredicateTestExpr,
  RedirectOutcome,
  ReferenceExpr,
  ValueExpr,
} from '@form-engine/form/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { ExpressionASTNode } from '@form-engine/core/types/expressions.type'
import { PredicateASTNode } from '@form-engine/core/types/predicates.type'
import RedirectOutcomeFactory from './RedirectOutcomeFactory'

describe('RedirectOutcomeFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let redirectOutcomeFactory: RedirectOutcomeFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    redirectOutcomeFactory = new RedirectOutcomeFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create a Redirect outcome with goto as string', () => {
      // Arrange
      const json = {
        type: OutcomeType.REDIRECT,
        goto: '/next-step',
      } satisfies RedirectOutcome

      // Act
      const result = redirectOutcomeFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.OUTCOME)
      expect(result.outcomeType).toBe(OutcomeType.REDIRECT)
      expect(result.raw).toBe(json)

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
      const result = redirectOutcomeFactory.create(json)

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
            arguments: [] as ValueExpr[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies RedirectOutcome

      // Act
      const result = redirectOutcomeFactory.create(json)

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
            arguments: [] as ValueExpr[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies RedirectOutcome

      // Act
      const result = redirectOutcomeFactory.create(json)

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
      const result1 = redirectOutcomeFactory.create(json)
      const result2 = redirectOutcomeFactory.create(json)

      // Assert
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })
  })
})
