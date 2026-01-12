import { ASTNodeType } from '@form-engine/core/types/enums'
import { FunctionType, TransitionType } from '@form-engine/form/types/enums'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { FunctionASTNode, LoadTransitionASTNode } from '@form-engine/core/types/expressions.type'
import { EffectFunctionExpr, LoadTransition, ValueExpr } from '@form-engine/form/types/expressions.type'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import LoadFactory from './LoadFactory'

describe('LoadFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let loadFactory: LoadFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    loadFactory = new LoadFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create a Load transition with effects', () => {
      // Arrange
      const json = {
        type: TransitionType.LOAD,
        effects: [
          { type: FunctionType.EFFECT, name: 'loadUserData', arguments: [] as ValueExpr[] },
          { type: FunctionType.EFFECT, name: 'loadSettings', arguments: [] as ValueExpr[] },
        ],
      } satisfies LoadTransition

      // Act
      const result = loadFactory.create(json) as LoadTransitionASTNode

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.TRANSITION)
      expect(result.transitionType).toBe(TransitionType.LOAD)
      expect(result.properties.effects !== undefined).toBe(true)

      const effects = result.properties.effects as FunctionASTNode[]
      expect(Array.isArray(effects)).toBe(true)
      expect(effects).toHaveLength(2)

      effects.forEach(effect => {
        expect(effect).toHaveProperty('id')
        expect(effect).toHaveProperty('type')
        expect(effect).toHaveProperty('properties')
        expect(effect).toHaveProperty('raw')
      })

      expect(result.raw).toBe(json)
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
        type: TransitionType.LOAD,
        effects: [effect1, effect2],
      } satisfies LoadTransition

      // Act
      const result = loadFactory.create(json) as LoadTransitionASTNode

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

    it('should generate unique node IDs from the ID generator', () => {
      // Arrange
      const json = {
        type: TransitionType.LOAD,
        effects: [] as EffectFunctionExpr[],
      } satisfies LoadTransition

      // Act
      const result = loadFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(typeof result.id).toBe('string')
    })
  })
})
