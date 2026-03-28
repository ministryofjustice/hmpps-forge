import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType, OutcomeType, PredicateType, TransitionType } from '@form-engine/form/types/enums'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import {
  AccessTransitionASTNode,
  FunctionASTNode,
  RedirectOutcomeASTNode,
  ThrowErrorOutcomeASTNode,
} from '@form-engine/core/types/expressions.type'
import {
  AccessTransition,
  EffectFunctionExpr,
  PredicateTestExpr,
  RedirectOutcome,
  ReferenceExpr,
  ThrowErrorOutcome,
  ValueExpr,
} from '@form-engine/form/types/expressions.type'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import AccessFactory from './AccessFactory'

describe('AccessFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let accessFactory: AccessFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    accessFactory = new AccessFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create an Access transition with when', () => {
      // Arrange
      const json = {
        type: TransitionType.ACCESS,
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] } satisfies ReferenceExpr,
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        },
      } satisfies AccessTransition

      // Act
      const result = accessFactory.create(json) as AccessTransitionASTNode

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.TRANSITION)
      expect(result.transitionType).toBe(TransitionType.ACCESS)
      expect(result.properties.when).toBeDefined()
      expect(result.properties.when!.type).toBe(ASTNodeType.PREDICATE)
      expect(result.raw).toBe(json)
    })

    it('should create an Access transition with effects', () => {
      // Arrange
      const json = {
        type: TransitionType.ACCESS,
        effects: [
          { type: FunctionType.EFFECT, name: 'trackPageView', arguments: [] as ValueExpr[] },
          { type: FunctionType.EFFECT, name: 'logAccess', arguments: [] as ValueExpr[] },
        ],
      } satisfies AccessTransition

      // Act
      const result = accessFactory.create(json) as AccessTransitionASTNode

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
        arguments: [] as ValueExpr[],
      } satisfies EffectFunctionExpr
      const effect2 = {
        type: FunctionType.EFFECT,
        name: 'effect2',
        arguments: [] as ValueExpr[],
      } satisfies EffectFunctionExpr

      const json = {
        type: TransitionType.ACCESS,
        effects: [effect1, effect2],
      } satisfies AccessTransition

      // Act
      const result = accessFactory.create(json) as AccessTransitionASTNode

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

    it('should create an Access transition with redirect outcome', () => {
      // Arrange
      const json = {
        type: TransitionType.ACCESS,
        next: [
          {
            type: OutcomeType.REDIRECT,
            when: {
              type: PredicateType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
              negate: false,
              condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
            },
            goto: '/step1',
          } satisfies RedirectOutcome,
        ],
      } satisfies AccessTransition

      // Act
      const result = accessFactory.create(json) as AccessTransitionASTNode

      // Assert
      expect(result.properties.next).toBeDefined()
      expect(result.properties.next).toHaveLength(1)
      expect(result.properties.next![0].type).toBe(ASTNodeType.OUTCOME)
      expect((result.properties.next![0] as RedirectOutcomeASTNode).outcomeType).toBe(OutcomeType.REDIRECT)
    })

    it('should create an Access transition with throwError outcome', () => {
      // Arrange
      const json = {
        type: TransitionType.ACCESS,
        next: [
          {
            type: OutcomeType.THROW_ERROR,
            when: {
              type: PredicateType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['data', 'notFound'] } satisfies ReferenceExpr,
              negate: false,
              condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
            },
            status: 404,
            message: 'Item not found',
          } satisfies ThrowErrorOutcome,
        ],
      } satisfies AccessTransition

      // Act
      const result = accessFactory.create(json) as AccessTransitionASTNode

      // Assert
      expect(result.properties.next).toBeDefined()
      expect(result.properties.next).toHaveLength(1)
      expect(result.properties.next![0].type).toBe(ASTNodeType.OUTCOME)
      expect((result.properties.next![0] as ThrowErrorOutcomeASTNode).outcomeType).toBe(OutcomeType.THROW_ERROR)
    })

    it('should create an Access transition with multiple outcomes', () => {
      // Arrange
      const json = {
        type: TransitionType.ACCESS,
        next: [
          {
            type: OutcomeType.THROW_ERROR,
            when: {
              type: PredicateType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['data', 'notFound'] } satisfies ReferenceExpr,
              negate: false,
              condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
            },
            status: 404,
            message: 'Not found',
          } satisfies ThrowErrorOutcome,
          {
            type: OutcomeType.REDIRECT,
            goto: '/overview',
          } satisfies RedirectOutcome,
        ],
      } satisfies AccessTransition

      // Act
      const result = accessFactory.create(json) as AccessTransitionASTNode

      // Assert
      expect(result.properties.next).toBeDefined()
      expect(result.properties.next).toHaveLength(2)
      expect((result.properties.next![0] as ThrowErrorOutcomeASTNode).outcomeType).toBe(OutcomeType.THROW_ERROR)
      expect((result.properties.next![1] as RedirectOutcomeASTNode).outcomeType).toBe(OutcomeType.REDIRECT)
    })

    it('should create an Access transition with all properties', () => {
      // Arrange
      const json = {
        type: TransitionType.ACCESS,
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        effects: [{ type: FunctionType.EFFECT, name: 'trackPageView', arguments: [] as ValueExpr[] }],
        next: [
          {
            type: OutcomeType.REDIRECT,
            when: {
              type: PredicateType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
              negate: false,
              condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
            } satisfies PredicateTestExpr,
            goto: '/step1',
          } satisfies RedirectOutcome,
        ],
      } satisfies AccessTransition

      // Act
      const result = accessFactory.create(json) as AccessTransitionASTNode

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
        type: TransitionType.ACCESS,
        effects: 'not-an-array',
      } as any

      // Act
      const result = accessFactory.create(json) as AccessTransitionASTNode

      // Assert
      expect(result.properties.effects).toBeUndefined()
    })

    it('should not set next if not an array', () => {
      // Arrange
      const json = {
        type: TransitionType.ACCESS,
        next: 'not-an-array',
      } as any

      // Act
      const result = accessFactory.create(json) as AccessTransitionASTNode

      // Assert
      expect(result.properties.next).toBeUndefined()
    })

    it('should generate unique node IDs from the ID generator', () => {
      // Arrange
      const json = {
        type: TransitionType.ACCESS,
      } as AccessTransition

      // Act
      const result = accessFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(typeof result.id).toBe('string')
    })
  })
})
