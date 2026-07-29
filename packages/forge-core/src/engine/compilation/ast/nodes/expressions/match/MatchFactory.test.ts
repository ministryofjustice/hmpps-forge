import { ASTNodeType } from '../../../../../contracts/ast/enums'
import {
  ConditionCombinatorType,
  ExpressionType,
  FunctionType,
  PredicateType,
} from '../../../../../../authoring/types/enums'
import { FunctionASTNode, MatchASTNode, ReferenceASTNode } from '../../../../../contracts/ast/expressions.type'
import type {
  ConditionBranchExpr,
  ConditionFunctionExpr,
  MatchExpr,
  ResolvableValue,
} from '../../../../../../authoring/types/expressions.type'
import { NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
import InvalidNodeError from '../../../../../errors/InvalidNodeError'
import { NodeFactory } from '../../NodeFactory'
import type {
  AndPredicateASTNode,
  NotPredicateASTNode,
  OrPredicateASTNode,
  PredicateASTNode,
  TestPredicateASTNode,
  XorPredicateASTNode,
} from '../../../../../contracts/ast/predicates.type'
import MatchFactory from './MatchFactory'

describe('MatchFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let matchFactory: MatchFactory

  // Helpers for the combinator branch cases, which need larger condition trees than a single condition
  const equals = (value: string): ConditionFunctionExpr => ({
    type: FunctionType.CONDITION,
    name: 'Equals',
    arguments: [value],
  })

  const matchOn = (condition: ConditionBranchExpr): MatchExpr => ({
    type: ExpressionType.MATCH,
    subject: { type: ExpressionType.REFERENCE, path: ['data', 'status'] },
    branches: [{ condition, value: 'Result' }],
  })

  const branchPredicate = (json: MatchExpr): PredicateASTNode =>
    matchFactory.create(json).properties.branches[0].predicate as PredicateASTNode

  const testLeaf = (predicate: PredicateASTNode) => {
    const leaf = predicate as TestPredicateASTNode

    return {
      predicateType: leaf.predicateType,
      negate: leaf.properties.negate,
      subjectPath: (leaf.properties.subject as ReferenceASTNode).properties.path,
      conditionArguments: (leaf.properties.condition as FunctionASTNode).properties.arguments,
    }
  }

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator)
    matchFactory = new MatchFactory(nodeIDGenerator, nodeFactory)
  })

  describe('create()', () => {
    it('should create a Match expression with all properties', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'status'] },
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['ACTIVE' as ResolvableValue] },
            value: 'Active',
          },
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['CLOSED' as ResolvableValue] },
            value: 'Closed',
          },
        ],
        otherwise: 'Unknown',
      } satisfies MatchExpr

      // Act
      const result = matchFactory.create(json) as MatchASTNode

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(ExpressionType.MATCH)
      expect(result.properties.branches).toHaveLength(2)
      expect(result.properties.otherwise).toBe('Unknown')
    })

    it('should synthesise predicates for each branch', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'status'] },
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ResolvableValue] },
            value: 'Result A',
          },
        ],
        otherwise: 'Default',
      } satisfies MatchExpr

      // Act
      const result = matchFactory.create(json)
      const predicate = result.properties.branches[0].predicate as TestPredicateASTNode

      // Assert
      expect(predicate.type).toBe(ASTNodeType.PREDICATE)
      expect(predicate.predicateType).toBe(PredicateType.TEST)
    })

    it('should synthesise a TEST predicate carrying the subject when the branch is a single condition', () => {
      // Arrange
      const json = matchOn(equals('A'))

      // Act
      const predicate = branchPredicate(json)

      // Assert
      expect(testLeaf(predicate)).toEqual({
        predicateType: PredicateType.TEST,
        negate: false,
        subjectPath: ['data', 'status'],
        conditionArguments: ['A'],
      })
    })

    it('should expand an AND branch condition into an AND predicate over TEST leaves', () => {
      // Arrange
      const json = matchOn({ type: ConditionCombinatorType.AND, operands: [equals('A'), equals('B')] })

      // Act
      const predicate = branchPredicate(json) as AndPredicateASTNode

      // Assert
      expect(predicate.predicateType).toBe(PredicateType.AND)
      expect(predicate.properties.operands.map(testLeaf)).toEqual([
        {
          predicateType: PredicateType.TEST,
          negate: false,
          subjectPath: ['data', 'status'],
          conditionArguments: ['A'],
        },
        {
          predicateType: PredicateType.TEST,
          negate: false,
          subjectPath: ['data', 'status'],
          conditionArguments: ['B'],
        },
      ])
    })

    it('should expand an OR branch condition into an OR predicate over TEST leaves', () => {
      // Arrange
      const json = matchOn({ type: ConditionCombinatorType.OR, operands: [equals('A'), equals('B')] })

      // Act
      const predicate = branchPredicate(json) as OrPredicateASTNode

      // Assert
      expect(predicate.predicateType).toBe(PredicateType.OR)
      expect(predicate.properties.operands.map(testLeaf)).toEqual([
        {
          predicateType: PredicateType.TEST,
          negate: false,
          subjectPath: ['data', 'status'],
          conditionArguments: ['A'],
        },
        {
          predicateType: PredicateType.TEST,
          negate: false,
          subjectPath: ['data', 'status'],
          conditionArguments: ['B'],
        },
      ])
    })

    it('should expand an XOR branch condition into an XOR predicate over TEST leaves', () => {
      // Arrange
      const json = matchOn({ type: ConditionCombinatorType.XOR, operands: [equals('A'), equals('B')] })

      // Act
      const predicate = branchPredicate(json) as XorPredicateASTNode

      // Assert
      expect(predicate.predicateType).toBe(PredicateType.XOR)
      expect(predicate.properties.operands.map(testLeaf)).toEqual([
        {
          predicateType: PredicateType.TEST,
          negate: false,
          subjectPath: ['data', 'status'],
          conditionArguments: ['A'],
        },
        {
          predicateType: PredicateType.TEST,
          negate: false,
          subjectPath: ['data', 'status'],
          conditionArguments: ['B'],
        },
      ])
    })

    it('should expand a NOT branch condition into a NOT predicate over a TEST leaf', () => {
      // Arrange
      const json = matchOn({ type: ConditionCombinatorType.NOT, operand: equals('A') })

      // Act
      const predicate = branchPredicate(json) as NotPredicateASTNode

      // Assert
      expect(predicate.predicateType).toBe(PredicateType.NOT)
      expect(testLeaf(predicate.properties.operand as PredicateASTNode)).toEqual({
        predicateType: PredicateType.TEST,
        negate: false,
        subjectPath: ['data', 'status'],
        conditionArguments: ['A'],
      })
    })

    it('should expand a nested combinator tree into matching nested predicates', () => {
      // Arrange
      const json = matchOn({
        type: ConditionCombinatorType.OR,
        operands: [
          { type: ConditionCombinatorType.AND, operands: [equals('A'), equals('B')] },
          { type: ConditionCombinatorType.NOT, operand: equals('C') },
        ],
      })

      // Act
      const predicate = branchPredicate(json) as OrPredicateASTNode
      const [nestedAnd, nestedNot] = predicate.properties.operands as [AndPredicateASTNode, NotPredicateASTNode]

      // Assert
      expect(predicate.predicateType).toBe(PredicateType.OR)
      expect(nestedAnd.predicateType).toBe(PredicateType.AND)
      expect(nestedAnd.properties.operands.map(operand => testLeaf(operand).conditionArguments)).toEqual([['A'], ['B']])
      expect(nestedNot.predicateType).toBe(PredicateType.NOT)
      expect(testLeaf(nestedNot.properties.operand as PredicateASTNode).conditionArguments).toEqual(['C'])
    })

    it('should generate unique node IDs across the synthesised predicates of a combinator tree', () => {
      // Arrange
      const json = matchOn({
        type: ConditionCombinatorType.OR,
        operands: [
          { type: ConditionCombinatorType.AND, operands: [equals('A'), equals('B')] },
          { type: ConditionCombinatorType.NOT, operand: equals('C') },
        ],
      })

      // Act
      const predicate = branchPredicate(json) as OrPredicateASTNode
      const [nestedAnd, nestedNot] = predicate.properties.operands as [AndPredicateASTNode, NotPredicateASTNode]
      const ids = [
        predicate.id,
        nestedAnd.id,
        ...nestedAnd.properties.operands.map(operand => operand.id),
        nestedNot.id,
        (nestedNot.properties.operand as PredicateASTNode).id,
      ]

      // Assert
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('should handle literal branch values', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ResolvableValue] },
            value: 'literalValue',
          },
        ],
      } satisfies MatchExpr

      // Act
      const result = matchFactory.create(json)

      // Assert
      expect(result.properties.branches[0].value).toBe('literalValue')
    })

    it('should transform expression branch values', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ResolvableValue] },
            value: { type: ExpressionType.REFERENCE, path: ['answers', 'fieldA'] },
          },
        ],
      } satisfies MatchExpr

      // Act
      const result = matchFactory.create(json)

      // Assert
      expect(result.properties.branches[0].value.type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should handle otherwise when present', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ResolvableValue] },
            value: 'A',
          },
        ],
        otherwise: 'Default',
      } satisfies MatchExpr

      // Act
      const result = matchFactory.create(json)

      // Assert
      expect(result.properties.otherwise).toBe('Default')
    })

    it('should handle missing otherwise', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ResolvableValue] },
            value: 'A',
          },
        ],
      } satisfies MatchExpr

      // Act
      const result = matchFactory.create(json)

      // Assert
      expect(result.properties.otherwise).toBeUndefined()
    })

    it('should transform expression otherwise value', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ResolvableValue] },
            value: 'A',
          },
        ],
        otherwise: { type: ExpressionType.REFERENCE, path: ['answers', 'fallback'] },
      } satisfies MatchExpr

      // Act
      const result = matchFactory.create(json)

      // Assert
      expect(result.properties.otherwise.type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should generate unique node IDs', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A' as ResolvableValue] },
            value: 'A',
          },
        ],
      } satisfies MatchExpr

      // Act
      const result1 = matchFactory.create(json)
      const result2 = matchFactory.create(json)

      // Assert
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })

    it('should throw InvalidNodeError when subject is missing', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        branches: [
          {
            condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['A'] },
            value: 'A',
          },
        ],
      } as any

      // Act & Assert
      expect(() => matchFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => matchFactory.create(json)).toThrow('Match expression requires a subject')
    })

    it('should throw InvalidNodeError when branches is empty', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
        branches: [],
      } as any

      // Act & Assert
      expect(() => matchFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => matchFactory.create(json)).toThrow('Match expression requires at least one branch')
    })

    it('should throw InvalidNodeError when branches is missing', () => {
      // Arrange
      const json = {
        type: ExpressionType.MATCH,
        subject: { type: ExpressionType.REFERENCE, path: ['data', 'type'] },
      } as any

      // Act & Assert
      expect(() => matchFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => matchFactory.create(json)).toThrow('Match expression requires at least one branch')
    })
  })
})
