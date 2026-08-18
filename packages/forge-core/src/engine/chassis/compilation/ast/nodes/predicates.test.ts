import { ASTNodeType } from '../../../contracts/ast/enums'
import { ExpressionType, FunctionType, PredicateType } from '../../../../../authoring/types/enums'
import type {
  PredicateAndExpr,
  PredicateNotExpr,
  PredicateTestExpr,
  ResolvableValue,
} from '../../../../../authoring/types/expressions.type'
import { NodeIDGenerator } from '../ast-state/NodeIDGenerator'
import ForgeInvalidNodeError from '../../../../errors/ForgeInvalidNodeError'
import { ExpressionASTNode } from '../../../contracts/ast/expressions.type'
import { NodeFactory } from './NodeFactory'
import { PredicateASTNode, NotPredicateASTNode } from '../../../contracts/ast/predicates.type'
import { createNotPredicateNode, createTestPredicateNode, naryPredicateCreator } from './predicates'

describe('predicates', () => {
  describe('createTestPredicateNode()', () => {
    let nodeIDGenerator: NodeIDGenerator
    let nodeFactory: NodeFactory

    beforeEach(() => {
      nodeIDGenerator = new NodeIDGenerator()
      nodeFactory = new NodeFactory(nodeIDGenerator)
    })

    it('should create a Test predicate with subject and condition', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
      } satisfies PredicateTestExpr

      // Act
      const result = createTestPredicateNode(json, nodeFactory.context)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.PREDICATE)
      expect(result.predicateType).toBe(PredicateType.TEST)
      expect(result.properties.subject).toBeDefined()
      expect(result.properties.condition).toBeDefined()
      expect(result.properties.negate).toBeDefined()
    })

    it('should transform subject using nodeFactory', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
      } satisfies PredicateTestExpr

      // Act
      const result = createTestPredicateNode(json, nodeFactory.context)
      const subject = result.properties.subject as ExpressionASTNode

      // Assert
      expect(subject.type).toBe(ASTNodeType.EXPRESSION)
      expect(subject.expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should transform condition using nodeFactory', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
      } satisfies PredicateTestExpr

      // Act
      const result = createTestPredicateNode(json, nodeFactory.context)
      const condition = result.properties.condition as ExpressionASTNode

      // Assert
      expect(condition.type).toBe(ASTNodeType.EXPRESSION)
      expect(condition.expressionType).toBe(FunctionType.CONDITION)
    })

    it('should handle negate flag as true', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        negate: true,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
      } satisfies PredicateTestExpr

      // Act
      const result = createTestPredicateNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.negate).toBe(true)
    })

    it('should handle negate flag as false', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
      } satisfies PredicateTestExpr

      // Act
      const result = createTestPredicateNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.negate).toBe(false)
    })

    it('should default negate to false when omitted', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
      }

      // Act
      const result = createTestPredicateNode(json as PredicateTestExpr, nodeFactory.context)

      // Assert
      expect(result.properties.negate).toBe(false)
    })

    it('should throw ForgeInvalidNodeError when subject is missing', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
      } as any

      // Act & Assert
      expect(() => createTestPredicateNode(json, nodeFactory.context)).toThrow(ForgeInvalidNodeError)
      expect(() => createTestPredicateNode(json, nodeFactory.context)).toThrow('Test predicate requires a subject')
    })

    it('should accept falsy literal subjects when they are 0, empty string or false', () => {
      // Arrange
      const falsySubjects = [0, '', false]

      // Act
      const results = falsySubjects.map(subject =>
        createTestPredicateNode(
          {
            type: PredicateType.TEST,
            subject,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
          } as PredicateTestExpr,
          nodeFactory.context,
        ),
      )

      // Assert
      expect(results.map(result => result.properties.subject)).toEqual(falsySubjects)
    })

    it('should throw ForgeInvalidNodeError when condition is missing', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
      } as any

      // Act & Assert
      expect(() => createTestPredicateNode(json, nodeFactory.context)).toThrow(ForgeInvalidNodeError)
      expect(() => createTestPredicateNode(json, nodeFactory.context)).toThrow('Test predicate requires a condition')
    })

    it('should support literal string as subject', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        subject: 'hello' as any,
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] as ResolvableValue[] },
      } satisfies PredicateTestExpr

      // Act
      const result = createTestPredicateNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.subject).toBe('hello')
    })

    it('should support literal number as subject', () => {
      // Arrange
      const json = {
        type: PredicateType.TEST,
        subject: 42 as any,
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'GreaterThan', arguments: [0] as ResolvableValue[] },
      } satisfies PredicateTestExpr

      // Act
      const result = createTestPredicateNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.subject).toBe(42)
    })

    it('should support literal array as subject', () => {
      // Arrange
      const literalArray = [1, 2, 3]
      const json = {
        type: PredicateType.TEST,
        subject: literalArray as any,
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'HasLength', arguments: [3] as ResolvableValue[] },
      } satisfies PredicateTestExpr

      // Act
      const result = createTestPredicateNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.subject).toEqual([1, 2, 3])
    })
  })

  describe('createNotPredicateNode()', () => {
    let nodeIDGenerator: NodeIDGenerator
    let nodeFactory: NodeFactory

    beforeEach(() => {
      nodeIDGenerator = new NodeIDGenerator()
      nodeFactory = new NodeFactory(nodeIDGenerator)
    })

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
      const result = createNotPredicateNode(json, nodeFactory.context)

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
      const result = createNotPredicateNode(json, nodeFactory.context)
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
      const result = createNotPredicateNode(json, nodeFactory.context)
      const outerOperand = result.properties.operand as NotPredicateASTNode
      const innerOperand = outerOperand.properties.operand as PredicateASTNode

      // Assert
      expect(outerOperand.predicateType).toBe(PredicateType.NOT)
      expect(innerOperand.predicateType).toBe(PredicateType.TEST)
    })

    it('should throw ForgeInvalidNodeError when operand is missing', () => {
      // Arrange
      const json = {
        type: PredicateType.NOT,
      } as any

      // Act & Assert
      expect(() => createNotPredicateNode(json, nodeFactory.context)).toThrow(ForgeInvalidNodeError)
      expect(() => createNotPredicateNode(json, nodeFactory.context)).toThrow('Not predicate requires an operand')
    })
  })

  describe('naryPredicateCreator()', () => {
    const naryPredicateTypes = [PredicateType.AND, PredicateType.OR, PredicateType.XOR] as const

    let nodeFactory: NodeFactory

    beforeEach(() => {
      nodeFactory = new NodeFactory(new NodeIDGenerator())
    })

    const testPredicate = (field: string): PredicateTestExpr => ({
      type: PredicateType.TEST,
      subject: { type: ExpressionType.REFERENCE, path: ['answers', field] },
      negate: false,
      condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
    })

    const naryExpr = (predicateType: (typeof naryPredicateTypes)[number], operands: unknown[]) =>
      ({ type: predicateType, operands }) as PredicateAndExpr

    it('should create a predicate of the matching type when given multiple operands', () => {
      // Arrange
      const jsons = naryPredicateTypes.map(predicateType =>
        naryExpr(predicateType, [testPredicate('field1'), testPredicate('field2')]),
      )

      // Act
      const results = jsons.map(json => naryPredicateCreator(json.type)(json, nodeFactory.context))

      // Assert
      results.forEach((result, index) => {
        expect(result.id).toBeDefined()
        expect(result.type).toBe(ASTNodeType.PREDICATE)
        expect(result.predicateType).toBe(naryPredicateTypes[index])
        expect(result.properties.operands).toHaveLength(2)
      })
    })

    it('should transform each operand into a predicate node', () => {
      // Arrange
      const json = naryExpr(PredicateType.AND, [testPredicate('field1'), testPredicate('field2')])

      // Act
      const result = naryPredicateCreator(PredicateType.AND)(json, nodeFactory.context)

      // Assert
      result.properties.operands.forEach(operand => {
        expect(operand.type).toBe(ASTNodeType.PREDICATE)
        expect(operand.predicateType).toBe(PredicateType.TEST)
      })
    })

    it('should transform nested combinators recursively', () => {
      // Arrange
      const json = naryExpr(PredicateType.XOR, [
        naryExpr(PredicateType.XOR, [testPredicate('field1'), testPredicate('field2')]),
      ])

      // Act
      const result = naryPredicateCreator(PredicateType.XOR)(json, nodeFactory.context)

      // Assert
      const [nested] = result.properties.operands
      expect(nested.predicateType).toBe(PredicateType.XOR)
      expect((nested as typeof result).properties.operands).toHaveLength(2)
    })

    it('should throw ForgeInvalidNodeError naming the predicate when operands is empty', () => {
      // Arrange
      const jsons = naryPredicateTypes.map(predicateType => naryExpr(predicateType, []))
      const expectedMessages = ['And', 'Or', 'Xor'].map(name => `${name} predicate requires a non-empty operands array`)

      // Act & Assert
      jsons.forEach((json, index) => {
        expect(() => naryPredicateCreator(json.type)(json, nodeFactory.context)).toThrow(ForgeInvalidNodeError)
        expect(() => naryPredicateCreator(json.type)(json, nodeFactory.context)).toThrow(expectedMessages[index])
      })
    })

    it('should throw ForgeInvalidNodeError when operands is missing', () => {
      // Arrange
      const jsons = naryPredicateTypes.map(predicateType => ({ type: predicateType }) as PredicateAndExpr)

      // Act & Assert
      jsons.forEach(json => {
        expect(() => naryPredicateCreator(json.type)(json, nodeFactory.context)).toThrow(ForgeInvalidNodeError)
      })
    })
  })
})
