import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType, PredicateType } from '@form-engine/form/types/enums'
import type {
  PredicateAndExpr,
  PredicateNotExpr,
  PredicateOrExpr,
  PredicateTestExpr,
  ValueExpr,
} from '@form-engine/form/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import { PredicateASTNode } from '@form-engine/core/types/predicates.type'
import AndFactory from './AndFactory'

describe('AndFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let andFactory: AndFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    andFactory = new AndFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create an And predicate with multiple operands', () => {
      // Arrange
      const json = {
        type: PredicateType.AND,
        operands: [
          {
            type: PredicateType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
          {
            type: PredicateType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field2'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
        ],
      } satisfies PredicateAndExpr

      // Act
      const result = andFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.PREDICATE)
      expect(result.predicateType).toBe(PredicateType.AND)
      expect(result.raw).toBe(json)
      expect(Array.isArray(result.properties.operands)).toBe(true)
      expect(result.properties.operands).toHaveLength(2)
    })

    it('should transform each operand using nodeFactory', () => {
      // Arrange
      const json = {
        type: PredicateType.AND,
        operands: [
          {
            type: PredicateType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
          {
            type: PredicateType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field2'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
        ],
      } satisfies PredicateAndExpr

      // Act
      const result = andFactory.create(json)

      // Assert
      result.properties.operands.forEach((operand: PredicateASTNode) => {
        expect(operand.type).toBe(ASTNodeType.PREDICATE)
        expect(operand.predicateType).toBe(PredicateType.TEST)
      })
    })

    it('should handle nested And predicates', () => {
      // Arrange
      const json = {
        type: PredicateType.AND,
        operands: [
          {
            type: PredicateType.AND,
            operands: [
              {
                type: PredicateType.TEST,
                subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field1'] },
                negate: false,
                condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
              } satisfies PredicateTestExpr,
              {
                type: PredicateType.TEST,
                subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field1'] },
                negate: false,
                condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
              } satisfies PredicateTestExpr,
            ],
          } satisfies PredicateAndExpr,
          {
            type: PredicateType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field2'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
        ],
      } satisfies PredicateAndExpr

      // Act
      const result = andFactory.create(json)

      // Assert
      expect((result.properties.operands[0] as PredicateASTNode).predicateType).toBe(PredicateType.AND)
      expect((result.properties.operands[1] as PredicateASTNode).predicateType).toBe(PredicateType.TEST)
    })

    it('should handle mixed operand types', () => {
      // Arrange
      const json = {
        type: PredicateType.AND,
        operands: [
          {
            type: PredicateType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
          {
            type: PredicateType.NOT,
            operand: {
              type: PredicateType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field2'] },
              negate: false,
              condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
            } satisfies PredicateTestExpr,
          } satisfies PredicateNotExpr,
          {
            type: PredicateType.OR,
            operands: [
              {
                type: PredicateType.TEST,
                subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field3'] },
                negate: false,
                condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
              } satisfies PredicateTestExpr,
              {
                type: PredicateType.TEST,
                subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field3'] },
                negate: false,
                condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
              } satisfies PredicateTestExpr,
            ],
          } satisfies PredicateOrExpr,
        ],
      } satisfies PredicateAndExpr

      // Act
      const result = andFactory.create(json)

      // Assert
      expect(result.properties.operands).toHaveLength(3)
      expect((result.properties.operands[0] as PredicateASTNode).predicateType).toBe(PredicateType.TEST)
      expect((result.properties.operands[1] as PredicateASTNode).predicateType).toBe(PredicateType.NOT)
      expect((result.properties.operands[2] as PredicateASTNode).predicateType).toBe(PredicateType.OR)
    })

    it('should throw InvalidNodeError when operands is missing', () => {
      // Arrange
      const json = {
        type: PredicateType.AND,
      } as any

      // Act & Assert
      expect(() => andFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => andFactory.create(json)).toThrow('And predicate requires a non-empty operands array')
    })

    it('should throw InvalidNodeError when operands is empty', () => {
      // Arrange
      const json = {
        type: PredicateType.AND,
        operands: [],
      } as any

      // Act & Assert
      expect(() => andFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => andFactory.create(json)).toThrow('And predicate requires a non-empty operands array')
    })
  })
})
