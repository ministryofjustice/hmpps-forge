import { StructureType, ExpressionType, LogicType, FunctionType, TransitionType } from '@form-engine/form/types/enums'
import UnknownNodeTypeError from '@form-engine/errors/UnknownNodeTypeError'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { ASTNode } from '@form-engine/core/types/engine.type'
import {
  isNode,
  transformNode,
  transformProperties,
  transformToAst,
  transformValue,
} from '@form-engine/core/ast/transformer/transformToAst'

describe('ASTTransformer', () => {
  describe('transform()', () => {
    it('should transform a valid schema', () => {
      const journey = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        title: 'Test Journey',
        steps: [] as any[],
      }

      const result = transformToAst(journey)

      expect(result).toMatchObject({
        type: ASTNodeType.JOURNEY,
      })
      expect(result.raw).toBe(journey)
    })

    it('should transform without source path', () => {
      const step = {
        type: StructureType.STEP,
        path: '/step1',
        blocks: [] as any[],
      }

      const result = transformToAst(step)

      expect(result).toMatchObject({
        type: ASTNodeType.STEP,
      })
    })

    it('should throw InvalidNodeError for non-object input', () => {
      expect(() => transformToAst('not an object')).toThrow(InvalidNodeError)
      expect(() => transformToAst(123)).toThrow(InvalidNodeError)
      expect(() => transformToAst(null)).toThrow(InvalidNodeError)
      expect(() => transformToAst(undefined)).toThrow(InvalidNodeError)
    })

    it('should throw UnknownNodeTypeError for unknown node types', () => {
      const unknownNode = {
        type: 'UnknownType',
        someProperty: 'value',
      }

      expect(() => transformToAst(unknownNode)).toThrow(UnknownNodeTypeError)
    })

    it('should handle empty objects', () => {
      const emptyStep = {
        type: StructureType.STEP,
        path: '/empty',
        blocks: [] as any[],
      }

      const result = transformToAst(emptyStep) as StepASTNode

      expect(result.type).toBe(ASTNodeType.STEP)
      const blocks = result.properties.get('blocks') as any[]
      expect(blocks).toEqual([])
    })

    it('should handle objects with many properties', () => {
      const largeObject = {
        type: StructureType.JOURNEY,
        code: 'test',
        title: 'Test',
        ...Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`property${i}`, `value${i}`])),
      }

      const result = transformToAst(largeObject) as JourneyASTNode

      expect(result.properties.size).toBeGreaterThan(100)
      expect(result.properties.get('property50')).toBe('value50')
    })

    it('should preserve metadata in all transformations', () => {
      const journey = {
        type: StructureType.JOURNEY,
        code: 'test',
        title: 'Test',
        metadata: {
          version: '1.0',
          author: 'test',
        },
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            blocks: [] as any[],
            metadata: { stepNumber: 1 },
          },
        ],
      }

      const result = transformToAst(journey) as JourneyASTNode

      expect(result.raw).toBe(journey)
      expect(result.properties.get('metadata')).toEqual({
        version: '1.0',
        author: 'test',
      })

      const steps = result.properties.get('steps') as ASTNode[]
      expect(steps[0].raw).toBe(journey.steps[0])
    })

    it('should handle complex real-world form configuration', () => {
      const complexForm = {
        type: StructureType.JOURNEY,
        code: 'complex-assessment',
        title: 'Complex Assessment',
        description: 'A comprehensive assessment journey',
        version: '2.0',
        controller: 'assessmentController',
        onLoad: [
          {
            type: TransitionType.LOAD,
            effects: [
              { type: FunctionType.EFFECT, name: 'loadUserData', arguments: [] as any[] },
              { type: FunctionType.EFFECT, name: 'loadAssessmentData', arguments: [] as any[] },
            ],
          },
        ],
        onAccess: [
          {
            type: TransitionType.ACCESS,
            guards: {
              type: LogicType.AND,
              operands: [
                {
                  type: LogicType.TEST,
                  subject: { type: ExpressionType.REFERENCE, path: ['data', 'authenticated'] },
                  negate: false,
                  condition: { type: FunctionType.CONDITION, name: 'equals', arguments: [true] as any[] },
                },
                {
                  type: LogicType.TEST,
                  subject: { type: ExpressionType.REFERENCE, path: ['data', 'hasPermission'] },
                  negate: false,
                  condition: { type: FunctionType.CONDITION, name: 'equals', arguments: [true] as any[] },
                },
              ],
            },
            effects: [{ type: FunctionType.EFFECT, name: 'trackAccess', arguments: [] as any[] }],
            redirect: [{ type: ExpressionType.NEXT, goto: '/unauthorized' }],
          },
        ],
        steps: [
          {
            type: StructureType.STEP,
            path: '/personal-info',
            blocks: [
              {
                type: StructureType.BLOCK,
                variant: 'fieldset',
                blocks: [
                  {
                    type: StructureType.BLOCK,
                    variant: 'text',
                    code: 'firstName',
                    label: 'First Name',
                    validate: [
                      {
                        type: ExpressionType.VALIDATION,
                        when: {
                          type: LogicType.TEST,
                          subject: { type: ExpressionType.REFERENCE, path: ['@self'] },
                          negate: true,
                          condition: { type: FunctionType.CONDITION, name: 'isRequired', arguments: [] as any[] },
                        },
                        message: 'First name is required',
                      },
                    ],
                  },
                  {
                    type: StructureType.BLOCK,
                    variant: 'text',
                    code: 'lastName',
                    label: 'Last Name',
                    validate: [
                      {
                        type: ExpressionType.VALIDATION,
                        when: {
                          type: LogicType.TEST,
                          subject: { type: ExpressionType.REFERENCE, path: ['@self'] },
                          negate: true,
                          condition: { type: FunctionType.CONDITION, name: 'isRequired', arguments: [] as any[] },
                        },
                        message: 'Last name is required',
                      },
                    ],
                  },
                ],
              },
              {
                type: StructureType.BLOCK,
                variant: 'html',
                content: '<p>Addresses will appear here</p>',
              },
            ],
            onSubmission: [
              {
                type: TransitionType.SUBMIT,
                validate: true,
                onValid: {
                  effects: [{ type: FunctionType.EFFECT, name: 'save', arguments: [] as any[] }],
                  next: [{ type: ExpressionType.NEXT, goto: '/next-step' }],
                },
                onInvalid: {
                  next: [{ type: ExpressionType.NEXT, goto: '@self' }],
                },
              },
            ],
          },
        ],
        children: [
          {
            type: StructureType.JOURNEY,
            code: 'sub-assessment',
            title: 'Sub Assessment',
            steps: [] as any[],
          },
        ],
      }

      const result = transformToAst(complexForm) as JourneyASTNode

      expect(result).toBeDefined()
      expect(result.type).toBe(ASTNodeType.JOURNEY)
      expect(result.properties).toBeInstanceOf(Map)
      expect(result.properties.get('code')).toBe('complex-assessment')
      expect(result.properties.get('title')).toBe('Complex Assessment')
      expect(result.raw).toBe(complexForm)
    })
  })

  describe('transformNode()', () => {
    it('should route node types to appropriate transformers', () => {
      const journey = {
        type: StructureType.JOURNEY,
        code: 'test',
        title: 'Test',
      }

      const result = transformNode(journey, ['test'])
      expect(result.type).toBe(ASTNodeType.JOURNEY)
    })

    it('should throw InvalidNodeError for invalid inputs', () => {
      expect(() => transformNode(null, ['test'])).toThrow(InvalidNodeError)
      expect(() => transformNode('string', ['test'])).toThrow(InvalidNodeError)
      expect(() => transformNode(123, ['test'])).toThrow(InvalidNodeError)
    })

    it('should throw UnknownNodeTypeError for unknown types', () => {
      const unknown = {
        type: 'UnknownStructure',
        data: 'test',
      }

      expect(() => transformNode(unknown, ['test'])).toThrow(UnknownNodeTypeError)
    })
  })

  describe('transformProperties()', () => {
    it('should transform object properties into a Map', () => {
      const obj = {
        code: 'test',
        title: 'Test',
        steps: [
          {
            type: StructureType.STEP,
            path: '/step1',
            blocks: [] as any[],
          },
        ],
        metadata: {
          version: '1.0',
          author: 'test',
        },
      }

      const result = transformProperties(obj, ['test'])

      expect(result).toBeInstanceOf(Map)
      expect(result.get('code')).toBe('test')
      expect(result.get('title')).toBe('Test')

      const steps = result.get('steps') as ASTNode[]
      expect(steps).toHaveLength(1)
      expect(steps[0]).toMatchObject({
        type: ASTNodeType.STEP,
      })

      const metadata = result.get('metadata') as any
      expect(metadata).toEqual({
        version: '1.0',
        author: 'test',
      })
    })

    it('should handle empty objects', () => {
      const result = transformProperties({}, ['test'])
      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
    })
  })

  describe('transformValue()', () => {
    it('should handle null and undefined', () => {
      expect(transformValue(null, ['test'])).toBeNull()
      expect(transformValue(undefined, ['test'])).toBeUndefined()
    })

    it('should handle primitive values', () => {
      expect(transformValue('hello', ['test'])).toBe('hello')
      expect(transformValue(42, ['test'])).toBe(42)
      expect(transformValue(true, ['test'])).toBe(true)
      expect(transformValue(false, ['test'])).toBe(false)
    })

    it('should transform arrays with mixed content', () => {
      const mixedArray = [
        'string',
        42,
        true,
        null,
        { type: StructureType.STEP, path: '/step', blocks: [] as any[] },
        { plain: 'object' },
        ['nested', 'array'],
      ]

      const result = transformValue(mixedArray, ['test']) as any[]

      expect(result).toHaveLength(7)
      expect(result[0]).toBe('string')
      expect(result[1]).toBe(42)
      expect(result[2]).toBe(true)
      expect(result[3]).toBeNull()
      expect(result[4]).toMatchObject({
        type: ASTNodeType.STEP,
      })
      expect(result[5]).toEqual({ plain: 'object' })
      expect(result[6]).toEqual(['nested', 'array'])
    })

    it('should transform nested objects with nodes', () => {
      const nestedObject = {
        plainProperty: 'value',
        nodeProperty: {
          type: ExpressionType.REFERENCE,
          path: ['test'],
        },
        deeplyNested: {
          level1: {
            level2: {
              type: FunctionType.CONDITION,
              name: 'test',
              arguments: [] as any[],
            },
          },
        },
      }

      const result = transformValue(nestedObject, ['test']) as any

      expect(result.plainProperty).toBe('value')
      expect(result.nodeProperty).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: 'ExpressionType.Reference',
      })
      expect(result.deeplyNested.level1.level2).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: FunctionType.CONDITION,
      })
    })

    it('should handle deeply nested arrays with nodes', () => {
      const deepArray = [
        [
          [
            {
              type: ExpressionType.REFERENCE,
              path: ['deep', 'ref'],
            },
          ],
        ],
      ]

      const result = transformValue(deepArray, ['test']) as any[][][]

      expect(result[0][0][0]).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: 'ExpressionType.Reference',
      })
    })
  })

  describe('isNode()', () => {
    it('should identify valid nodes', () => {
      const journey = {
        type: StructureType.JOURNEY,
        code: 'test',
        title: 'Test',
      }

      const step = {
        type: StructureType.STEP,
        path: '/test',
        blocks: [] as any[],
      }

      const block = {
        type: StructureType.BLOCK,
        variant: 'text',
      }

      const expression = {
        type: ExpressionType.REFERENCE,
        path: ['test'],
      }

      const transition = {
        type: TransitionType.LOAD,
        effects: [] as any[],
      }

      expect(isNode(journey)).toBe(true)
      expect(isNode(step)).toBe(true)
      expect(isNode(block)).toBe(true)
      expect(isNode(expression)).toBe(true)
      expect(isNode(transition)).toBe(true)
    })

    it('should not identify non-nodes', () => {
      expect(isNode(null)).toBe(false)
      expect(isNode(undefined)).toBe(false)
      expect(isNode('string')).toBe(false)
      expect(isNode(123)).toBe(false)
      expect(isNode(true)).toBe(false)
      expect(isNode([])).toBe(false)
      expect(isNode({ noType: 'property' })).toBe(false)
      expect(isNode({ type: null })).toBe(false)
      expect(isNode({ type: 123 })).toBe(false)
      expect(isNode({ type: 'UnknownType' })).toBe(false)
    })
  })
})
