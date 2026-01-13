import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType, PredicateType } from '@form-engine/form/types/enums'
import type {
  ConditionFunctionExpr,
  NextExpr,
  PredicateTestExpr,
  ReferenceExpr,
  ValueExpr,
} from '@form-engine/form/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { ExpressionASTNode } from '@form-engine/core/types/expressions.type'
import { PredicateASTNode } from '@form-engine/core/types/predicates.type'
import NextFactory from './NextFactory'

describe('NextFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let nextFactory: NextFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    nextFactory = new NextFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create a Next expression with goto as string', () => {
      // Arrange
      const json = {
        type: ExpressionType.NEXT,
        goto: 'step-2',
      } satisfies NextExpr

      // Act
      const result = nextFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.NEXT)
      expect(result.raw).toBe(json)

      expect(result.properties.goto).toBe('step-2')
      expect(result.properties.when).toBeUndefined()
    })

    it('should create a Next expression with goto as expression', () => {
      // Arrange
      const json = {
        type: ExpressionType.NEXT,
        goto: { type: ExpressionType.REFERENCE, path: ['answers', 'nextStep'] } satisfies ReferenceExpr,
      } satisfies NextExpr

      // Act
      const result = nextFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.NEXT)

      expect(result.properties.goto).toHaveProperty('id')
      expect((result.properties.goto as ASTNode).type).toBe(ASTNodeType.EXPRESSION)
      expect((result.properties.goto as ExpressionASTNode).expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should create a Next expression with when condition', () => {
      // Arrange
      const json = {
        type: ExpressionType.NEXT,
        goto: 'step-3',
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ValueExpr[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies NextExpr

      // Act
      const result = nextFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.properties.goto).toBe('step-3')
      expect(result.properties.when).toBeDefined()
      expect(result.properties.when!.type).toBe(ASTNodeType.PREDICATE)
      expect((result.properties.when! as PredicateASTNode).predicateType).toBe(PredicateType.TEST)
    })

    it('should create a Next expression with both dynamic goto and when condition', () => {
      // Arrange
      const json = {
        type: ExpressionType.NEXT,
        goto: { type: ExpressionType.REFERENCE, path: ['data', 'dynamicStep'] } satisfies ReferenceExpr,
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'condition'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsNotEmpty',
            arguments: [] as ValueExpr[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr,
      } satisfies NextExpr

      // Act
      const result = nextFactory.create(json)

      // Assert
      expect(result.properties.goto).toHaveProperty('id')
      expect((result.properties.goto as ASTNode).type).toBe(ASTNodeType.EXPRESSION)
      expect(result.properties.when).toBeDefined()
      expect(result.properties.when!.type).toBe(ASTNodeType.PREDICATE)
    })

    it('should generate unique node IDs', () => {
      // Arrange
      const json = {
        type: ExpressionType.NEXT,
        goto: 'step-1',
      } satisfies NextExpr

      // Act
      const result1 = nextFactory.create(json)
      const result2 = nextFactory.create(json)

      // Assert
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })
  })
})
