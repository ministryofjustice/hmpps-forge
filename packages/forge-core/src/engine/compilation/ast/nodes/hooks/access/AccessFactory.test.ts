import { ASTNodeType } from '../../../../../contracts/ast/enums'
import {
  ExpressionType,
  FunctionType,
  OutcomeType,
  PredicateType,
  HookType,
} from '../../../../../../authoring/types/enums'
import { NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
import {
  AccessHookASTNode,
  FunctionASTNode,
  RedirectOutcomeASTNode,
  ThrowErrorOutcomeASTNode,
} from '../../../../../contracts/ast/expressions.type'
import {
  AccessHook,
  EffectFunctionExpr,
  PredicateTestExpr,
  RedirectOutcome,
  ReferenceExpr,
  ThrowErrorOutcome,
  ResolvableValue,
} from '../../../../../../authoring/types/expressions.type'
import { NodeFactory } from '../../NodeFactory'
import AccessFactory from './AccessFactory'

describe('AccessFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let accessFactory: AccessFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator)
    accessFactory = new AccessFactory(nodeIDGenerator, nodeFactory)
  })

  describe('create()', () => {
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
      const result = accessFactory.create(json) as AccessHookASTNode

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.HOOK)
      expect(result.hookType).toBe(HookType.ACCESS)
      expect(result.properties.when).toBeDefined()
      expect(result.properties.when!.type).toBe(ASTNodeType.PREDICATE)
      expect(result).not.toHaveProperty('raw')
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
      const result = accessFactory.create(json) as AccessHookASTNode

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
      const result = accessFactory.create(json) as AccessHookASTNode

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
      const result = accessFactory.create(json) as AccessHookASTNode

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
      const result = accessFactory.create(json) as AccessHookASTNode

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
      const result = accessFactory.create(json) as AccessHookASTNode

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
      const result = accessFactory.create(json) as AccessHookASTNode

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
      const result = accessFactory.create(json) as AccessHookASTNode

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
      const result = accessFactory.create(json) as AccessHookASTNode

      // Assert
      expect(result.properties.next).toBeUndefined()
    })

    it('should generate unique node IDs from the ID generator', () => {
      // Arrange
      const json = {
        type: HookType.ACCESS,
      } as AccessHook

      // Act
      const result = accessFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(typeof result.id).toBe('string')
    })
  })
})
