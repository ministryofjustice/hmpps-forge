import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType, LogicType } from '@form-engine/form/types/enums'
import type {
  ConditionalExpr,
  PredicateAndExpr,
  PredicateNotExpr,
  PredicateOrExpr,
  PredicateTestExpr,
  PredicateXorExpr,
  ValueExpr,
} from '@form-engine/form/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import UnknownNodeTypeError from '@form-engine/errors/UnknownNodeTypeError'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import {
  AndPredicateASTNode,
  ConditionalASTNode,
  ExpressionASTNode,
  NotPredicateASTNode,
  OrPredicateASTNode,
  PredicateASTNode,
  TestPredicateASTNode,
  XorPredicateASTNode,
} from '@form-engine/core/types/expressions.type'
import { NodeFactory } from '../NodeFactory'
import { LogicNodeFactory } from './LogicNodeFactory'

describe('LogicNodeFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let logicFactory: LogicNodeFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    logicFactory = new LogicNodeFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create', () => {
    it('should route to createConditional for Conditional expressions', () => {
      const json = {
        type: LogicType.CONDITIONAL,
        predicate: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        thenValue: 'yes',
        elseValue: 'no',
      } satisfies ConditionalExpr

      const result = logicFactory.create(json) as ConditionalASTNode

      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(LogicType.CONDITIONAL)
      expect(result.raw).toBe(json)
      expect(result.id).toBeDefined()

      expect(result.properties.predicate).toBeDefined()
    })

    it('should route to createPredicate for Test predicates', () => {
      const json = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      const result = logicFactory.create(json)

      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(LogicType.TEST)
      expect(result.raw).toBe(json)
      expect(result.id).toBeDefined()
    })

    it('should route to createPredicate for And predicates', () => {
      const json = {
        type: LogicType.AND,
        operands: [
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field2'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
        ],
      } satisfies PredicateAndExpr

      const result = logicFactory.create(json)

      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(LogicType.AND)
      expect(result.raw).toBe(json)
      expect(result.id).toBeDefined()
    })

    it('should route to createPredicate for Or predicates', () => {
      const json = {
        type: LogicType.OR,
        operands: [
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field2'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
        ],
      } satisfies PredicateOrExpr

      const result = logicFactory.create(json)

      expect(result.expressionType).toBe(LogicType.OR)
    })

    it('should route to createPredicate for Xor predicates', () => {
      const json = {
        type: LogicType.XOR,
        operands: [
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field2'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
        ],
      } satisfies PredicateXorExpr

      const result = logicFactory.create(json)

      expect(result.expressionType).toBe(LogicType.XOR)
    })

    it('should route to createPredicate for Not predicates', () => {
      const json = {
        type: LogicType.NOT,
        operand: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
      } satisfies PredicateNotExpr

      const result = logicFactory.create(json)

      expect(result.expressionType).toBe(LogicType.NOT)
    })

    it('should throw UnknownNodeTypeError for invalid types', () => {
      const json = {
        type: 'InvalidType',
      }

      expect(() => logicFactory.create(json)).toThrow(UnknownNodeTypeError)
    })

    it('should throw UnknownNodeTypeError with correct error details', () => {
      const json = {
        type: 'InvalidType',
        someData: 'value',
      }

      try {
        logicFactory.create(json)
        fail('Should have thrown UnknownNodeTypeError')
      } catch (error) {
        expect(error).toBeInstanceOf(UnknownNodeTypeError)

        if (error instanceof UnknownNodeTypeError) {
          expect(error.nodeType).toBe('InvalidType')
        }
      }
    })
  })

  describe('createConditional', () => {
    it('should create a Conditional expression with all properties', () => {
      const json = {
        type: LogicType.CONDITIONAL,
        predicate: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        thenValue: 'yes',
        elseValue: 'no',
      } satisfies ConditionalExpr

      const result = logicFactory.create(json) as ConditionalASTNode

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(LogicType.CONDITIONAL)
      expect(result.raw).toBe(json)

      expect(result.properties.predicate).toBeDefined()
      expect(result.properties.thenValue).toBeDefined()
      expect(result.properties.elseValue).toBeDefined()
    })

    it('should transform predicate using real nodeFactory', () => {
      const predicateJson = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      const json = {
        type: LogicType.CONDITIONAL,
        predicate: predicateJson,
        thenValue: 'yes',
        elseValue: 'no',
      } satisfies ConditionalExpr

      const result = logicFactory.create(json) as ConditionalASTNode
      const predicate = result.properties.predicate as PredicateASTNode

      expect(predicate.type).toBe(ASTNodeType.EXPRESSION)
      expect(predicate.expressionType).toBe(LogicType.TEST)
    })

    it('should handle literal thenValue and elseValue', () => {
      const json = {
        type: LogicType.CONDITIONAL,
        predicate: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        thenValue: 'literalThen',
        elseValue: 'literalElse',
      } satisfies ConditionalExpr

      const result = logicFactory.create(json) as ConditionalASTNode

      expect(result.properties.thenValue).toBe('literalThen')
      expect(result.properties.elseValue).toBe('literalElse')
    })

    it('should transform expression thenValue and elseValue', () => {
      const json = {
        type: LogicType.CONDITIONAL,
        predicate: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        thenValue: { type: ExpressionType.REFERENCE, path: ['answers', 'thenField'] },
        elseValue: { type: ExpressionType.REFERENCE, path: ['answers', 'elseField'] },
      } satisfies ConditionalExpr

      const result = logicFactory.create(json) as ConditionalASTNode

      const thenValue = result.properties.thenValue
      const elseValue = result.properties.elseValue

      expect(thenValue.type).toBe(ASTNodeType.EXPRESSION)

      expect(elseValue.type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should default thenValue to true when omitted', () => {
      const json = {
        type: LogicType.CONDITIONAL,
        predicate: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        elseValue: 'no',
      }

      const result = logicFactory.create(json) as ConditionalASTNode

      expect(result.properties.predicate).toBeDefined()
      expect(result.properties.thenValue).toBe(true)
      expect(result.properties.elseValue).toBe('no')
    })

    it('should default elseValue to false when omitted', () => {
      const json = {
        type: LogicType.CONDITIONAL,
        predicate: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        thenValue: 'yes',
      }

      const result = logicFactory.create(json) as ConditionalASTNode

      expect(result.properties.predicate).toBeDefined()
      expect(result.properties.thenValue).toBe('yes')
      expect(result.properties.elseValue).toBe(false)
    })

    it('should generate unique node IDs', () => {
      const json = {
        type: LogicType.CONDITIONAL,
        predicate: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        thenValue: 'yes',
        elseValue: 'no',
      }

      const result1 = logicFactory.create(json) as ConditionalASTNode
      const result2 = logicFactory.create(json) as ConditionalASTNode

      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })

    it('should throw InvalidNodeError when predicate is missing', () => {
      const json = {
        type: LogicType.CONDITIONAL,
        thenValue: 'yes',
        elseValue: 'no',
      } as any

      expect(() => logicFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => logicFactory.create(json)).toThrow('Conditional expression requires a predicate')
    })
  })

  describe('createPredicate - TEST', () => {
    it('should create a Test predicate with subject and condition', () => {
      const json = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      const result = logicFactory.create(json) as TestPredicateASTNode

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(LogicType.TEST)
      expect(result.raw).toBe(json)

      expect(result.properties.subject).toBeDefined()
      expect(result.properties.condition).toBeDefined()
      expect(result.properties.negate).toBeDefined()
    })

    it('should transform subject using real nodeFactory', () => {
      const json = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      const result = logicFactory.create(json) as TestPredicateASTNode
      const subject = result.properties.subject as ExpressionASTNode

      expect(subject.type).toBe(ASTNodeType.EXPRESSION)
      expect(subject.expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should transform condition using real nodeFactory', () => {
      const json = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      const result = logicFactory.create(json) as TestPredicateASTNode
      const condition = result.properties.condition as ExpressionASTNode

      expect(condition.type).toBe(ASTNodeType.EXPRESSION)
      expect(condition.expressionType).toBe(FunctionType.CONDITION)
    })

    it('should handle negate flag', () => {
      const json = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        negate: true,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      const result = logicFactory.create(json) as TestPredicateASTNode

      expect(result.properties.negate).toBe(true)
    })

    it('should handle negate as false', () => {
      const json = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      const result = logicFactory.create(json) as TestPredicateASTNode

      expect(result.properties.negate).toBe(false)
    })

    it('should default negate to false when omitted', () => {
      const json = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      }

      const result = logicFactory.create(json) as TestPredicateASTNode

      expect(result.properties.negate).toBe(false)
    })

    it('should throw InvalidNodeError when subject is missing', () => {
      const json = {
        type: LogicType.TEST,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } as any

      expect(() => logicFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => logicFactory.create(json)).toThrow('Test predicate requires a subject')
    })

    it('should throw InvalidNodeError when condition is missing', () => {
      const json = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
      } as any

      expect(() => logicFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => logicFactory.create(json)).toThrow('Test predicate requires a condition')
    })
  })

  describe('createPredicate - NOT', () => {
    it('should create a Not predicate with operand', () => {
      const json = {
        type: LogicType.NOT,
        operand: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
      } satisfies PredicateNotExpr

      const result = logicFactory.create(json) as NotPredicateASTNode

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(LogicType.NOT)
      expect(result.raw).toBe(json)
      expect(result.properties.operand).toBeDefined()
    })

    it('should transform operand using real nodeFactory', () => {
      const json = {
        type: LogicType.NOT,
        operand: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
      } satisfies PredicateNotExpr

      const result = logicFactory.create(json) as NotPredicateASTNode
      const operand = result.properties.operand as ExpressionASTNode

      expect(operand.type).toBe(ASTNodeType.EXPRESSION)
      expect(operand.expressionType).toBe(LogicType.TEST)
    })

    it('should handle nested Not predicates', () => {
      const json = {
        type: LogicType.NOT,
        operand: {
          type: LogicType.NOT,
          operand: {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
        } satisfies PredicateNotExpr,
      } satisfies PredicateNotExpr

      const result = logicFactory.create(json) as NotPredicateASTNode
      const outerOperand = result.properties.operand as NotPredicateASTNode
      const innerOperand = outerOperand.properties.operand as ExpressionASTNode

      expect(outerOperand.expressionType).toBe(LogicType.NOT)
      expect(innerOperand.expressionType).toBe(LogicType.TEST)
    })

    it('should throw InvalidNodeError when operand is missing', () => {
      const json = {
        type: LogicType.NOT,
      } as any

      expect(() => logicFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => logicFactory.create(json)).toThrow('Not predicate requires an operand')
    })
  })

  describe('createPredicate - AND/OR/XOR', () => {
    it('should create an And predicate with multiple operands', () => {
      const json = {
        type: LogicType.AND,
        operands: [
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field2'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
        ],
      } satisfies PredicateAndExpr

      const result = logicFactory.create(json) as AndPredicateASTNode
      const operands = result.properties.operands

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(LogicType.AND)
      expect(result.raw).toBe(json)

      expect(Array.isArray(operands)).toBe(true)
      expect(operands).toHaveLength(2)
    })

    it('should transform each operand using real nodeFactory', () => {
      const json = {
        type: LogicType.AND,
        operands: [
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field2'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
        ],
      } satisfies PredicateAndExpr

      const result = logicFactory.create(json) as AndPredicateASTNode
      const operands = result.properties.operands

      operands.forEach((operand: ExpressionASTNode) => {
        expect(operand.type).toBe(ASTNodeType.EXPRESSION)
        expect(operand.expressionType).toBe(LogicType.TEST)
      })
    })

    it('should create an Or predicate with multiple operands', () => {
      const json = {
        type: LogicType.OR,
        operands: [
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field2'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
        ],
      } satisfies PredicateOrExpr

      const result = logicFactory.create(json) as OrPredicateASTNode
      const operands = result.properties.operands

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(LogicType.OR)
      expect(result.raw).toBe(json)

      expect(Array.isArray(operands)).toBe(true)
      expect(operands).toHaveLength(2)
    })

    it('should create an Xor predicate with multiple operands', () => {
      const json = {
        type: LogicType.XOR,
        operands: [
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field2'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
        ],
      } satisfies PredicateXorExpr

      const result = logicFactory.create(json) as XorPredicateASTNode
      const operands = result.properties.operands

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(LogicType.XOR)
      expect(result.raw).toBe(json)

      expect(Array.isArray(operands)).toBe(true)
      expect(operands).toHaveLength(2)
    })

    it('should handle nested And predicates', () => {
      const json = {
        type: LogicType.AND,
        operands: [
          {
            type: LogicType.AND,
            operands: [
              {
                type: LogicType.TEST,
                subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field1'] },
                negate: false,
                condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
              } satisfies PredicateTestExpr,
              {
                type: LogicType.TEST,
                subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field1'] },
                negate: false,
                condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
              } satisfies PredicateTestExpr,
            ],
          } satisfies PredicateAndExpr,
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field2'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
        ],
      } satisfies PredicateAndExpr

      const result = logicFactory.create(json) as AndPredicateASTNode
      const operands = result.properties.operands

      expect((operands[0] as ExpressionASTNode).expressionType).toBe(LogicType.AND)
      expect((operands[1] as ExpressionASTNode).expressionType).toBe(LogicType.TEST)
    })

    it('should handle mixed operand types', () => {
      const json = {
        type: LogicType.AND,
        operands: [
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
          {
            type: LogicType.NOT,
            operand: {
              type: LogicType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field2'] },
              negate: false,
              condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
            } satisfies PredicateTestExpr,
          } satisfies PredicateNotExpr,
          {
            type: LogicType.OR,
            operands: [
              {
                type: LogicType.TEST,
                subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field3'] },
                negate: false,
                condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
              } satisfies PredicateTestExpr,
              {
                type: LogicType.TEST,
                subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field3'] },
                negate: false,
                condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
              } satisfies PredicateTestExpr,
            ],
          } satisfies PredicateOrExpr,
        ],
      } satisfies PredicateAndExpr

      const result = logicFactory.create(json) as AndPredicateASTNode
      const operands = result.properties.operands

      expect(operands).toHaveLength(3)

      expect((operands[0] as ExpressionASTNode).expressionType).toBe(LogicType.TEST)
      expect((operands[1] as ExpressionASTNode).expressionType).toBe(LogicType.NOT)
      expect((operands[2] as ExpressionASTNode).expressionType).toBe(LogicType.OR)
    })

    it('should throw InvalidNodeError when operands is missing', () => {
      const json = {
        type: LogicType.AND,
      } as any

      expect(() => logicFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => logicFactory.create(json)).toThrow('And predicate requires a non-empty operands array')
    })

    it('should throw InvalidNodeError when operands is empty', () => {
      const json = {
        type: LogicType.AND,
        operands: [],
      } as any

      expect(() => logicFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => logicFactory.create(json)).toThrow('And predicate requires a non-empty operands array')
    })

    it('should throw InvalidNodeError when Or operands is missing', () => {
      const json = {
        type: LogicType.OR,
      } as any

      expect(() => logicFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => logicFactory.create(json)).toThrow('Or predicate requires a non-empty operands array')
    })

    it('should throw InvalidNodeError when Or operands is empty', () => {
      const json = {
        type: LogicType.OR,
        operands: [],
      } as any

      expect(() => logicFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => logicFactory.create(json)).toThrow('Or predicate requires a non-empty operands array')
    })

    it('should throw InvalidNodeError when Xor operands is missing', () => {
      const json = {
        type: LogicType.XOR,
      } as any

      expect(() => logicFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => logicFactory.create(json)).toThrow('Xor predicate requires a non-empty operands array')
    })

    it('should throw InvalidNodeError when Xor operands is empty', () => {
      const json = {
        type: LogicType.XOR,
        operands: [],
      } as any

      expect(() => logicFactory.create(json)).toThrow(InvalidNodeError)
      expect(() => logicFactory.create(json)).toThrow('Xor predicate requires a non-empty operands array')
    })
  })
})
