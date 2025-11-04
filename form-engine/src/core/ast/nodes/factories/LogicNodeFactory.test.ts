import { ASTNodeType } from '@form-engine/core/types/enums'
import { LogicType, ExpressionType, FunctionType } from '@form-engine/form/types/enums'
import type {
  ConditionalExpr,
  PredicateTestExpr,
  PredicateAndExpr,
  PredicateOrExpr,
  PredicateXorExpr,
  PredicateNotExpr,
  ValueExpr,
} from '@form-engine/form/types/expressions.type'
import { NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import UnknownNodeTypeError from '@form-engine/errors/UnknownNodeTypeError'
import { ExpressionASTNode } from '@form-engine/core/types/expressions.type'
import { NodeFactory } from '../NodeFactory'
import { LogicNodeFactory } from './LogicNodeFactory'

describe('LogicNodeFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let logicFactory: LogicNodeFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator)
    logicFactory = new LogicNodeFactory(nodeIDGenerator, nodeFactory)
  })

  describe('create', () => {
    it('should route to createConditional for Conditional expressions', () => {
      const json = {
        type: LogicType.CONDITIONAL,
        predicate: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        thenValue: 'yes',
        elseValue: 'no',
      } satisfies ConditionalExpr

      const result = logicFactory.create(json)

      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(LogicType.CONDITIONAL)
      expect(result.raw).toBe(json)
      expect(result.id).toBeDefined()

      expect(result.properties.has('predicate')).toBe(true)
    })

    it('should route to createPredicate for Test predicates', () => {
      const json = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['field'] },
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
            subject: { type: ExpressionType.REFERENCE, path: ['field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['field2'] },
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
            subject: { type: ExpressionType.REFERENCE, path: ['field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['field2'] },
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
            subject: { type: ExpressionType.REFERENCE, path: ['field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['field2'] },
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
          subject: { type: ExpressionType.REFERENCE, path: ['field'] },
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
          subject: { type: ExpressionType.REFERENCE, path: ['field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        thenValue: 'yes',
        elseValue: 'no',
      } satisfies ConditionalExpr

      const result = logicFactory.create(json)

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(LogicType.CONDITIONAL)
      expect(result.raw).toBe(json)

      expect(result.properties.has('predicate')).toBe(true)
      expect(result.properties.has('thenValue')).toBe(true)
      expect(result.properties.has('elseValue')).toBe(true)
    })

    it('should transform predicate using real nodeFactory', () => {
      const predicateJson = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      const json = {
        type: LogicType.CONDITIONAL,
        predicate: predicateJson,
        thenValue: 'yes',
        elseValue: 'no',
      } satisfies ConditionalExpr

      const result = logicFactory.create(json)
      const predicate = result.properties.get('predicate')

      expect(predicate.type).toBe(ASTNodeType.EXPRESSION)
      expect(predicate.expressionType).toBe(LogicType.TEST)
    })

    it('should handle literal thenValue and elseValue', () => {
      const json = {
        type: LogicType.CONDITIONAL,
        predicate: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        thenValue: 'literalThen',
        elseValue: 'literalElse',
      } satisfies ConditionalExpr

      const result = logicFactory.create(json)

      expect(result.properties.get('thenValue')).toBe('literalThen')
      expect(result.properties.get('elseValue')).toBe('literalElse')
    })

    it('should transform expression thenValue and elseValue', () => {
      const json = {
        type: LogicType.CONDITIONAL,
        predicate: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        thenValue: { type: ExpressionType.REFERENCE, path: ['thenField'] },
        elseValue: { type: ExpressionType.REFERENCE, path: ['elseField'] },
      } satisfies ConditionalExpr

      const result = logicFactory.create(json)

      const thenValue = result.properties.get('thenValue')
      const elseValue = result.properties.get('elseValue')

      expect(thenValue.type).toBe(ASTNodeType.EXPRESSION)

      expect(elseValue.type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should handle conditional without predicate', () => {
      const json = {
        type: LogicType.CONDITIONAL,
        thenValue: 'yes',
        elseValue: 'no',
      }

      const result = logicFactory.create(json)

      expect(result.properties.has('predicate')).toBe(false)
      expect(result.properties.has('thenValue')).toBe(true)
      expect(result.properties.has('elseValue')).toBe(true)
    })

    it('should handle conditional without thenValue', () => {
      const json = {
        type: LogicType.CONDITIONAL,
        predicate: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        elseValue: 'no',
      }

      const result = logicFactory.create(json)

      expect(result.properties.has('predicate')).toBe(true)
      expect(result.properties.has('thenValue')).toBe(false)
      expect(result.properties.has('elseValue')).toBe(true)
    })

    it('should handle conditional without elseValue', () => {
      const json = {
        type: LogicType.CONDITIONAL,
        predicate: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        thenValue: 'yes',
      }

      const result = logicFactory.create(json)

      expect(result.properties.has('predicate')).toBe(true)
      expect(result.properties.has('thenValue')).toBe(true)
      expect(result.properties.has('elseValue')).toBe(false)
    })

    it('should not store undefined values explicitly set', () => {
      const json = {
        type: LogicType.CONDITIONAL,
        predicate: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        thenValue: undefined as ValueExpr | undefined,
        elseValue: undefined as ValueExpr | undefined,
      }

      const result = logicFactory.create(json)

      expect(result.properties.has('thenValue')).toBe(false)
      expect(result.properties.has('elseValue')).toBe(false)
    })

    it('should generate unique node IDs', () => {
      const json = {
        type: LogicType.CONDITIONAL,
        thenValue: 'yes',
        elseValue: 'no',
      }

      const result1 = logicFactory.create(json)
      const result2 = logicFactory.create(json)

      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })
  })

  describe('createPredicate - TEST', () => {
    it('should create a Test predicate with subject and condition', () => {
      const json = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      const result = logicFactory.create(json)

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(LogicType.TEST)
      expect(result.raw).toBe(json)

      expect(result.properties.has('subject')).toBe(true)
      expect(result.properties.has('condition')).toBe(true)
      expect(result.properties.has('negate')).toBe(true)
    })

    it('should transform subject using real nodeFactory', () => {
      const json = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      const result = logicFactory.create(json)
      const subject = result.properties.get('subject')

      expect(subject.type).toBe(ASTNodeType.EXPRESSION)
      expect(subject.expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should transform condition using real nodeFactory', () => {
      const json = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      const result = logicFactory.create(json)
      const condition = result.properties.get('condition')

      expect(condition.type).toBe(ASTNodeType.EXPRESSION)
      expect(condition.expressionType).toBe(FunctionType.CONDITION)
    })

    it('should handle negate flag', () => {
      const json = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['field'] },
        negate: true,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      const result = logicFactory.create(json)

      expect(result.properties.get('negate')).toBe(true)
    })

    it('should handle negate as false', () => {
      const json = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['field'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      const result = logicFactory.create(json)

      expect(result.properties.get('negate')).toBe(false)
    })

    it('should handle negate as undefined', () => {
      const json = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['field'] },
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      }

      const result = logicFactory.create(json)

      expect(result.properties.get('negate')).toBeUndefined()
    })
  })

  describe('createPredicate - NOT', () => {
    it('should create a Not predicate with operand', () => {
      const json = {
        type: LogicType.NOT,
        operand: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
      } satisfies PredicateNotExpr

      const result = logicFactory.create(json)

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(LogicType.NOT)
      expect(result.raw).toBe(json)
      expect(result.properties.has('operand')).toBe(true)
    })

    it('should transform operand using real nodeFactory', () => {
      const json = {
        type: LogicType.NOT,
        operand: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['field'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
      } satisfies PredicateNotExpr

      const result = logicFactory.create(json)
      const operand = result.properties.get('operand')

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
            subject: { type: ExpressionType.REFERENCE, path: ['field'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
        } satisfies PredicateNotExpr,
      } satisfies PredicateNotExpr

      const result = logicFactory.create(json)
      const outerOperand = result.properties.get('operand')
      const innerOperand = outerOperand.properties.get('operand')

      expect(outerOperand.expressionType).toBe(LogicType.NOT)
      expect(innerOperand.expressionType).toBe(LogicType.TEST)
    })
  })

  describe('createPredicate - AND/OR/XOR', () => {
    it('should create an And predicate with multiple operands', () => {
      const json = {
        type: LogicType.AND,
        operands: [
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['field2'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
        ],
      } satisfies PredicateAndExpr

      const result = logicFactory.create(json)
      const operands = result.properties.get('operands')

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.expressionType).toBe(LogicType.AND)
      expect(result.raw).toBe(json)

      expect(result.properties.has('operands')).toBe(true)
      expect(Array.isArray(operands)).toBe(true)
      expect(operands).toHaveLength(2)
    })

    it('should transform each operand using real nodeFactory', () => {
      const json = {
        type: LogicType.AND,
        operands: [
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['field2'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
        ],
      } satisfies PredicateAndExpr

      const result = logicFactory.create(json)
      const operands = result.properties.get('operands')

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
            subject: { type: ExpressionType.REFERENCE, path: ['field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['field2'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
        ],
      } satisfies PredicateOrExpr

      const result = logicFactory.create(json)
      const operands = result.properties.get('operands')

      expect(result.expressionType).toBe(LogicType.OR)
      expect(operands).toHaveLength(2)
    })

    it('should create an Xor predicate with multiple operands', () => {
      const json = {
        type: LogicType.XOR,
        operands: [
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['field2'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
        ],
      } satisfies PredicateXorExpr

      const result = logicFactory.create(json)
      const operands = result.properties.get('operands')

      expect(result.expressionType).toBe(LogicType.XOR)
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
                subject: { type: ExpressionType.REFERENCE, path: ['field1'] },
                negate: false,
                condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
              } satisfies PredicateTestExpr,
              {
                type: LogicType.TEST,
                subject: { type: ExpressionType.REFERENCE, path: ['field1'] },
                negate: false,
                condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
              } satisfies PredicateTestExpr,
            ],
          } satisfies PredicateAndExpr,
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['field2'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
        ],
      } satisfies PredicateAndExpr

      const result = logicFactory.create(json)
      const operands = result.properties.get('operands')

      expect(operands[0].expressionType).toBe(LogicType.AND)
      expect(operands[1].expressionType).toBe(LogicType.TEST)
    })

    it('should handle mixed operand types', () => {
      const json = {
        type: LogicType.AND,
        operands: [
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['field1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
          } satisfies PredicateTestExpr,
          {
            type: LogicType.NOT,
            operand: {
              type: LogicType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['field2'] },
              negate: false,
              condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
            } satisfies PredicateTestExpr,
          } satisfies PredicateNotExpr,
          {
            type: LogicType.OR,
            operands: [
              {
                type: LogicType.TEST,
                subject: { type: ExpressionType.REFERENCE, path: ['field3'] },
                negate: false,
                condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
              } satisfies PredicateTestExpr,
              {
                type: LogicType.TEST,
                subject: { type: ExpressionType.REFERENCE, path: ['field3'] },
                negate: false,
                condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
              } satisfies PredicateTestExpr,
            ],
          } satisfies PredicateOrExpr,
        ],
      } satisfies PredicateAndExpr

      const result = logicFactory.create(json)
      const operands = result.properties.get('operands')

      expect(operands).toHaveLength(3)

      expect(operands[0].expressionType).toBe(LogicType.TEST)
      expect(operands[1].expressionType).toBe(LogicType.NOT)
      expect(operands[2].expressionType).toBe(LogicType.OR)
    })
  })
})
