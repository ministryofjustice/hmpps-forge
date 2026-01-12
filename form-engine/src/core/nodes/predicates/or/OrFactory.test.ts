import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType, PredicateType } from '@form-engine/form/types/enums'
import type { PredicateOrExpr, PredicateTestExpr, ValueExpr } from '@form-engine/form/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import { PredicateASTNode } from '@form-engine/core/types/predicates.type'
import OrFactory from './OrFactory'

describe('OrFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let orFactory: OrFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    orFactory = new OrFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create an Or predicate with multiple operands', () => {
      // Arrange
      const json = {
        type: PredicateType.OR,
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
      } satisfies PredicateOrExpr

      // Act
      const result = orFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.PREDICATE)
      expect(result.predicateType).toBe(PredicateType.OR)
      expect(result.raw).toBe(json)
      expect(Array.isArray(result.properties.operands)).toBe(true)
      expect(result.properties.operands).toHaveLength(2)
    })

    it('should transform each operand using nodeFactory', () => {
      // Arrange
      const json = {
        type: PredicateType.OR,
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
      } satisfies PredicateOrExpr

      // Act
      const result = orFactory.create(json)

      // Assert
      result.properties.operands.forEach((operand: PredicateASTNode) => {
        expect(operand.type).toBe(ASTNodeType.PREDICATE)
        expect(operand.predicateType).toBe(PredicateType.TEST)
      })
    })

    it('should throw InvalidNodeError when operands is missing', () => {
      // Arrange
      const json = {
        type: PredicateType.OR,
      } as any

      // Act & Assert
      expect(() => orFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => orFactory.create(json)).toThrow('Or predicate requires a non-empty operands array')
    })

    it('should throw InvalidNodeError when operands is empty', () => {
      // Arrange
      const json = {
        type: PredicateType.OR,
        operands: [],
      } as any

      // Act & Assert
      expect(() => orFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => orFactory.create(json)).toThrow('Or predicate requires a non-empty operands array')
    })
  })
})
