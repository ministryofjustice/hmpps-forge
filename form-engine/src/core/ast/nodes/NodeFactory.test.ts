import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType, LogicType, StructureType, TransitionType } from '@form-engine/form/types/enums'
import {
  AccessTransition,
  CollectionExpr,
  ConditionalExpr,
  ConditionFunctionExpr,
  EffectFunctionExpr,
  LoadTransition,
  NextExpr,
  PipelineExpr,
  PredicateAndExpr,
  PredicateNotExpr,
  PredicateOrExpr,
  PredicateTestExpr,
  PredicateXorExpr,
  ReferenceExpr,
  ValidatingTransition,
  ValueExpr,
} from '@form-engine/form/types/expressions.type'
import {
  BlockDefinition,
  FieldBlockDefinition,
  JourneyDefinition,
  StepDefinition,
  ValidationExpr,
} from '@form-engine/form/types/structures.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import UnknownNodeTypeError from '@form-engine/errors/UnknownNodeTypeError'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import {
  AndPredicateASTNode,
  ConditionalASTNode,
  ExpressionASTNode,
  FunctionASTNode,
  PipelineASTNode,
  PredicateASTNode,
  TransitionASTNode,
} from '@form-engine/core/types/expressions.type'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { NodeFactory } from './NodeFactory'

