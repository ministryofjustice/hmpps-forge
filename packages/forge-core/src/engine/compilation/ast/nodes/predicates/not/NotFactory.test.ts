import { ASTNodeType } from '../../../../../contracts/ast/enums'
import { ExpressionType, FunctionType, PredicateType } from '../../../../../../authoring/types/enums'
import type {
  PredicateNotExpr,
  PredicateTestExpr,
  ResolvableValue,
} from '../../../../../../authoring/types/expressions.type'
import { NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
import InvalidNodeError from '../../../../../errors/InvalidNodeError'
import { NodeFactory } from '../../NodeFactory'
import { PredicateASTNode, NotPredicateASTNode } from '../../../../../contracts/ast/predicates.type'
import NotFactory from './NotFactory'

describe('NotFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let notFactory: NotFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator)
    notFactory = new NotFactory(nodeIDGenerator, nodeFactory)
  })

  describe('create()', () => {
    it('should create a Not predicate with operand', () => {
      // Arrange
      const json = {
        type: PredicateType.NOT,
        operand: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        } satisfies PredicateTestExpr,
      } satisfies PredicateNotExpr

      // Act
      const result = notFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.PREDICATE)
      expect(result.predicateType).toBe(PredicateType.NOT)
      expect(result.properties.operand).toBeDefined()
    })

    it('should transform operand using nodeFactory', () => {
      // Arrange
      const json = {
        type: PredicateType.NOT,
        operand: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        } satisfies PredicateTestExpr,
      } satisfies PredicateNotExpr

      // Act
      const result = notFactory.create(json)
      const operand = result.properties.operand as PredicateASTNode

      // Assert
      expect(operand.type).toBe(ASTNodeType.PREDICATE)
      expect(operand.predicateType).toBe(PredicateType.TEST)
    })

    it('should handle nested Not predicates', () => {
      // Arrange
      const json = {
        type: PredicateType.NOT,
        operand: {
          type: PredicateType.NOT,
          operand: {
            type: PredicateType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
          } satisfies PredicateTestExpr,
        } satisfies PredicateNotExpr,
      } satisfies PredicateNotExpr

      // Act
      const result = notFactory.create(json)
      const outerOperand = result.properties.operand as NotPredicateASTNode
      const innerOperand = outerOperand.properties.operand as PredicateASTNode

      // Assert
      expect(outerOperand.predicateType).toBe(PredicateType.NOT)
      expect(innerOperand.predicateType).toBe(PredicateType.TEST)
    })

    it('should throw InvalidNodeError when operand is missing', () => {
      // Arrange
      const json = {
        type: PredicateType.NOT,
      } as any

      // Act & Assert
      expect(() => notFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => notFactory.create(json)).toThrow('Not predicate requires an operand')
    })
  })
})
