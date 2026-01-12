import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType, PredicateType, TransitionType } from '@form-engine/form/types/enums'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { AccessTransitionASTNode, FunctionASTNode, NextASTNode } from '@form-engine/core/types/expressions.type'
import {
  AccessTransition,
  EffectFunctionExpr,
  NextExpr,
  PredicateTestExpr,
  ReferenceExpr,
  ValueExpr,
} from '@form-engine/form/types/expressions.type'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
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
    it('should create an Access transition with guards', () => {
      // Arrange
      const json = {
        type: TransitionType.ACCESS,
        guards: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'field'] } satisfies ReferenceExpr,
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        },
        redirect: [] as NextExpr[],
      } satisfies AccessTransition

      // Act
      const result = accessFactory.create(json) as AccessTransitionASTNode

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.TRANSITION)
      expect(result.transitionType).toBe(TransitionType.ACCESS)
      expect(result.properties.guards).toBeDefined()
      expect(result.properties.guards.type).toBe(ASTNodeType.PREDICATE)
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
        redirect: [] as NextExpr[],
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
        redirect: [] as NextExpr[],
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

    it('should create an Access transition with redirect', () => {
      // Arrange
      const json = {
        type: TransitionType.ACCESS,
        redirect: [
          {
            type: ExpressionType.NEXT,
            when: {
              type: PredicateType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
              negate: false,
              condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
            },
            goto: 'step1',
          } satisfies NextExpr,
        ],
      } satisfies AccessTransition

      // Act
      const result = accessFactory.create(json) as AccessTransitionASTNode

      // Assert
      expect(result.properties.redirect).toBeDefined()
      expect(result.properties.redirect).toHaveLength(1)
      expect(result.properties.redirect[0].type).toBe(ASTNodeType.EXPRESSION)
      expect((result.properties.redirect[0] as NextASTNode).expressionType).toBe(ExpressionType.NEXT)
    })

    it('should create an Access transition with all properties', () => {
      // Arrange
      const json = {
        type: TransitionType.ACCESS,
        guards: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        effects: [{ type: FunctionType.EFFECT, name: 'trackPageView', arguments: [] as ValueExpr[] }],
        redirect: [
          {
            type: ExpressionType.NEXT,
            when: {
              type: PredicateType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] } satisfies ReferenceExpr,
              negate: false,
              condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
            } satisfies PredicateTestExpr,
            goto: 'step1',
          } satisfies NextExpr,
        ],
      } satisfies AccessTransition

      // Act
      const result = accessFactory.create(json) as AccessTransitionASTNode

      // Assert
      expect(result.properties.guards).toBeDefined()
      expect(result.properties.effects).toBeDefined()
      expect(result.properties.redirect).toBeDefined()

      expect(result.properties.guards.type).toBe(ASTNodeType.PREDICATE)
      expect(result.properties.effects[0].type).toBe(ASTNodeType.EXPRESSION)
      expect(result.properties.redirect[0].type).toBe(ASTNodeType.EXPRESSION)
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

    it('should not set redirect if not an array', () => {
      // Arrange
      const json = {
        type: TransitionType.ACCESS,
        redirect: 'not-an-array',
      } as any

      // Act
      const result = accessFactory.create(json) as AccessTransitionASTNode

      // Assert
      expect(result.properties.redirect).toBeUndefined()
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
