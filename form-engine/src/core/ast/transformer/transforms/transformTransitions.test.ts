import { TransitionType, ExpressionType, LogicType, FunctionType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import {
  transformTransition,
  transformLoadTransition,
  transformAccessTransition,
  transformSubmitTransition,
} from './transformTransitions'
import {
  LoadTransitionASTNode,
  AccessTransitionASTNode,
  SubmitTransitionASTNode,
  TransitionASTNode,
} from '../../types/nodes.type'

describe('Transition Transformations', () => {
  describe('transformLoadTransition()', () => {
    it('should transform a load transition with effects', () => {
      const transition = {
        type: TransitionType.LOAD,
        effects: [
          { type: FunctionType.EFFECT, name: 'loadUser', arguments: [] as any[] },
          { type: FunctionType.EFFECT, name: 'loadSettings', arguments: [] as any[] },
        ],
      }

      const result = transformLoadTransition(transition, ['test']) as LoadTransitionASTNode

      expect(result).toMatchObject({
        type: ASTNodeType.TRANSITION,
        transitionType: 'TransitionType.Load',
      })

      expect(result.properties.get('effects')).toHaveLength(2)
      expect(result.properties.get('effects')[0]).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: FunctionType.EFFECT,
      })
    })

    it('should handle empty effects array', () => {
      const transition = {
        type: TransitionType.LOAD,
        effects: [] as any[],
      }

      const result = transformLoadTransition(transition, ['test']) as LoadTransitionASTNode

      expect(result.properties.get('effects')).toEqual([])
    })
  })

  describe('transformAccessTransition()', () => {
    it('should transform an access transition with all properties', () => {
      const transition = {
        type: TransitionType.ACCESS,
        guards: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['data', 'authenticated'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'equals', arguments: [true] as any[] },
        },
        effects: [{ type: FunctionType.EFFECT, name: 'trackAccess', arguments: [] as any[] }],
        redirect: [{ type: ExpressionType.NEXT, goto: '/login' }],
      }

      const result = transformAccessTransition(transition, ['test']) as AccessTransitionASTNode

      expect(result).toMatchObject({
        type: ASTNodeType.TRANSITION,
        transitionType: 'TransitionType.Access',
      })

      expect(result.properties.get('guards')).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: LogicType.TEST,
      })

      expect(result.properties.get('effects')).toHaveLength(1)
      expect(result.properties.get('redirect')).toHaveLength(1)
    })

    it('should handle missing optional properties', () => {
      const transition = {
        type: TransitionType.ACCESS,
      }

      const result = transformAccessTransition(transition, ['test']) as AccessTransitionASTNode

      expect(result.properties.get('guards')).toBeUndefined()
      expect(result.properties.get('effects')).toBeUndefined()
      expect(result.properties.get('redirect')).toBeUndefined()
    })
  })

  describe('transformSubmitTransition()', () => {
    it('should transform a submit transition with validation', () => {
      const transition = {
        type: TransitionType.SUBMIT,
        when: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['post', 'action'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'equals', arguments: ['continue'] as any[] },
        },
        guards: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['data', 'canSubmit'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'equals', arguments: [true] as any[] },
        },
        validate: true,
        onAlways: {
          effects: [{ type: FunctionType.EFFECT, name: 'log', arguments: ['submission attempt'] as any[] }],
        },
        onValid: {
          effects: [{ type: FunctionType.EFFECT, name: 'save', arguments: [] as any[] }],
          next: [{ type: ExpressionType.NEXT, goto: '/next-step' }],
        },
        onInvalid: {
          effects: [{ type: FunctionType.EFFECT, name: 'saveDraft', arguments: [] as any[] }],
          next: [{ type: ExpressionType.NEXT, goto: '@self' }],
        },
      }

      const result = transformSubmitTransition(transition, ['test']) as SubmitTransitionASTNode

      expect(result).toMatchObject({
        type: ASTNodeType.TRANSITION,
        transitionType: 'TransitionType.Submit',
      })

      expect(result.properties.get('when')).toMatchObject({
        type: ASTNodeType.EXPRESSION,
      })

      expect(result.properties.get('guards')).toMatchObject({
        type: ASTNodeType.EXPRESSION,
      })

      expect(result.properties.get('validate')).toBe(true)

      expect(result.properties.get('onAlways')?.effects).toHaveLength(1)
      expect(result.properties.get('onValid')?.effects).toHaveLength(1)
      expect(result.properties.get('onValid')?.next).toHaveLength(1)
      expect(result.properties.get('onInvalid')?.effects).toHaveLength(1)
      expect(result.properties.get('onInvalid')?.next).toHaveLength(1)
    })

    it('should handle validate false', () => {
      const transition = {
        type: TransitionType.SUBMIT,
        validate: false,
      }

      const result = transformSubmitTransition(transition, ['test']) as SubmitTransitionASTNode

      expect(result.properties.get('validate')).toBe(false)
    })

    it('should handle missing branches', () => {
      const transition = {
        type: TransitionType.SUBMIT,
        validate: true,
        // No branches defined
      }

      const result = transformSubmitTransition(transition, ['test']) as SubmitTransitionASTNode

      expect(result.properties.get('onAlways')).toBeUndefined()
      expect(result.properties.get('onValid')).toBeUndefined()
      expect(result.properties.get('onInvalid')).toBeUndefined()
    })
  })

  describe('transformTransition() - main dispatcher', () => {
    it('should route transitions to correct transformer', () => {
      const loadTransition = {
        type: TransitionType.LOAD,
        effects: [] as any[],
      }

      const result = transformTransition(loadTransition, ['test']) as TransitionASTNode
      expect(result.transitionType).toBe('TransitionType.Load')
    })

    it('should handle unknown transition types', () => {
      const unknownTransition: any = {
        type: 'UnknownTransitionType',
        someProperty: 'value',
      }

      const result = transformTransition(unknownTransition, ['test']) as TransitionASTNode
      expect(result.transitionType).toBe('UnknownTransitionType')
      expect(result.properties.get('someProperty')).toBe('value')
    })
  })
})
