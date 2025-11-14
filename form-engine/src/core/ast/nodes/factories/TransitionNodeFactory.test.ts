import { ASTNodeType } from '@form-engine/core/types/enums'
import { TransitionType, FunctionType, LogicType, ExpressionType } from '@form-engine/form/types/enums'
import { NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import {
  FunctionASTNode,
  SubmitTransitionASTNode,
  LoadTransitionASTNode,
  AccessTransitionASTNode,
  NextASTNode,
} from '@form-engine/core/types/expressions.type'
import {
  LoadTransition,
  AccessTransition,
  ValidatingTransition,
  PredicateTestExpr,
  EffectFunctionExpr,
  NextExpr,
  ReferenceExpr,
  ValueExpr,
} from '@form-engine/form/types/expressions.type'
import { NodeFactory } from '../NodeFactory'
import { TransitionNodeFactory } from './TransitionNodeFactory'

describe('TransitionNodeFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let transitionFactory: TransitionNodeFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator)
    transitionFactory = new TransitionNodeFactory(nodeIDGenerator, nodeFactory)
  })

  describe('create', () => {
    it('should route to createLoadTransition for Load transitions', () => {
      const json = {
        type: TransitionType.LOAD,
        effects: [{ type: FunctionType.EFFECT, name: 'loadData', arguments: [] as ValueExpr[] }],
      } satisfies LoadTransition

      const result = transitionFactory.create(json) as LoadTransitionASTNode

      expect(result.type).toBe(ASTNodeType.TRANSITION)
      expect(result.transitionType).toBe(TransitionType.LOAD)
      expect(result.raw).toBe(json)
      expect(result.id).toBeDefined()
      expect(result.properties.effects !== undefined).toBe(true)
    })

    it('should route to createAccessTransition for Access transitions', () => {
      const json = {
        type: TransitionType.ACCESS,
        guards: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['test'] } satisfies ReferenceExpr,
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
      } satisfies AccessTransition

      const result = transitionFactory.create(json) as AccessTransitionASTNode

      expect(result.type).toBe(ASTNodeType.TRANSITION)
      expect(result.transitionType).toBe(TransitionType.ACCESS)
      expect(result.raw).toBe(json)
      expect(result.id).toBeDefined()
    })

    it('should route to createSubmitTransition for Submit transitions', () => {
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        onValid: {
          next: [{ type: ExpressionType.NEXT, goto: 'nextStep' }],
        },
        onInvalid: {
          next: [{ type: ExpressionType.NEXT, goto: 'currentStep' }],
        },
      } satisfies ValidatingTransition

      const result = transitionFactory.create(json)

      expect(result.type).toBe(ASTNodeType.TRANSITION)
      expect(result.transitionType).toBe(TransitionType.SUBMIT)
      expect(result.raw).toBe(json)
      expect(result.id).toBeDefined()
    })
  })

  describe('createLoadTransition', () => {
    it('should create a Load transition with effects', () => {
      const json = {
        type: TransitionType.LOAD,
        effects: [
          { type: FunctionType.EFFECT, name: 'loadUserData', arguments: [] as ValueExpr[] },
          { type: FunctionType.EFFECT, name: 'loadSettings', arguments: [] as ValueExpr[] },
        ],
      } satisfies LoadTransition

      const result = transitionFactory.create(json) as LoadTransitionASTNode

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.TRANSITION)
      expect(result.transitionType).toBe(TransitionType.LOAD)
      expect(result.properties.effects !== undefined).toBe(true)

      const effects = result.properties.effects as FunctionASTNode[]
      expect(Array.isArray(effects)).toBe(true)
      expect(effects).toHaveLength(2)

      // Verify effects are actual AST nodes, not just plain JSON
      effects.forEach(effect => {
        expect(effect).toHaveProperty('id')
        expect(effect).toHaveProperty('type')
        expect(effect).toHaveProperty('properties')
        expect(effect).toHaveProperty('raw')
      })

      expect(result.raw).toBe(json)
    })

    it('should transform each effect using real nodeFactory', () => {
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

      const result = transitionFactory.create(json) as LoadTransitionASTNode

      const effects = result.properties.effects as FunctionASTNode[]
      expect(effects).toHaveLength(2)

      // Verify that effects were transformed into real AST nodes
      expect(effects[0].type).toBe(ASTNodeType.EXPRESSION)
      expect(effects[0].expressionType).toBe(FunctionType.EFFECT)
      expect(effects[0].properties.name).toBe('effect1')

      expect(effects[1].type).toBe(ASTNodeType.EXPRESSION)
      expect(effects[1].expressionType).toBe(FunctionType.EFFECT)
      expect(effects[1].properties.name).toBe('effect2')
    })

    it('should generate unique node IDs from the ID generator', () => {
      const json = {
        type: TransitionType.LOAD,
        effects: [] as EffectFunctionExpr[],
      } satisfies LoadTransition

      const result = transitionFactory.create(json)

      expect(result.id).toBeDefined()
      expect(typeof result.id).toBe('string')
    })
  })

  describe('createAccessTransition', () => {
    it('should create an Access transition with guards', () => {
      const guards = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['field'] } satisfies ReferenceExpr,
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      } satisfies PredicateTestExpr

      const json = {
        type: TransitionType.ACCESS,
        guards,
      } satisfies AccessTransition

      const result = transitionFactory.create(json) as AccessTransitionASTNode

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.TRANSITION)
      expect(result.transitionType).toBe(TransitionType.ACCESS)
      expect(result.properties.guards).toBeDefined()

      // Verify guards was transformed into an AST node
      const guardsNode = result.properties.guards
      expect(guardsNode).toHaveProperty('id')
      expect(guardsNode).toHaveProperty('type')
      expect(guardsNode.type).toBe(ASTNodeType.EXPRESSION)

      expect(result.raw).toBe(json)
    })

    it('should create an Access transition with effects', () => {
      const json = {
        type: TransitionType.ACCESS,
        effects: [{ type: FunctionType.EFFECT, name: 'trackPageView', arguments: [] as ValueExpr[] }],
      } satisfies AccessTransition

      const result = transitionFactory.create(json) as AccessTransitionASTNode

      expect(result.properties.effects).toBeDefined()
      const effects = result.properties.effects
      expect(Array.isArray(effects)).toBe(true)
      expect(effects).toHaveLength(1)

      // Verify effect is a real AST node
      expect(effects[0].type).toBe(ASTNodeType.EXPRESSION)
      expect((effects[0] as FunctionASTNode).expressionType).toBe(FunctionType.EFFECT)
    })

    it('should create an Access transition with redirect', () => {
      const json = {
        type: TransitionType.ACCESS,
        redirect: [
          {
            type: ExpressionType.NEXT,
            when: {
              type: LogicType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['test'] } satisfies ReferenceExpr,
              negate: false,
              condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
            } satisfies PredicateTestExpr,
            goto: 'step1',
          } satisfies NextExpr,
        ],
      } satisfies AccessTransition

      const result = transitionFactory.create(json) as AccessTransitionASTNode

      expect(result.properties.redirect).toBeDefined()
      const redirect = result.properties.redirect
      expect(Array.isArray(redirect)).toBe(true)
      expect(redirect).toHaveLength(1)

      // Verify redirect item is a real AST node (Next expression)
      expect(redirect[0].type).toBe(ASTNodeType.EXPRESSION)
      expect((redirect[0] as NextASTNode).expressionType).toBe(ExpressionType.NEXT)
    })

    it('should create an Access transition with all properties', () => {
      const json = {
        type: TransitionType.ACCESS,
        guards: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['test'] } satisfies ReferenceExpr,
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        effects: [{ type: FunctionType.EFFECT, name: 'trackPageView', arguments: [] as ValueExpr[] }],
        redirect: [
          {
            type: ExpressionType.NEXT,
            when: {
              type: LogicType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['test'] } satisfies ReferenceExpr,
              negate: false,
              condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
            } satisfies PredicateTestExpr,
            goto: 'step1',
          } satisfies NextExpr,
        ],
      } satisfies AccessTransition

      const result = transitionFactory.create(json) as AccessTransitionASTNode

      expect(result.properties.guards).toBeDefined()
      expect(result.properties.effects).toBeDefined()
      expect(result.properties.redirect).toBeDefined()

      // Verify all are real AST nodes
      expect(result.properties.guards.type).toBe(ASTNodeType.EXPRESSION)
      expect(result.properties.effects[0].type).toBe(ASTNodeType.EXPRESSION)
      expect(result.properties.redirect[0].type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should create an Access transition with no optional properties', () => {
      const json = {
        type: TransitionType.ACCESS,
      }

      const result = transitionFactory.create(json) as AccessTransitionASTNode

      expect(result.properties.guards).toBeUndefined()
      expect(result.properties.effects).toBeUndefined()
      expect(result.properties.redirect).toBeUndefined()
    })

    it('should not set effects if not an array', () => {
      const json = {
        type: TransitionType.ACCESS,
        effects: 'not-an-array',
      }

      const result = transitionFactory.create(json) as AccessTransitionASTNode

      expect(result.properties.effects).toBeUndefined()
    })

    it('should not set redirect if not an array', () => {
      const json = {
        type: TransitionType.ACCESS,
        redirect: 'not-an-array',
      }

      const result = transitionFactory.create(json) as AccessTransitionASTNode

      expect(result.properties.redirect).toBeUndefined()
    })
  })

  describe('createSubmitTransition', () => {
    it('should create a Submit transition with when condition', () => {
      const when = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['test'] },
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      }
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        when,
      }

      const result = transitionFactory.create(json) as SubmitTransitionASTNode

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.TRANSITION)
      expect(result.transitionType).toBe(TransitionType.SUBMIT)
      expect(result.properties.when).toBeDefined()

      // Verify when is a real AST node
      const whenNode = result.properties.when
      expect(whenNode.type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should create a Submit transition with guards', () => {
      const guards = {
        type: LogicType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['test'] },
        condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
      }
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        guards,
      }

      const result = transitionFactory.create(json) as SubmitTransitionASTNode

      expect(result.properties.guards).toBeDefined()

      // Verify guards is a real AST node
      const guardsNode = result.properties.guards
      expect(guardsNode.type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should set validate to true when explicitly true', () => {
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
      }

      const result = transitionFactory.create(json) as SubmitTransitionASTNode

      expect(result.properties.validate).toBe(true)
    })

    it('should set validate to false when explicitly false', () => {
      const json = {
        type: TransitionType.SUBMIT,
        validate: false,
      }

      const result = transitionFactory.create(json) as SubmitTransitionASTNode

      expect(result.properties.validate).toBe(false)
    })

    it('should set validate property correctly', () => {
      // Test explicit true (ValidatingTransition)
      const result1 = transitionFactory.create({
        type: TransitionType.SUBMIT,
        validate: true,
        onValid: {
          next: [{ type: ExpressionType.NEXT, goto: '/valid' }],
        },
        onInvalid: {
          next: [{ type: ExpressionType.NEXT, goto: '/invalid' }],
        },
      } as any) as SubmitTransitionASTNode
      expect(result1.properties.validate).toBe(true)

      // Test explicit false (SkipValidationTransition)
      const result2 = transitionFactory.create({
        type: TransitionType.SUBMIT,
        validate: false,
        onAlways: {
          next: [{ type: ExpressionType.NEXT, goto: '/next' }],
        },
      } as any) as SubmitTransitionASTNode
      expect(result2.properties.validate).toBe(false)
    })

    it('should create a Submit transition with onAlways branch', () => {
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        onAlways: {
          effects: [{ type: FunctionType.EFFECT, name: 'saveData', arguments: [] as ValueExpr[] }],
          next: [{ type: ExpressionType.REFERENCE, path: ['nextStep'] }],
        },
      }

      const result = transitionFactory.create(json) as SubmitTransitionASTNode

      expect(result.properties.onAlways).toBeDefined()
      const onAlways = result.properties.onAlways
      expect(onAlways).toHaveProperty('effects')
      expect(onAlways).toHaveProperty('next')
      expect(Array.isArray(onAlways.effects)).toBe(true)
      expect(Array.isArray(onAlways.next)).toBe(true)

      // Verify effects and next are real AST nodes
      expect(onAlways.effects[0].type).toBe(ASTNodeType.EXPRESSION)
      expect(onAlways.next[0].type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should create a Submit transition with onValid branch', () => {
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        onValid: {
          effects: [{ type: FunctionType.EFFECT, name: 'submitForm', arguments: [] as ValueExpr[] }],
          next: [{ type: ExpressionType.REFERENCE, path: ['successStep'] }],
        },
      }

      const result = transitionFactory.create(json) as SubmitTransitionASTNode

      expect(result.properties.onValid).toBeDefined()
      const onValid = result.properties.onValid
      expect(onValid).toHaveProperty('effects')
      expect(onValid).toHaveProperty('next')

      // Verify they are real AST nodes
      expect(onValid.effects[0].type).toBe(ASTNodeType.EXPRESSION)
      expect(onValid.next[0].type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should create a Submit transition with onInvalid branch', () => {
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        onInvalid: {
          effects: [{ type: FunctionType.EFFECT, name: 'logError', arguments: [] as ValueExpr[] }],
          next: [{ type: ExpressionType.REFERENCE, path: ['errorStep'] }],
        },
      }

      const result = transitionFactory.create(json) as SubmitTransitionASTNode

      expect(result.properties.onInvalid).toBeDefined()
      const onInvalid = result.properties.onInvalid
      expect(onInvalid).toHaveProperty('effects')
      expect(onInvalid).toHaveProperty('next')

      // Verify they are real AST nodes
      expect(onInvalid.effects[0].type).toBe(ASTNodeType.EXPRESSION)
      expect(onInvalid.next[0].type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should create a Submit transition with all branches', () => {
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        onAlways: {
          effects: [{ type: FunctionType.EFFECT, name: 'always', arguments: [] as ValueExpr[] }],
        },
        onValid: {
          next: [{ type: ExpressionType.REFERENCE, path: ['nextStep'] }],
        },
        onInvalid: {
          effects: [{ type: FunctionType.EFFECT, name: 'invalid', arguments: [] as ValueExpr[] }],
          next: [{ type: ExpressionType.REFERENCE, path: ['errorStep'] }],
        },
      }

      const result = transitionFactory.create(json) as SubmitTransitionASTNode

      expect(result.properties.onAlways).toBeDefined()
      expect(result.properties.onValid).toBeDefined()
      expect(result.properties.onInvalid).toBeDefined()

      // Verify all contain real AST nodes
      expect(result.properties.onAlways.effects[0].type).toBe(ASTNodeType.EXPRESSION)
      expect(result.properties.onValid.next[0].type).toBe(ASTNodeType.EXPRESSION)
      expect(result.properties.onInvalid.effects[0].type).toBe(ASTNodeType.EXPRESSION)
      expect(result.properties.onInvalid.next[0].type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should handle branch with only effects', () => {
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        onAlways: {
          effects: [{ type: FunctionType.EFFECT, name: 'saveData', arguments: [] as ValueExpr[] }],
        },
      }

      const result = transitionFactory.create(json) as SubmitTransitionASTNode

      const onAlways = result.properties.onAlways
      expect(onAlways).toHaveProperty('effects')
      expect(onAlways).not.toHaveProperty('next')
    })

    it('should handle branch with only next', () => {
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        onValid: {
          next: [{ type: ExpressionType.REFERENCE, path: ['nextStep'] }],
        },
      }

      const result = transitionFactory.create(json) as SubmitTransitionASTNode

      const onValid = result.properties.onValid
      expect(onValid).toHaveProperty('next')
      expect(onValid).not.toHaveProperty('effects')
    })

    it('should return undefined for branch when branch is undefined', () => {
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
      }

      const result = transitionFactory.create(json) as SubmitTransitionASTNode

      expect(result.properties.onAlways).toBeUndefined()
      expect(result.properties.onValid).toBeUndefined()
      expect(result.properties.onInvalid).toBeUndefined()
    })

    it('should not set branch effects if not an array', () => {
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        onAlways: {
          effects: 'not-an-array',
        },
      }

      const result = transitionFactory.create(json) as SubmitTransitionASTNode

      const onAlways = result.properties.onAlways
      expect(onAlways).not.toHaveProperty('effects')
    })

    it('should not set branch next if not an array', () => {
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        onValid: {
          next: 'not-an-array',
        },
      }

      const result = transitionFactory.create(json) as SubmitTransitionASTNode

      const onValid = result.properties.onValid
      expect(onValid).not.toHaveProperty('next')
    })
  })
})
