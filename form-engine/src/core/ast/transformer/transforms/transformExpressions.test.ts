import { ExpressionType, LogicType, FunctionType, StructureType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import {
  ConditionalASTNode,
  ExpressionASTNode,
  FunctionASTNode,
  PipelineASTNode,
  PredicateASTNode,
  ReferenceASTNode,
  ValidationASTNode,
} from '@form-engine/core/types/expressions.type'
import {
  transformExpression,
  transformReference,
  transformPipeline,
  transformConditional,
  transformValidation,
  transformPredicate,
  transformFunction,
  transformCollection,
} from './transformExpressions'

describe('Expression Transformations', () => {
  describe('transformReference()', () => {
    it('should transform a reference expression', () => {
      const reference = {
        type: ExpressionType.REFERENCE,
        path: ['answers', 'email'],
      }

      const result = transformReference(reference, ['test']) as ReferenceASTNode

      expect(result).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: 'ExpressionType.Reference',
      })
      expect(result.properties.get('path')).toEqual(['answers', 'email'])
    })

    it('should handle empty path array', () => {
      const reference = {
        type: ExpressionType.REFERENCE,
        path: [] as string[],
      }

      const result = transformReference(reference, ['test']) as ReferenceASTNode

      expect(result.properties.get('path')).toEqual([])
    })
  })

  describe('transformPipeline()', () => {
    it('should transform a pipeline expression with steps', () => {
      const pipeline = {
        type: ExpressionType.PIPELINE,
        input: { type: ExpressionType.REFERENCE, path: ['answers', 'name'] },
        steps: [{ name: 'trim' }, { name: 'toLowerCase' }, { name: 'capitalize', args: [true] }],
      }

      const result = transformPipeline(pipeline, ['test']) as PipelineASTNode

      expect(result).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: 'ExpressionType.Pipeline',
      })

      expect(result.properties.get('input')).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: 'ExpressionType.Reference',
      })

      expect(result.properties.get('steps')).toHaveLength(3)
      expect(result.properties.get('steps')[0]).toEqual({ name: 'trim', args: undefined })
      expect(result.properties.get('steps')[1]).toEqual({ name: 'toLowerCase', args: undefined })
      expect(result.properties.get('steps')[2]).toEqual({ name: 'capitalize', args: [true] })
    })
  })

  describe('transformCollection()', () => {
    it('should transform a collection expression with template and fallback', () => {
      const collection = {
        type: ExpressionType.COLLECTION,
        collection: { type: ExpressionType.REFERENCE, path: ['answers', 'items'] },
        template: [
          {
            type: StructureType.BLOCK,
            variant: 'text',
            code: 'item',
          },
        ],
        fallback: [
          {
            type: StructureType.BLOCK,
            variant: 'html',
            content: 'No items',
          },
        ],
      }

      const result = transformCollection(collection, ['test'])

      expect(result).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: ExpressionType.COLLECTION,
      })

      const collectionProp = result.properties.get('collection') as ReferenceASTNode
      expect(collectionProp).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: ExpressionType.REFERENCE,
      })

      const template = result.properties.get('template') as any[]
      expect(Array.isArray(template)).toBe(true)
      expect(template[0]).toMatchObject({ type: ASTNodeType.BLOCK, variant: 'text' })

      const fallback = result.properties.get('fallback') as any[]
      expect(Array.isArray(fallback)).toBe(true)
      expect(fallback[0]).toMatchObject({ type: ASTNodeType.BLOCK, variant: 'html' })
    })
  })

  describe('transformConditional()', () => {
    it('should transform a conditional expression', () => {
      const conditional = {
        type: LogicType.CONDITIONAL,
        predicate: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'hasChildren'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'equals', arguments: [true] as any[] },
        },
        thenValue: 'Show children fields',
        elseValue: 'Hide children fields',
      }

      const result = transformConditional(conditional, ['test']) as ConditionalASTNode

      expect(result).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: 'LogicType.Conditional',
      })

      expect(result.properties.get('predicate')).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: LogicType.TEST,
      })

      expect(result.properties.get('thenValue')).toBe('Show children fields')
      expect(result.properties.get('elseValue')).toBe('Hide children fields')
    })

    it('should handle missing then and else values', () => {
      const conditional = {
        type: LogicType.CONDITIONAL,
        predicate: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['@self'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'isRequired', arguments: [] as any[] },
        },
      }

      const result = transformConditional(conditional, ['test']) as ConditionalASTNode

      expect(result.properties.get('thenValue')).toBeUndefined()
      expect(result.properties.get('elseValue')).toBeUndefined()
    })
  })

  describe('transformValidation()', () => {
    it('should transform a validation expression', () => {
      const validation = {
        type: ExpressionType.VALIDATION,
        when: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['@self'] },
          negate: true,
          condition: { type: FunctionType.CONDITION, name: 'isEmail', arguments: [] as any[] },
        },
        message: 'Please enter a valid email',
        submissionOnly: true,
        details: { field: 'email', errorType: 'format' },
      }

      const result = transformValidation(validation, ['test']) as ValidationASTNode

      expect(result).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: 'ExpressionType.Validation',
      })
      expect(result.properties.get('message')).toBe('Please enter a valid email')
      expect(result.properties.get('submissionOnly')).toBe(true)
      expect(result.properties.get('details')).toEqual({ field: 'email', errorType: 'format' })

      expect(result.properties.get('when')).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: LogicType.TEST,
      })
    })

    it('should handle missing optional properties', () => {
      const validation = {
        type: ExpressionType.VALIDATION,
        when: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['@self'] },
          negate: true,
          condition: { type: FunctionType.CONDITION, name: 'isRequired', arguments: [] as any[] },
        },
        message: 'Required field',
      }

      const result = transformValidation(validation, ['test']) as ValidationASTNode

      expect(result.properties.get('message')).toBe('Required field')
      expect(result.properties.get('submissionOnly')).toBeUndefined()
      expect(result.properties.get('details')).toBeUndefined()
    })
  })

  describe('transformPredicate()', () => {
    it('should transform a TEST predicate', () => {
      const predicate = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['answers', 'age'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'greaterThan', arguments: [18] as any[] },
      }

      const result = transformPredicate(predicate, ['test']) as PredicateASTNode

      expect(result).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: LogicType.TEST,
      })

      expect(result.properties.get('subject')).toMatchObject({
        type: ASTNodeType.EXPRESSION,
      })

      expect(result.properties.get('condition')).toMatchObject({
        type: ASTNodeType.EXPRESSION,
      })
    })

    it('should transform an AND predicate', () => {
      const predicate = {
        type: LogicType.AND,
        operands: [
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'age'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'greaterThan', arguments: [18] as any[] },
          },
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'consent'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'equals', arguments: [true] as any[] },
          },
        ],
      }

      const result = transformPredicate(predicate, ['test']) as PredicateASTNode

      expect(result).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: LogicType.AND,
      })

      expect(result.properties.get('operands')).toHaveLength(2)
      expect(result.properties.get('operands')[0]).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: LogicType.TEST,
      })
    })

    it('should transform an OR predicate', () => {
      const predicate = {
        type: LogicType.OR,
        operands: [
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'option1'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'equals', arguments: [true] as any[] },
          },
          {
            type: LogicType.TEST,
            subject: { type: ExpressionType.REFERENCE, path: ['answers', 'option2'] },
            negate: false,
            condition: { type: FunctionType.CONDITION, name: 'equals', arguments: [true] as any[] },
          },
        ],
      }

      const result = transformPredicate(predicate, ['test']) as PredicateASTNode

      expect(result.expressionType).toBe(LogicType.OR)
      expect(result.properties.get('operands')).toHaveLength(2)
    })

    it('should transform a NOT predicate', () => {
      const predicate = {
        type: LogicType.NOT,
        operand: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'accepted'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'equals', arguments: [true] as any[] },
        },
      }

      const result = transformPredicate(predicate, ['test']) as PredicateASTNode

      expect(result).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: LogicType.NOT,
      })

      expect(result.properties.get('operand')).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: LogicType.TEST,
      })
    })
  })

  describe('transformFunction()', () => {
    it('should transform a condition function', () => {
      const func = {
        type: FunctionType.CONDITION,
        name: 'hasMaxLength',
        arguments: [100, true] as any[],
      }

      const result = transformFunction(func, ['test']) as FunctionASTNode

      expect(result).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: FunctionType.CONDITION,
      })
      expect(result.properties.get('name')).toBe('hasMaxLength')
      expect(result.properties.get('arguments')).toEqual([100, true])
    })

    it('should transform a transformer function', () => {
      const func = {
        type: FunctionType.TRANSFORMER,
        name: 'toUpperCase',
        arguments: [] as any[],
      }

      const result = transformFunction(func, ['test']) as FunctionASTNode

      expect(result).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: FunctionType.TRANSFORMER,
      })
      expect(result.properties.get('name')).toBe('toUpperCase')
      expect(result.properties.get('arguments')).toEqual([])
    })

    it('should transform an effect function', () => {
      const func = {
        type: FunctionType.EFFECT,
        name: 'save',
        arguments: [{ draft: true }] as any[],
      }

      const result = transformFunction(func, ['test']) as FunctionASTNode

      expect(result).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: FunctionType.EFFECT,
      })
      expect(result.properties.get('name')).toBe('save')
      expect(result.properties.get('arguments')).toEqual([{ draft: true }])
    })
  })

  describe('transformExpression() - main dispatcher', () => {
    it('should route expressions to correct transformer', () => {
      const referenceExpr = {
        type: ExpressionType.REFERENCE,
        path: ['test'],
      }

      const result = transformExpression(referenceExpr, ['test']) as ExpressionASTNode
      expect(result.expressionType).toBe('ExpressionType.Reference')
    })

    it('should handle unknown expression types', () => {
      const unknownExpr = {
        type: 'UnknownExpressionType',
        someProperty: 'value',
      }

      const result = transformExpression(unknownExpr, ['test']) as ExpressionASTNode
      expect(result.expressionType).toBe('UnknownExpressionType')
      expect(result.properties.get('someProperty')).toBe('value')
    })
  })
})
