import { ASTNodeType } from '../../../contracts/ast/enums'
import {
  ExpressionType,
  FunctionType,
  OutcomeType,
  PredicateType,
  HookType,
} from '../../../../../authoring/types/enums'
import { NodeIDGenerator } from '../ast-state/NodeIDGenerator'
import {
  AccessHookASTNode,
  FunctionASTNode,
  RedirectOutcomeASTNode,
  ThrowErrorOutcomeASTNode,
} from '../../../contracts/ast/expressions.type'
import {
  AccessHook,
  EffectFunctionExpr,
  PredicateTestExpr,
  RedirectOutcome,
  ReferenceExpr,
  ThrowErrorOutcome,
  ResolvableValue,
  SubmitHook,
} from '../../../../../authoring/types/expressions.type'
import { NodeFactory } from './NodeFactory'
import { createAccessHookNode, createSubmitHookNode } from './hooks'

describe('hooks', () => {
  describe('createAccessHookNode()', () => {
    let nodeIDGenerator: NodeIDGenerator
    let nodeFactory: NodeFactory

    beforeEach(() => {
      nodeIDGenerator = new NodeIDGenerator()
      nodeFactory = new NodeFactory(nodeIDGenerator)
    })

    it('should create an Access hook with when', () => {
      // Arrange
      const json = {
        type: HookType.ACCESS,
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] } satisfies ReferenceExpr,
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        },
      } satisfies AccessHook

      // Act
      const result = createAccessHookNode(json, nodeFactory.context) as AccessHookASTNode

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.HOOK)
      expect(result.hookType).toBe(HookType.ACCESS)
      expect(result.properties.when).toBeDefined()
      expect(result.properties.when!.type).toBe(ASTNodeType.PREDICATE)
    })

    it('should create an Access hook with effects', () => {
      // Arrange
      const json = {
        type: HookType.ACCESS,
        effects: [
          { type: FunctionType.EFFECT, name: 'trackPageView', arguments: [] as ResolvableValue[] },
          { type: FunctionType.EFFECT, name: 'logAccess', arguments: [] as ResolvableValue[] },
        ],
      } satisfies AccessHook

      // Act
      const result = createAccessHookNode(json, nodeFactory.context) as AccessHookASTNode

      // Assert
      expect(result.properties.effects).toBeDefined()
      expect(result.properties.effects).toHaveLength(2)

      const effects = result.properties.effects as FunctionASTNode[]

      effects.forEach(effect => {
        expect(effect).toHaveProperty('id')
        expect(effect.type).toBe(ASTNodeType.EXPRESSION)
        expect(effect.expressionType).toBe(FunctionType.EFFECT)
      })
    })

    it('should transform each effect using real nodeFactory', () => {
      // Arrange
      const effect1 = {
        type: FunctionType.EFFECT,
        name: 'effect1',
        arguments: [] as ResolvableValue[],
      } satisfies EffectFunctionExpr
      const effect2 = {
        type: FunctionType.EFFECT,
        name: 'effect2',
        arguments: [] as ResolvableValue[],
      } satisfies EffectFunctionExpr

      const json = {
        type: HookType.ACCESS,
        effects: [effect1, effect2],
      } satisfies AccessHook

      // Act
      const result = createAccessHookNode(json, nodeFactory.context) as AccessHookASTNode

      // Assert
      const effects = result.properties.effects as FunctionASTNode[]
      expect(effects).toHaveLength(2)

      expect(effects[0].type).toBe(ASTNodeType.EXPRESSION)
      expect(effects[0].expressionType).toBe(FunctionType.EFFECT)
      expect(effects[0].properties.name).toBe('effect1')

      expect(effects[1].type).toBe(ASTNodeType.EXPRESSION)
      expect(effects[1].expressionType).toBe(FunctionType.EFFECT)
      expect(effects[1].properties.name).toBe('effect2')
    })

    it('should create an Access hook with redirect outcome', () => {
      // Arrange
      const json = {
        type: HookType.ACCESS,
        next: [
          {
            type: OutcomeType.REDIRECT,
            when: {
              type: PredicateType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
              negate: false,
              condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
            },
            goto: '/step1',
          } satisfies RedirectOutcome,
        ],
      } satisfies AccessHook

      // Act
      const result = createAccessHookNode(json, nodeFactory.context) as AccessHookASTNode

      // Assert
      expect(result.properties.next).toBeDefined()
      expect(result.properties.next).toHaveLength(1)
      expect(result.properties.next![0].type).toBe(ASTNodeType.OUTCOME)
      expect((result.properties.next![0] as RedirectOutcomeASTNode).outcomeType).toBe(OutcomeType.REDIRECT)
    })

    it('should create an Access hook with throwError outcome', () => {
      // Arrange
      const json = {
        type: HookType.ACCESS,
        next: [
          {
            type: OutcomeType.THROW_ERROR,
            when: {
              type: PredicateType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['data', 'notFound'] } satisfies ReferenceExpr,
              negate: false,
              condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
            },
            status: 404,
            message: 'Item not found',
          } satisfies ThrowErrorOutcome,
        ],
      } satisfies AccessHook

      // Act
      const result = createAccessHookNode(json, nodeFactory.context) as AccessHookASTNode

      // Assert
      expect(result.properties.next).toBeDefined()
      expect(result.properties.next).toHaveLength(1)
      expect(result.properties.next![0].type).toBe(ASTNodeType.OUTCOME)
      expect((result.properties.next![0] as ThrowErrorOutcomeASTNode).outcomeType).toBe(OutcomeType.THROW_ERROR)
    })

    it('should create an Access hook with multiple outcomes', () => {
      // Arrange
      const json = {
        type: HookType.ACCESS,
        next: [
          {
            type: OutcomeType.THROW_ERROR,
            when: {
              type: PredicateType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['data', 'notFound'] } satisfies ReferenceExpr,
              negate: false,
              condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
            },
            status: 404,
            message: 'Not found',
          } satisfies ThrowErrorOutcome,
          {
            type: OutcomeType.REDIRECT,
            goto: '/overview',
          } satisfies RedirectOutcome,
        ],
      } satisfies AccessHook

      // Act
      const result = createAccessHookNode(json, nodeFactory.context) as AccessHookASTNode

      // Assert
      expect(result.properties.next).toBeDefined()
      expect(result.properties.next).toHaveLength(2)
      expect((result.properties.next![0] as ThrowErrorOutcomeASTNode).outcomeType).toBe(OutcomeType.THROW_ERROR)
      expect((result.properties.next![1] as RedirectOutcomeASTNode).outcomeType).toBe(OutcomeType.REDIRECT)
    })

    it('should create an Access hook with all properties', () => {
      // Arrange
      const json = {
        type: HookType.ACCESS,
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        } satisfies PredicateTestExpr,
        effects: [{ type: FunctionType.EFFECT, name: 'trackPageView', arguments: [] as ResolvableValue[] }],
        next: [
          {
            type: OutcomeType.REDIRECT,
            when: {
              type: PredicateType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
              negate: false,
              condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
            } satisfies PredicateTestExpr,
            goto: '/step1',
          } satisfies RedirectOutcome,
        ],
      } satisfies AccessHook

      // Act
      const result = createAccessHookNode(json, nodeFactory.context) as AccessHookASTNode

      // Assert
      expect(result.properties.when).toBeDefined()
      expect(result.properties.effects).toBeDefined()
      expect(result.properties.next).toBeDefined()

      expect(result.properties.when!.type).toBe(ASTNodeType.PREDICATE)
      expect(result.properties.effects![0].type).toBe(ASTNodeType.EXPRESSION)
      expect(result.properties.next![0].type).toBe(ASTNodeType.OUTCOME)
    })

    it('should not set effects if not an array', () => {
      // Arrange
      const json = {
        type: HookType.ACCESS,
        effects: 'not-an-array',
      } as any

      // Act
      const result = createAccessHookNode(json, nodeFactory.context) as AccessHookASTNode

      // Assert
      expect(result.properties.effects).toBeUndefined()
    })

    it('should not set next if not an array', () => {
      // Arrange
      const json = {
        type: HookType.ACCESS,
        next: 'not-an-array',
      } as any

      // Act
      const result = createAccessHookNode(json, nodeFactory.context) as AccessHookASTNode

      // Assert
      expect(result.properties.next).toBeUndefined()
    })

    it('should generate unique node IDs', () => {
      // Arrange
      const json = {
        type: HookType.ACCESS,
      } as AccessHook

      // Act
      const result1 = createAccessHookNode(json, nodeFactory.context)
      const result2 = createAccessHookNode(json, nodeFactory.context)

      // Assert
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })
  })

  describe('createSubmitHookNode()', () => {
    let nodeIDGenerator: NodeIDGenerator
    let nodeFactory: NodeFactory

    beforeEach(() => {
      nodeIDGenerator = new NodeIDGenerator()
      nodeFactory = new NodeFactory(nodeIDGenerator)
    })

    it('should create a Submit hook with when condition', () => {
      // Arrange
      const json = {
        type: HookType.SUBMIT,
        validate: true,
        when: {
          type: PredicateType.TEST,
          negate: false,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] },
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        },
      } satisfies SubmitHook

      // Act
      const result = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.HOOK)
      expect(result.hookType).toBe(HookType.SUBMIT)
      expect(result.properties.when).toBeDefined()

      const whenNode = result.properties.when
      expect(whenNode!.type).toBe(ASTNodeType.PREDICATE)
    })

    it('should create a Submit hook with guards', () => {
      // Arrange
      const json = {
        type: HookType.SUBMIT,
        validate: true,
        guards: {
          type: PredicateType.TEST,
          negate: false,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] },
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        },
      } satisfies SubmitHook

      // Act
      const result = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.guards).toBeDefined()

      const guardsNode = result.properties.guards
      expect(guardsNode!.type).toBe(ASTNodeType.PREDICATE)
    })

    it('should set validate to true when explicitly true', () => {
      // Arrange
      const json = {
        type: HookType.SUBMIT,
        validate: true,
      } satisfies SubmitHook

      // Act
      const result = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.validate).toBe(true)
      expect(result.properties.validationGroups).toEqual(['default'])
    })

    it('should set validate to false when explicitly false', () => {
      // Arrange
      const json = {
        type: HookType.SUBMIT,
        validate: false,
      } satisfies SubmitHook

      // Act
      const result = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.validate).toBe(false)
      expect(result.properties.validationGroups).toEqual([])
    })

    it('should set validate and validationGroups when group validation is provided', () => {
      // Arrange
      const json = {
        type: HookType.SUBMIT,
        validate: { groups: ['contact', 'address'] },
      } satisfies SubmitHook

      // Act
      const result = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.validate).toBe(true)
      expect(result.properties.validationGroups).toEqual(['contact', 'address'])
    })

    it('should set validate property correctly', () => {
      // Act
      const result1 = createSubmitHookNode(
        {
          type: HookType.SUBMIT,
          validate: true,
          onValid: {
            next: [{ type: OutcomeType.REDIRECT, goto: '/valid' } satisfies RedirectOutcome],
          },
          onInvalid: {
            next: [{ type: OutcomeType.REDIRECT, goto: '/invalid' } satisfies RedirectOutcome],
          },
        } satisfies SubmitHook,
        nodeFactory.context,
      )

      // Assert
      expect(result1.properties.validate).toBe(true)

      // Act
      const result2 = createSubmitHookNode(
        {
          type: HookType.SUBMIT,
          validate: false,
          onAlways: {
            next: [{ type: OutcomeType.REDIRECT, goto: '/next' } satisfies RedirectOutcome],
          },
        } satisfies SubmitHook,
        nodeFactory.context,
      )

      // Assert
      expect(result2.properties.validate).toBe(false)
    })

    it('should create a Submit hook with onAlways branch', () => {
      // Arrange
      const json = {
        type: HookType.SUBMIT,
        validate: true,
        onAlways: {
          effects: [{ type: FunctionType.EFFECT, name: 'saveData', arguments: [] as ResolvableValue[] }],
          next: [{ type: OutcomeType.REDIRECT, goto: '/next-step' } satisfies RedirectOutcome],
        },
      } satisfies SubmitHook

      // Act
      const result = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.onAlways).toBeDefined()
      const onAlways = result.properties.onAlways!
      expect(onAlways).toHaveProperty('effects')
      expect(onAlways).toHaveProperty('next')
      expect(Array.isArray(onAlways.effects)).toBe(true)
      expect(Array.isArray(onAlways.next)).toBe(true)

      expect(onAlways.effects![0].type).toBe(ASTNodeType.EXPRESSION)
      expect(onAlways.next![0].type).toBe(ASTNodeType.OUTCOME)
    })

    it('should create a Submit hook with onValid branch', () => {
      // Arrange
      const json = {
        type: HookType.SUBMIT,
        validate: true,
        onValid: {
          effects: [{ type: FunctionType.EFFECT, name: 'submitForm', arguments: [] as ResolvableValue[] }],
          next: [{ type: OutcomeType.REDIRECT, goto: '/success' } satisfies RedirectOutcome],
        },
      } satisfies SubmitHook

      // Act
      const result = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.onValid).toBeDefined()
      const onValid = result.properties.onValid!
      expect(onValid).toHaveProperty('effects')
      expect(onValid).toHaveProperty('next')

      expect(onValid.effects![0].type).toBe(ASTNodeType.EXPRESSION)
      expect(onValid.next![0].type).toBe(ASTNodeType.OUTCOME)
    })

    it('should create a Submit hook with onInvalid branch', () => {
      // Arrange
      const json = {
        type: HookType.SUBMIT,
        validate: true,
        onInvalid: {
          effects: [{ type: FunctionType.EFFECT, name: 'logError', arguments: [] as ResolvableValue[] }],
          next: [{ type: OutcomeType.REDIRECT, goto: '/error' } satisfies RedirectOutcome],
        },
      } satisfies SubmitHook

      // Act
      const result = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.onInvalid).toBeDefined()
      const onInvalid = result.properties.onInvalid!
      expect(onInvalid).toHaveProperty('effects')
      expect(onInvalid).toHaveProperty('next')

      expect(onInvalid.effects![0].type).toBe(ASTNodeType.EXPRESSION)
      expect(onInvalid.next![0].type).toBe(ASTNodeType.OUTCOME)
    })

    it('should create a Submit hook with all branches', () => {
      // Arrange
      const json = {
        type: HookType.SUBMIT,
        validate: true,
        onAlways: {
          effects: [{ type: FunctionType.EFFECT, name: 'always', arguments: [] as ResolvableValue[] }],
        },
        onValid: {
          next: [{ type: OutcomeType.REDIRECT, goto: '/next' } satisfies RedirectOutcome],
        },
        onInvalid: {
          effects: [{ type: FunctionType.EFFECT, name: 'invalid', arguments: [] as ResolvableValue[] }],
          next: [{ type: OutcomeType.REDIRECT, goto: '/error' } satisfies RedirectOutcome],
        },
      } satisfies SubmitHook

      // Act
      const result = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.onAlways).toBeDefined()
      expect(result.properties.onValid).toBeDefined()
      expect(result.properties.onInvalid).toBeDefined()

      expect(result.properties.onAlways!.effects![0].type).toBe(ASTNodeType.EXPRESSION)
      expect(result.properties.onValid!.next![0].type).toBe(ASTNodeType.OUTCOME)
      expect(result.properties.onInvalid!.effects![0].type).toBe(ASTNodeType.EXPRESSION)
      expect(result.properties.onInvalid!.next![0].type).toBe(ASTNodeType.OUTCOME)
    })

    it('should handle branch with only effects', () => {
      // Arrange
      const json = {
        type: HookType.SUBMIT,
        validate: true,
        onAlways: {
          effects: [{ type: FunctionType.EFFECT, name: 'saveData', arguments: [] as ResolvableValue[] }],
        },
      } satisfies SubmitHook

      // Act
      const result = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      const onAlways = result.properties.onAlways!
      expect(onAlways).toHaveProperty('effects')
      expect(onAlways).not.toHaveProperty('next')
    })

    it('should handle branch with only next', () => {
      // Arrange
      const json = {
        type: HookType.SUBMIT,
        validate: true,
        onValid: {
          next: [{ type: OutcomeType.REDIRECT, goto: '/next' } satisfies RedirectOutcome],
        },
      } satisfies SubmitHook

      // Act
      const result = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      const onValid = result.properties.onValid!
      expect(onValid).toHaveProperty('next')
      expect(onValid).not.toHaveProperty('effects')
    })

    it('should return undefined for branch when branch is undefined', () => {
      // Arrange
      const json = {
        type: HookType.SUBMIT,
        validate: true,
      } satisfies SubmitHook

      // Act
      const result = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.onAlways).toBeUndefined()
      expect(result.properties.onValid).toBeUndefined()
      expect(result.properties.onInvalid).toBeUndefined()
    })

    it('should not set branch effects if not an array', () => {
      // Arrange
      const json = {
        type: HookType.SUBMIT,
        validate: true,
        onAlways: {
          effects: 'not-an-array',
        },
      } as any

      // Act
      const result = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      const onAlways = result.properties.onAlways!
      expect(onAlways).not.toHaveProperty('effects')
    })

    it('should not set branch next if not an array', () => {
      // Arrange
      const json = {
        type: HookType.SUBMIT,
        validate: true,
        onValid: {
          next: 'not-an-array',
        },
      } as any

      // Act
      const result = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      const onValid = result.properties.onValid!
      expect(onValid).not.toHaveProperty('next')
    })

    it('should generate unique node IDs', () => {
      // Arrange
      const json = {
        type: HookType.SUBMIT,
        validate: true,
      } satisfies SubmitHook

      // Act
      const result1 = createSubmitHookNode(json, nodeFactory.context)
      const result2 = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })
  })
})
