import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType, PredicateType, TransitionType } from '@form-engine/form/types/enums'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { ActionTransitionASTNode, FunctionASTNode } from '@form-engine/core/types/expressions.type'
import {
  ActionTransition,
  EffectFunctionExpr,
  PredicateTestExpr,
  ReferenceExpr,
  ValueExpr,
} from '@form-engine/form/types/expressions.type'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import ActionFactory from './ActionFactory'

describe('ActionFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let actionFactory: ActionFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    actionFactory = new ActionFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create an Action transition with when and effects', () => {
      // Arrange
      const json = {
        type: TransitionType.ACTION,
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['post', 'action'] } satisfies ReferenceExpr,
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['lookup'] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        effects: [
          { type: FunctionType.EFFECT, name: 'lookupAddress', arguments: [] as ValueExpr[] },
          { type: FunctionType.EFFECT, name: 'setAddressFields', arguments: [] as ValueExpr[] },
        ],
      } satisfies ActionTransition

      // Act
      const result = actionFactory.create(json) as ActionTransitionASTNode

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.TRANSITION)
      expect(result.transitionType).toBe(TransitionType.ACTION)
      expect(result.raw).toBe(json)

      expect(result.properties.when).toBeDefined()
      expect(result.properties.when.type).toBe(ASTNodeType.PREDICATE)

      expect(result.properties.effects).toHaveLength(2)

      const effects = result.properties.effects as FunctionASTNode[]

      effects.forEach(effect => {
        expect(effect).toHaveProperty('id')
        expect(effect.type).toBe(ASTNodeType.EXPRESSION)
        expect(effect.expressionType).toBe(FunctionType.EFFECT)
      })
    })

    it('should transform when predicate into an AST node', () => {
      // Arrange
      const json = {
        type: TransitionType.ACTION,
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['post', 'button'] } satisfies ReferenceExpr,
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['find-address'] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        effects: [] as EffectFunctionExpr[],
      } satisfies ActionTransition

      // Act
      const result = actionFactory.create(json) as ActionTransitionASTNode

      // Assert
      const whenNode = result.properties.when
      expect(whenNode).toHaveProperty('id')
      expect(whenNode.type).toBe(ASTNodeType.PREDICATE)
    })

    it('should transform each effect using nodeFactory', () => {
      // Arrange
      const effect1 = {
        type: FunctionType.EFFECT,
        name: 'fetchPostcode',
        arguments: [{ type: ExpressionType.REFERENCE, path: ['answers', 'postcode'] }] as ValueExpr[],
      } satisfies EffectFunctionExpr
      const effect2 = {
        type: FunctionType.EFFECT,
        name: 'populateAddress',
        arguments: [] as ValueExpr[],
      } satisfies EffectFunctionExpr

      const json = {
        type: TransitionType.ACTION,
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['post', 'action'] } satisfies ReferenceExpr,
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['lookup'] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        effects: [effect1, effect2],
      } satisfies ActionTransition

      // Act
      const result = actionFactory.create(json) as ActionTransitionASTNode

      // Assert
      const effects = result.properties.effects as FunctionASTNode[]
      expect(effects).toHaveLength(2)

      expect(effects[0].type).toBe(ASTNodeType.EXPRESSION)
      expect(effects[0].expressionType).toBe(FunctionType.EFFECT)
      expect(effects[0].properties.name).toBe('fetchPostcode')

      expect(effects[1].type).toBe(ASTNodeType.EXPRESSION)
      expect(effects[1].expressionType).toBe(FunctionType.EFFECT)
      expect(effects[1].properties.name).toBe('populateAddress')
    })

    it('should handle empty effects array', () => {
      // Arrange
      const json = {
        type: TransitionType.ACTION,
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['post', 'action'] } satisfies ReferenceExpr,
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['noop'] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        effects: [] as EffectFunctionExpr[],
      } satisfies ActionTransition

      // Act
      const result = actionFactory.create(json) as ActionTransitionASTNode

      // Assert
      expect(result.properties.effects).toHaveLength(0)
    })

    it('should generate unique node IDs from the ID generator', () => {
      // Arrange
      const json = {
        type: TransitionType.ACTION,
        when: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['post', 'action'] } satisfies ReferenceExpr,
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: ['test'] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        effects: [] as EffectFunctionExpr[],
      } satisfies ActionTransition

      // Act
      const result = actionFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(typeof result.id).toBe('string')
    })
  })
})
