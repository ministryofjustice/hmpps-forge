import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { ExpressionType, FunctionType, PredicateType } from '../../../../../../authoring/types/enums'
import type {
  PredicateTestExpr,
  PredicateXorExpr,
  ResolvableValue,
} from '../../../../../../authoring/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
import InvalidNodeError from '../../../../../errors/InvalidNodeError'
import { NodeFactory } from '../../NodeFactory'
import { PredicateASTNode } from '../../../../../contracts/ast/predicates.type'
import XorFactory from './XorFactory'

describe('XorFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let xorFactory: XorFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    xorFactory = new XorFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create a Xor predicate with multiple operands', () => {
      // Arrange
      const json = {
        type: PredicateType.XOR,
        operands: [
          {
            type: PredicateType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
          } satisfies PredicateTestExpr,
          {
            type: PredicateType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field2'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
          } satisfies PredicateTestExpr,
        ],
      } satisfies PredicateXorExpr

      // Act
      const result = xorFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.PREDICATE)
      expect(result.predicateType).toBe(PredicateType.XOR)
      expect(result).not.toHaveProperty('raw')
      expect(Array.isArray(result.properties.operands)).toBe(true)
      expect(result.properties.operands).toHaveLength(2)
    })

    it('should transform each operand using nodeFactory', () => {
      // Arrange
      const json = {
        type: PredicateType.XOR,
        operands: [
          {
            type: PredicateType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
          } satisfies PredicateTestExpr,
          {
            type: PredicateType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field2'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
          } satisfies PredicateTestExpr,
        ],
      } satisfies PredicateXorExpr

      // Act
      const result = xorFactory.create(json)

      // Assert
      result.properties.operands.forEach(operand => {
        expect(operand.type).toBe(ASTNodeType.PREDICATE)
        expect((operand as PredicateASTNode).predicateType).toBe(PredicateType.TEST)
      })
    })

    it('should throw InvalidNodeError when operands is missing', () => {
      // Arrange
      const json = {
        type: PredicateType.XOR,
      } as any

      // Act & Assert
      expect(() => xorFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => xorFactory.create(json)).toThrow('Xor predicate requires a non-empty operands array')
    })

    it('should throw InvalidNodeError when operands is empty', () => {
      // Arrange
      const json = {
        type: PredicateType.XOR,
        operands: [],
      } as any

      // Act & Assert
      expect(() => xorFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => xorFactory.create(json)).toThrow('Xor predicate requires a non-empty operands array')
    })
  })
})
