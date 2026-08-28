import { ExpressionType, FunctionCallType, PolicyType, PredicateType, HookType } from '../../../../../shared/taxonomy'
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
        _forge: HookType.ACCESS,
        when: {
          _forge: PredicateType.TEST,
          subject: { _forge: ExpressionType.REFERENCE, path: ['answers', 'field'] } satisfies ReferenceExpr,
          negate: false,
          condition: { _forge: FunctionCallType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        },
      } satisfies AccessHook

      // Act
      const result = createAccessHookNode(json, nodeFactory.context) as AccessHookASTNode

      // Assert
      expect(result.id).toBeDefined()
      expect(result.isTemplate).toBe(false)
      expect(result.kind).toBe(HookType.ACCESS)
      expect(result.properties.when).toBeDefined()
      expect(result.properties.when!.isTemplate).toBe(false)
    })

    it('should create an Access hook with effects', () => {
      // Arrange
      const json = {
        _forge: HookType.ACCESS,
        effects: [
          { _forge: FunctionCallType.EFFECT, name: 'trackPageView', arguments: [] as ResolvableValue[] },
          { _forge: FunctionCallType.EFFECT, name: 'logAccess', arguments: [] as ResolvableValue[] },
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
        expect(effect.isTemplate).toBe(false)
        expect(effect.kind).toBe(FunctionCallType.EFFECT)
      })
    })

    it('should transform each effect using real nodeFactory', () => {
      // Arrange
      const effect1 = {
        _forge: FunctionCallType.EFFECT,
        name: 'effect1',
        arguments: [] as ResolvableValue[],
      } satisfies EffectFunctionExpr
      const effect2 = {
        _forge: FunctionCallType.EFFECT,
        name: 'effect2',
        arguments: [] as ResolvableValue[],
      } satisfies EffectFunctionExpr

      const json = {
        _forge: HookType.ACCESS,
        effects: [effect1, effect2],
      } satisfies AccessHook

      // Act
      const result = createAccessHookNode(json, nodeFactory.context) as AccessHookASTNode

      // Assert
      const effects = result.properties.effects as FunctionASTNode[]
      expect(effects).toHaveLength(2)

      expect(effects[0].isTemplate).toBe(false)
      expect(effects[0].kind).toBe(FunctionCallType.EFFECT)
      expect(effects[0].properties.name).toBe('effect1')

      expect(effects[1].isTemplate).toBe(false)
      expect(effects[1].kind).toBe(FunctionCallType.EFFECT)
      expect(effects[1].properties.name).toBe('effect2')
    })

    it('should create an Access hook with redirect outcome', () => {
      // Arrange
      const json = {
        _forge: HookType.ACCESS,
        next: [
          {
            _forge: PolicyType.OUTCOME_REDIRECT,
            when: {
              _forge: PredicateType.TEST,
              subject: { _forge: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
              negate: false,
              condition: { _forge: FunctionCallType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
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
      expect(result.properties.next![0].isTemplate).toBe(false)
      expect((result.properties.next![0] as RedirectOutcomeASTNode).kind).toBe(PolicyType.OUTCOME_REDIRECT)
    })

    it('should create an Access hook with throwError outcome', () => {
      // Arrange
      const json = {
        _forge: HookType.ACCESS,
        next: [
          {
            _forge: PolicyType.OUTCOME_THROW_ERROR,
            when: {
              _forge: PredicateType.TEST,
              subject: { _forge: ExpressionType.REFERENCE, path: ['data', 'notFound'] } satisfies ReferenceExpr,
              negate: false,
              condition: { _forge: FunctionCallType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
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
      expect(result.properties.next![0].isTemplate).toBe(false)
      expect((result.properties.next![0] as ThrowErrorOutcomeASTNode).kind).toBe(PolicyType.OUTCOME_THROW_ERROR)
    })

    it('should create an Access hook with multiple outcomes', () => {
      // Arrange
      const json = {
        _forge: HookType.ACCESS,
        next: [
          {
            _forge: PolicyType.OUTCOME_THROW_ERROR,
            when: {
              _forge: PredicateType.TEST,
              subject: { _forge: ExpressionType.REFERENCE, path: ['data', 'notFound'] } satisfies ReferenceExpr,
              negate: false,
              condition: { _forge: FunctionCallType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
            },
            status: 404,
            message: 'Not found',
          } satisfies ThrowErrorOutcome,
          {
            _forge: PolicyType.OUTCOME_REDIRECT,
            goto: '/overview',
          } satisfies RedirectOutcome,
        ],
      } satisfies AccessHook

      // Act
      const result = createAccessHookNode(json, nodeFactory.context) as AccessHookASTNode

      // Assert
      expect(result.properties.next).toBeDefined()
      expect(result.properties.next).toHaveLength(2)
      expect((result.properties.next![0] as ThrowErrorOutcomeASTNode).kind).toBe(PolicyType.OUTCOME_THROW_ERROR)
      expect((result.properties.next![1] as RedirectOutcomeASTNode).kind).toBe(PolicyType.OUTCOME_REDIRECT)
    })

    it('should create an Access hook with all properties', () => {
      // Arrange
      const json = {
        _forge: HookType.ACCESS,
        when: {
          _forge: PredicateType.TEST,
          subject: { _forge: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: { _forge: FunctionCallType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        } satisfies PredicateTestExpr,
        effects: [{ _forge: FunctionCallType.EFFECT, name: 'trackPageView', arguments: [] as ResolvableValue[] }],
        next: [
          {
            _forge: PolicyType.OUTCOME_REDIRECT,
            when: {
              _forge: PredicateType.TEST,
              subject: { _forge: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
              negate: false,
              condition: { _forge: FunctionCallType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
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

      expect(result.properties.when!.isTemplate).toBe(false)
      expect(result.properties.effects![0].isTemplate).toBe(false)
      expect(result.properties.next![0].isTemplate).toBe(false)
    })

    it('should not set effects if not an array', () => {
      // Arrange
      const json = {
        _forge: HookType.ACCESS,
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
        _forge: HookType.ACCESS,
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
        _forge: HookType.ACCESS,
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
        _forge: HookType.SUBMIT,
        validate: true,
        when: {
          _forge: PredicateType.TEST,
          negate: false,
          subject: { _forge: ExpressionType.REFERENCE, path: ['answers', 'test'] },
          condition: { _forge: FunctionCallType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        },
      } satisfies SubmitHook

      // Act
      const result = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.isTemplate).toBe(false)
      expect(result.kind).toBe(HookType.SUBMIT)
      expect(result.properties.when).toBeDefined()

      const whenNode = result.properties.when
      expect(whenNode!.isTemplate).toBe(false)
    })

    it('should create a Submit hook with guards', () => {
      // Arrange
      const json = {
        _forge: HookType.SUBMIT,
        validate: true,
        guards: {
          _forge: PredicateType.TEST,
          negate: false,
          subject: { _forge: ExpressionType.REFERENCE, path: ['answers', 'test'] },
          condition: { _forge: FunctionCallType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        },
      } satisfies SubmitHook

      // Act
      const result = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.guards).toBeDefined()

      const guardsNode = result.properties.guards
      expect(guardsNode!.isTemplate).toBe(false)
    })

    it('should set validate to true when explicitly true', () => {
      // Arrange
      const json = {
        _forge: HookType.SUBMIT,
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
        _forge: HookType.SUBMIT,
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
        _forge: HookType.SUBMIT,
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
          _forge: HookType.SUBMIT,
          validate: true,
          onValid: {
            next: [{ _forge: PolicyType.OUTCOME_REDIRECT, goto: '/valid' } satisfies RedirectOutcome],
          },
          onInvalid: {
            next: [{ _forge: PolicyType.OUTCOME_REDIRECT, goto: '/invalid' } satisfies RedirectOutcome],
          },
        } satisfies SubmitHook,
        nodeFactory.context,
      )

      // Assert
      expect(result1.properties.validate).toBe(true)

      // Act
      const result2 = createSubmitHookNode(
        {
          _forge: HookType.SUBMIT,
          validate: false,
          onAlways: {
            next: [{ _forge: PolicyType.OUTCOME_REDIRECT, goto: '/next' } satisfies RedirectOutcome],
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
        _forge: HookType.SUBMIT,
        validate: true,
        onAlways: {
          effects: [{ _forge: FunctionCallType.EFFECT, name: 'saveData', arguments: [] as ResolvableValue[] }],
          next: [{ _forge: PolicyType.OUTCOME_REDIRECT, goto: '/next-step' } satisfies RedirectOutcome],
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

      expect(onAlways.effects![0].isTemplate).toBe(false)
      expect(onAlways.next![0].isTemplate).toBe(false)
    })

    it('should create a Submit hook with onValid branch', () => {
      // Arrange
      const json = {
        _forge: HookType.SUBMIT,
        validate: true,
        onValid: {
          effects: [{ _forge: FunctionCallType.EFFECT, name: 'submitForm', arguments: [] as ResolvableValue[] }],
          next: [{ _forge: PolicyType.OUTCOME_REDIRECT, goto: '/success' } satisfies RedirectOutcome],
        },
      } satisfies SubmitHook

      // Act
      const result = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.onValid).toBeDefined()
      const onValid = result.properties.onValid!
      expect(onValid).toHaveProperty('effects')
      expect(onValid).toHaveProperty('next')

      expect(onValid.effects![0].isTemplate).toBe(false)
      expect(onValid.next![0].isTemplate).toBe(false)
    })

    it('should create a Submit hook with onInvalid branch', () => {
      // Arrange
      const json = {
        _forge: HookType.SUBMIT,
        validate: true,
        onInvalid: {
          effects: [{ _forge: FunctionCallType.EFFECT, name: 'logError', arguments: [] as ResolvableValue[] }],
          next: [{ _forge: PolicyType.OUTCOME_REDIRECT, goto: '/error' } satisfies RedirectOutcome],
        },
      } satisfies SubmitHook

      // Act
      const result = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.onInvalid).toBeDefined()
      const onInvalid = result.properties.onInvalid!
      expect(onInvalid).toHaveProperty('effects')
      expect(onInvalid).toHaveProperty('next')

      expect(onInvalid.effects![0].isTemplate).toBe(false)
      expect(onInvalid.next![0].isTemplate).toBe(false)
    })

    it('should create a Submit hook with all branches', () => {
      // Arrange
      const json = {
        _forge: HookType.SUBMIT,
        validate: true,
        onAlways: {
          effects: [{ _forge: FunctionCallType.EFFECT, name: 'always', arguments: [] as ResolvableValue[] }],
        },
        onValid: {
          next: [{ _forge: PolicyType.OUTCOME_REDIRECT, goto: '/next' } satisfies RedirectOutcome],
        },
        onInvalid: {
          effects: [{ _forge: FunctionCallType.EFFECT, name: 'invalid', arguments: [] as ResolvableValue[] }],
          next: [{ _forge: PolicyType.OUTCOME_REDIRECT, goto: '/error' } satisfies RedirectOutcome],
        },
      } satisfies SubmitHook

      // Act
      const result = createSubmitHookNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.onAlways).toBeDefined()
      expect(result.properties.onValid).toBeDefined()
      expect(result.properties.onInvalid).toBeDefined()

      expect(result.properties.onAlways!.effects![0].isTemplate).toBe(false)
      expect(result.properties.onValid!.next![0].isTemplate).toBe(false)
      expect(result.properties.onInvalid!.effects![0].isTemplate).toBe(false)
      expect(result.properties.onInvalid!.next![0].isTemplate).toBe(false)
    })

    it('should handle branch with only effects', () => {
      // Arrange
      const json = {
        _forge: HookType.SUBMIT,
        validate: true,
        onAlways: {
          effects: [{ _forge: FunctionCallType.EFFECT, name: 'saveData', arguments: [] as ResolvableValue[] }],
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
        _forge: HookType.SUBMIT,
        validate: true,
        onValid: {
          next: [{ _forge: PolicyType.OUTCOME_REDIRECT, goto: '/next' } satisfies RedirectOutcome],
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
        _forge: HookType.SUBMIT,
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
        _forge: HookType.SUBMIT,
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
        _forge: HookType.SUBMIT,
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
        _forge: HookType.SUBMIT,
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