describe('NodeFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
  })

  describe('createNode - Routing', () => {
    describe('Structure nodes', () => {
      it('should route Journey definitions to StructureNodeFactory', () => {
        const json = {
          type: StructureType.JOURNEY,
          code: 'test-journey',
          path: 'test-journey',
          title: 'Test Journey',
          steps: [] as StepDefinition[],
        } satisfies JourneyDefinition

        const result = nodeFactory.createNode(json) as JourneyASTNode

        expect(result.type).toBe(ASTNodeType.JOURNEY)
        expect(result.id).toBeDefined()
        expect(result.properties.title).toBe('Test Journey')
      })

      it('should route Step definitions to StructureNodeFactory', () => {
        const json = {
          type: StructureType.STEP,
          path: 'test-step',
          blocks: [] as BlockDefinition[],
          title: 'test-step',
        } satisfies StepDefinition

        const result = nodeFactory.createNode(json) as StepASTNode

        expect(result.type).toBe(ASTNodeType.STEP)
        expect(result.id).toBeDefined()
        expect(result.properties.path).toBe('test-step')
      })

      it('should route Block definitions to StructureNodeFactory', () => {
        const json = {
          type: StructureType.BLOCK,
          variant: 'TestBlock',
        } satisfies BlockDefinition

        const result = nodeFactory.createNode(json)

        expect(result.type).toBe(ASTNodeType.BLOCK)
        expect(result.id).toBeDefined()
      })
    })

    describe('Logic nodes', () => {
      it('should route Conditional expressions to LogicNodeFactory', () => {
        const json = {
          type: LogicType.CONDITIONAL,
          predicate: {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['field'] } satisfies ReferenceExpr,
            negate: false,
            condition: {
              type: FunctionType.CONDITION,
              name: 'IsTrue',
              arguments: [] as ValueExpr[],
            } satisfies ConditionFunctionExpr,
          } satisfies PredicateTestExpr,
          thenValue: 'yes',
          elseValue: 'no',
        } satisfies ConditionalExpr

        const result = nodeFactory.createNode(json) as ExpressionASTNode

        expect(result.type).toBe(ASTNodeType.EXPRESSION)
        expect(result.expressionType).toBe(LogicType.CONDITIONAL)
        expect(result.id).toBeDefined()
      })

      it('should route Test predicates to LogicNodeFactory', () => {
        const json = {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['field'] } satisfies ReferenceExpr,
          negate: false,
          condition: {
            type: FunctionType.CONDITION,
            name: 'IsTrue',
            arguments: [] as ValueExpr[],
          } satisfies ConditionFunctionExpr,
        } satisfies PredicateTestExpr

        const result = nodeFactory.createNode(json) as PredicateASTNode

        expect(result.type).toBe(ASTNodeType.EXPRESSION)
        expect(result.expressionType).toBe(LogicType.TEST)
        expect(result.id).toBeDefined()
      })

      it('should route And predicates to LogicNodeFactory', () => {
        const json = {
          type: LogicType.AND,
          operands: [
            {
              type: LogicType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['field1'] } satisfies ReferenceExpr,
              condition: {
                type: FunctionType.CONDITION,
                name: 'IsTrue',
                arguments: [] as ValueExpr[],
              } satisfies ConditionFunctionExpr,
              negate: false,
            } satisfies PredicateTestExpr,
            {
              type: LogicType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['field2'] } satisfies ReferenceExpr,
              condition: {
                type: FunctionType.CONDITION,
                name: 'IsTrue',
                arguments: [] as ValueExpr[],
              } satisfies ConditionFunctionExpr,
              negate: false,
            } satisfies PredicateTestExpr,
          ],
        } satisfies PredicateAndExpr

        const result = nodeFactory.createNode(json) as PredicateASTNode

        expect(result.expressionType).toBe(LogicType.AND)
      })

      it('should route Or predicates to LogicNodeFactory', () => {
        const json = {
          type: LogicType.OR,
          operands: [
            {
              type: LogicType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['field1'] } satisfies ReferenceExpr,
              negate: false,
              condition: {
                type: FunctionType.CONDITION,
                name: 'IsTrue',
                arguments: [] as ValueExpr[],
              } satisfies ConditionFunctionExpr,
            } satisfies PredicateTestExpr,
            {
              type: LogicType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['field2'] } satisfies ReferenceExpr,
              negate: false,
              condition: {
                type: FunctionType.CONDITION,
                name: 'IsTrue',
                arguments: [] as ValueExpr[],
              } satisfies ConditionFunctionExpr,
            } satisfies PredicateTestExpr,
          ],
        } satisfies PredicateOrExpr

        const result = nodeFactory.createNode(json) as PredicateASTNode

        expect(result.expressionType).toBe(LogicType.OR)
      })

      it('should route Xor predicates to LogicNodeFactory', () => {
        const json = {
          type: LogicType.XOR,
          operands: [
            {
              type: LogicType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['field1'] } satisfies ReferenceExpr,
              negate: false,
              condition: {
                type: FunctionType.CONDITION,
                name: 'IsTrue',
                arguments: [] as ValueExpr[],
              } satisfies ConditionFunctionExpr,
            } satisfies PredicateTestExpr,
            {
              type: LogicType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['field2'] } satisfies ReferenceExpr,
              negate: false,
              condition: {
                type: FunctionType.CONDITION,
                name: 'IsTrue',
                arguments: [] as ValueExpr[],
              } satisfies ConditionFunctionExpr,
            } satisfies PredicateTestExpr,
          ],
        } satisfies PredicateXorExpr

        const result = nodeFactory.createNode(json) as PredicateASTNode

        expect(result.expressionType).toBe(LogicType.XOR)
      })

      it('should route Not predicates to LogicNodeFactory', () => {
        const json = {
          type: LogicType.NOT,
          operand: {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['field'] } satisfies ReferenceExpr,
            negate: false,
            condition: {
              type: FunctionType.CONDITION,
              name: 'IsTrue',
              arguments: [] as ValueExpr[],
            } satisfies ConditionFunctionExpr,
          } satisfies PredicateTestExpr,
        } satisfies PredicateNotExpr

        const result = nodeFactory.createNode(json) as PredicateASTNode

        expect(result.expressionType).toBe(LogicType.NOT)
      })
    })

    describe('Expression nodes', () => {
      it('should route Reference expressions to ExpressionNodeFactory', () => {
        const json = {
          type: ExpressionType.REFERENCE,
          path: ['field'],
        } satisfies ReferenceExpr

        const result = nodeFactory.createNode(json) as PredicateASTNode

        expect(result.type).toBe(ASTNodeType.EXPRESSION)
        expect(result.expressionType).toBe(ExpressionType.REFERENCE)
        expect(result.id).toBeDefined()
      })

      it('should route Pipeline expressions to ExpressionNodeFactory', () => {
        const json = {
          type: ExpressionType.PIPELINE,
          input: { type: ExpressionType.REFERENCE, path: ['value'] } satisfies ReferenceExpr,
          steps: [{ type: FunctionType.TRANSFORMER, name: 'trim', arguments: [] as ValueExpr[] as any }],
        } satisfies PipelineExpr

        const result = nodeFactory.createNode(json) as PredicateASTNode

        expect(result.expressionType).toBe(ExpressionType.PIPELINE)
      })

      it('should route Collection expressions to ExpressionNodeFactory', () => {
        const json = {
          type: ExpressionType.COLLECTION,
          collection: { type: ExpressionType.REFERENCE, path: ['items'] } satisfies ReferenceExpr,
          template: [] as BlockDefinition[],
        } satisfies CollectionExpr<BlockDefinition>

        const result = nodeFactory.createNode(json) as PredicateASTNode

        expect(result.expressionType).toBe(ExpressionType.COLLECTION)
      })

      it('should route Validation expressions to ExpressionNodeFactory', () => {
        const json = {
          type: ExpressionType.VALIDATION,
          message: 'Required',
          when: {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['test'] } satisfies ReferenceExpr,
            negate: false,
            condition: {
              type: FunctionType.CONDITION,
              name: 'IsTrue',
              arguments: [] as ValueExpr[],
            } satisfies ConditionFunctionExpr,
          } satisfies PredicateTestExpr,
        } satisfies ValidationExpr

        const result = nodeFactory.createNode(json) as PredicateASTNode

        expect(result.expressionType).toBe(ExpressionType.VALIDATION)
      })

      it('should route Function expressions to ExpressionNodeFactory', () => {
        const json = {
          type: FunctionType.CONDITION,
          name: 'IsTrue',
          arguments: [] as ValueExpr[],
        } satisfies ConditionFunctionExpr

        const result = nodeFactory.createNode(json) as PredicateASTNode

        expect(result.expressionType).toBe(FunctionType.CONDITION)
      })
    })

    describe('Transition nodes', () => {
      it('should route Load transitions to TransitionNodeFactory', () => {
        const json = {
          type: TransitionType.LOAD,
          effects: [] as EffectFunctionExpr[],
        } satisfies LoadTransition

        const result = nodeFactory.createNode(json) as TransitionASTNode

        expect(result.type).toBe(ASTNodeType.TRANSITION)
        expect(result.transitionType).toBe(TransitionType.LOAD)
        expect(result.id).toBeDefined()
      })

      it('should route Access transitions to TransitionNodeFactory', () => {
        const json = {
          type: TransitionType.ACCESS,
        } satisfies AccessTransition

        const result = nodeFactory.createNode(json) as TransitionASTNode

        expect(result.transitionType).toBe(TransitionType.ACCESS)
      })

      it('should route Submit transitions to TransitionNodeFactory', () => {
        const json = {
          type: TransitionType.SUBMIT,
          validate: true,
          onValid: {
            next: [] as NextExpr[],
          },
          onInvalid: {
            next: [] as NextExpr[],
          },
        } satisfies ValidatingTransition

        const result = nodeFactory.createNode(json) as TransitionASTNode

        expect(result.transitionType).toBe(TransitionType.SUBMIT)
      })
    })
  })

  describe('createNode - Error Handling', () => {
    it('should throw InvalidNodeError for null input', () => {
      expect(() => nodeFactory.createNode(null)).toThrow(InvalidNodeError)
    })

    it('should throw InvalidNodeError for undefined input', () => {
      expect(() => nodeFactory.createNode(undefined)).toThrow(InvalidNodeError)
    })

    it('should throw InvalidNodeError for string input', () => {
      expect(() => nodeFactory.createNode('not an object')).toThrow(InvalidNodeError)
    })

    it('should throw InvalidNodeError for number input', () => {
      expect(() => nodeFactory.createNode(42)).toThrow(InvalidNodeError)
    })

    it('should throw InvalidNodeError for boolean input', () => {
      expect(() => nodeFactory.createNode(true)).toThrow(InvalidNodeError)
    })

    it('should throw InvalidNodeError with correct error details', () => {
      try {
        nodeFactory.createNode('string')
        fail('Should have thrown InvalidNodeError')
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidNodeError)
        expect((error as InvalidNodeError).expected).toBe('object')
        expect((error as InvalidNodeError).actual).toBe('string')
      }
    })

    it('should throw UnknownNodeTypeError for invalid type', () => {
      const json = {
        type: 'InvalidType',
      }

      expect(() => nodeFactory.createNode(json)).toThrow(UnknownNodeTypeError)
    })

    it('should throw UnknownNodeTypeError for object without type', () => {
      const json = {
        someProperty: 'value',
      }

      expect(() => nodeFactory.createNode(json)).toThrow(UnknownNodeTypeError)
    })

    it('should throw UnknownNodeTypeError with correct error details', () => {
      const json = {
        type: 'InvalidType',
        someData: 'value',
      }

      try {
        nodeFactory.createNode(json)
        fail('Should have thrown UnknownNodeTypeError')
      } catch (error) {
        expect(error).toBeInstanceOf(UnknownNodeTypeError)
        expect((error as UnknownNodeTypeError).nodeType).toBe('InvalidType')
      }
    })
  })

  describe('transformValue', () => {
    describe('Primitive values', () => {
      it('should preserve null', () => {
        expect(nodeFactory.transformValue(null)).toBeNull()
      })

      it('should preserve undefined', () => {
        expect(nodeFactory.transformValue(undefined)).toBeUndefined()
      })

      it('should preserve strings', () => {
        expect(nodeFactory.transformValue('test')).toBe('test')
      })

      it('should preserve numbers', () => {
        expect(nodeFactory.transformValue(42)).toBe(42)
        expect(nodeFactory.transformValue(3.14)).toBe(3.14)
        expect(nodeFactory.transformValue(0)).toBe(0)
        expect(nodeFactory.transformValue(-10)).toBe(-10)
      })

      it('should preserve booleans', () => {
        expect(nodeFactory.transformValue(true)).toBe(true)
        expect(nodeFactory.transformValue(false)).toBe(false)
      })
    })

    describe('Arrays', () => {
      it('should preserve array of primitives', () => {
        const arr = ['a', 'b', 'c']

        const result = nodeFactory.transformValue(arr)

        expect(Array.isArray(result)).toBe(true)
        expect(result).toEqual(['a', 'b', 'c'])
      })

      it('should transform array of nodes', () => {
        const arr = [
          { type: ExpressionType.REFERENCE, path: ['field1'] },
          { type: ExpressionType.REFERENCE, path: ['field2'] },
        ]

        const result = nodeFactory.transformValue(arr)

        expect(Array.isArray(result)).toBe(true)
        expect(result).toHaveLength(2)

        result.forEach((item: any) => {
          expect(item).toHaveProperty('id')
          expect(item).toHaveProperty('type')
          expect(item.type).toBe(ASTNodeType.EXPRESSION)
        })
      })

      it('should transform mixed array of nodes and primitives', () => {
        const arr = ['literal', { type: ExpressionType.REFERENCE, path: ['field'] }, 42]

        const result = nodeFactory.transformValue(arr)

        expect(result[0]).toBe('literal')
        expect(result[1]).toHaveProperty('id')
        expect(result[1].type).toBe(ASTNodeType.EXPRESSION)
        expect(result[2]).toBe(42)
      })

      it('should handle empty arrays', () => {
        const result = nodeFactory.transformValue([])

        expect(Array.isArray(result)).toBe(true)
        expect(result).toHaveLength(0)
      })

      it('should handle nested arrays', () => {
        const arr = [
          ['a', 'b'],
          ['c', 'd'],
        ]

        const result = nodeFactory.transformValue(arr)

        expect(result).toEqual([
          ['a', 'b'],
          ['c', 'd'],
        ])
      })
    })

    describe('Node detection and transformation', () => {
      it('should transform Reference expressions', () => {
        const json = {
          type: ExpressionType.REFERENCE,
          path: ['field'],
        }

        const result = nodeFactory.transformValue(json)

        expect(result).toHaveProperty('id')
        expect(result).toHaveProperty('type')
        expect(result.type).toBe(ASTNodeType.EXPRESSION)
        expect(result.expressionType).toBe(ExpressionType.REFERENCE)
      })

      it('should transform Validation expressions', () => {
        const json = {
          type: ExpressionType.VALIDATION,
          when: {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['@self'] },
            negate: true,
            condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] as ValueExpr[] },
          },
          message: 'Required',
        }

        const result = nodeFactory.transformValue(json)

        expect(result.type).toBe(ASTNodeType.EXPRESSION)
        expect(result.expressionType).toBe(ExpressionType.VALIDATION)
      })

      it('should transform Conditional expressions', () => {
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
        }

        const result = nodeFactory.transformValue(json)

        expect(result.type).toBe(ASTNodeType.EXPRESSION)
        expect(result.expressionType).toBe(LogicType.CONDITIONAL)
      })

      it('should transform Block structures', () => {
        const json = {
          type: StructureType.BLOCK,
          variant: 'TestBlock',
        }

        const result = nodeFactory.transformValue(json)

        expect(result.type).toBe(ASTNodeType.BLOCK)
      })

      it('should transform Transition nodes', () => {
        const json = {
          type: TransitionType.LOAD,
          effects: [] as EffectFunctionExpr[],
        } satisfies LoadTransition

        const result = nodeFactory.transformValue(json)

        expect(result.type).toBe(ASTNodeType.TRANSITION)
        expect(result.transitionType).toBe(TransitionType.LOAD)
      })

      it('should not transform plain objects', () => {
        const obj = {
          name: 'test',
          value: 42,
        }

        const result = nodeFactory.transformValue(obj)

        expect(result).not.toHaveProperty('id')
        expect(result).toEqual({
          name: 'test',
          value: 42,
        })
      })

      it('should not transform objects with type but no matching typeguard', () => {
        const obj = {
          type: 'CustomType',
          data: 'value',
        }

        const result = nodeFactory.transformValue(obj)

        expect(result).not.toHaveProperty('id')
        expect(result).toEqual({
          type: 'CustomType',
          data: 'value',
        })
      })
    })

    describe('Recursive transformation', () => {
      it('should recursively transform nested objects with nodes', () => {
        const obj = {
          metadata: {
            author: 'Test',
          },
          condition: {
            type: ExpressionType.REFERENCE,
            path: ['field'],
          },
        }

        const result = nodeFactory.transformValue(obj)

        expect(result.metadata).toEqual({ author: 'Test' })
        expect(result.condition).toHaveProperty('id')
        expect(result.condition.type).toBe(ASTNodeType.EXPRESSION)
      })

      it('should recursively transform deeply nested structures', () => {
        const obj = {
          level1: {
            level2: {
              level3: {
                node: {
                  type: ExpressionType.REFERENCE,
                  path: ['field'],
                },
              },
            },
          },
        }

        const result = nodeFactory.transformValue(obj)

        expect(result.level1.level2.level3.node).toHaveProperty('id')
        expect(result.level1.level2.level3.node.type).toBe(ASTNodeType.EXPRESSION)
      })

      it('should handle complex nested structures with arrays and objects', () => {
        const obj = {
          items: [
            {
              name: 'item1',
              condition: {
                type: ExpressionType.REFERENCE,
                path: ['field1'],
              },
            },
            {
              name: 'item2',
              condition: {
                type: ExpressionType.REFERENCE,
                path: ['field2'],
              },
            },
          ],
        }

        const result = nodeFactory.transformValue(obj)

        expect(result.items[0].name).toBe('item1')
        expect(result.items[0].condition).toHaveProperty('id')
        expect(result.items[0].condition.type).toBe(ASTNodeType.EXPRESSION)

        expect(result.items[1].name).toBe('item2')
        expect(result.items[1].condition).toHaveProperty('id')
        expect(result.items[1].condition.type).toBe(ASTNodeType.EXPRESSION)
      })
    })

    describe('Edge cases', () => {
      it('should handle empty objects', () => {
        const result = nodeFactory.transformValue({})

        expect(result).toEqual({})
      })

      it('should handle objects with null properties', () => {
        const obj = {
          name: 'test',
          value: null,
        } as any

        const result = nodeFactory.transformValue(obj)

        expect(result).toEqual({
          name: 'test',
          value: null,
        })
      })

      it('should handle objects with undefined properties', () => {
        const obj = {
          name: 'test',
          value: undefined,
        } as any

        const result = nodeFactory.transformValue(obj)

        expect(result.value).toBeUndefined()
      })

      it('should handle arrays with null elements', () => {
        const arr = ['a', null, 'b']

        const result = nodeFactory.transformValue(arr)

        expect(result).toEqual(['a', null, 'b'])
      })

      it('should handle arrays with undefined elements', () => {
        const arr = ['a', undefined, 'b']

        const result = nodeFactory.transformValue(arr)

        expect(result[1]).toBeUndefined()
      })
    })
  })

  describe('Integration - Complex transformations', () => {
    it('should transform a complete Journey with nested structures', () => {
      const json = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        path: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            type: StructureType.STEP,
            path: 'step1',
            title: 'step1',
            blocks: [
              {
                type: StructureType.BLOCK,
                variant: 'TextInput',
                code: 'email',
                validate: [
                  {
                    type: ExpressionType.VALIDATION,
                    when: {
                      type: LogicType.TEST,
                      subject: { type: ExpressionType.REFERENCE, path: ['@self'] },
                      negate: true,
                      condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] as ValueExpr[] },
                    },
                    message: 'Email is required',
                  },
                ],
              } as FieldBlockDefinition,
            ],
            onSubmission: [
              {
                type: TransitionType.SUBMIT,
                validate: false,
                onAlways: {
                  effects: [] as EffectFunctionExpr[],
                  next: [] as NextExpr[],
                },
              },
            ],
          },
        ],
      } satisfies JourneyDefinition

      const result = nodeFactory.createNode(json) as JourneyASTNode

      expect(result.type).toBe(ASTNodeType.JOURNEY)

      const steps = result.properties.steps
      expect(steps).toHaveLength(1)
      expect(steps[0].type).toBe(ASTNodeType.STEP)

      const blocks = steps[0].properties.blocks
      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe(ASTNodeType.BLOCK)

      const validate = blocks[0].properties.validate
      expect(validate).toHaveLength(1)
      expect(validate[0].type).toBe(ASTNodeType.EXPRESSION)
      expect(validate[0].expressionType).toBe(ExpressionType.VALIDATION)

      const onSubmit = steps[0].properties.onSubmission
      expect(onSubmit).toHaveLength(1)
      expect(onSubmit[0].type).toBe(ASTNodeType.TRANSITION)
    })

    it('should transform nested conditionals with predicates', () => {
      const json = {
        type: LogicType.CONDITIONAL,
        predicate: {
          type: LogicType.AND,
          operands: [
            {
              type: LogicType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['field1'] } satisfies ReferenceExpr,
              negate: false,
              condition: {
                type: FunctionType.CONDITION,
                name: 'IsTrue',
                arguments: [] as ValueExpr[],
              } satisfies ConditionFunctionExpr,
            } satisfies PredicateTestExpr,
            {
              type: LogicType.NOT,
              operand: {
                type: LogicType.TEST,
                subject: { type: ExpressionType.REFERENCE, path: ['field2'] } satisfies ReferenceExpr,
                negate: false,
                condition: {
                  type: FunctionType.CONDITION,
                  name: 'IsTrue',
                  arguments: [] as ValueExpr[],
                } satisfies ConditionFunctionExpr,
              } satisfies PredicateTestExpr,
            } satisfies PredicateNotExpr,
          ],
        } satisfies PredicateAndExpr,
        thenValue: {
          type: ExpressionType.REFERENCE,
          path: ['result1'],
        } satisfies ReferenceExpr,
        elseValue: {
          type: ExpressionType.REFERENCE,
          path: ['result2'],
        } satisfies ReferenceExpr,
      } satisfies ConditionalExpr

      const result = nodeFactory.createNode(json) as ConditionalASTNode

      expect(result.expressionType).toBe(LogicType.CONDITIONAL)

      const predicate = result.properties.predicate as AndPredicateASTNode
      expect(predicate.expressionType).toBe(LogicType.AND)

      const operands = predicate.properties.operands
      expect(operands).toHaveLength(2)
      expect((operands[0] as ExpressionASTNode).expressionType).toBe(LogicType.TEST)
      expect((operands[1] as ExpressionASTNode).expressionType).toBe(LogicType.NOT)

      const thenValue = result.properties.thenValue
      expect(thenValue.type).toBe(ASTNodeType.EXPRESSION)
      expect(thenValue.expressionType).toBe(ExpressionType.REFERENCE)

      const elseValue = result.properties.elseValue
      expect(elseValue.type).toBe(ASTNodeType.EXPRESSION)
      expect(elseValue.expressionType).toBe(ExpressionType.REFERENCE)
    })

    it('should transform Pipeline with nested expressions', () => {
      const json = {
        type: ExpressionType.PIPELINE,
        input: {
          type: ExpressionType.REFERENCE,
          path: ['user', 'name'],
        },
        steps: [
          {
            type: FunctionType.TRANSFORMER,
            name: 'replace',
            arguments: ['old', { type: ExpressionType.REFERENCE, path: ['replacement'] }],
          },
        ],
      }

      const result = nodeFactory.createNode(json) as PipelineASTNode

      expect(result.expressionType).toBe(ExpressionType.PIPELINE)

      const input = result.properties.input
      expect(input.type).toBe(ASTNodeType.EXPRESSION)
      expect(input.expressionType).toBe(ExpressionType.REFERENCE)

      const steps = result.properties.steps as FunctionASTNode[]
      expect(steps[0].properties.arguments[0]).toBe('old')
      expect(steps[0].properties.arguments[1].type).toBe(ASTNodeType.EXPRESSION)
    })
  })

  describe('ID Generation', () => {
    it('should generate unique IDs for each node', () => {
      const json1 = {
        type: ExpressionType.REFERENCE,
        path: ['field1'],
      }

      const json2 = {
        type: ExpressionType.REFERENCE,
        path: ['field2'],
      }

      const result1 = nodeFactory.createNode(json1)
      const result2 = nodeFactory.createNode(json2)

      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })

    it('should share ID generator across all sub-factories', () => {
      const ref = nodeFactory.createNode({
        type: ExpressionType.REFERENCE,
        path: ['field'],
      } satisfies ReferenceExpr)

      const block = nodeFactory.createNode({
        type: StructureType.BLOCK,
        variant: 'Test',
      } satisfies BlockDefinition)

      const transition = nodeFactory.createNode({
        type: TransitionType.LOAD,
        effects: [] as EffectFunctionExpr[],
      } satisfies LoadTransition)

      // All IDs should be unique
      expect(ref.id).toBeDefined()
      expect(block.id).toBeDefined()
      expect(transition.id).toBeDefined()

      const ids = new Set([ref.id, block.id, transition.id])
      expect(ids.size).toBe(3)
    })
  })
})
