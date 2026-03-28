import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType, OutcomeType, PredicateType, TransitionType } from '@form-engine/form/types/enums'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { RedirectOutcome, SubmitTransition, ValueExpr } from '@form-engine/form/types/expressions.type'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import SubmitFactory from './SubmitFactory'

describe('SubmitFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let submitFactory: SubmitFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    submitFactory = new SubmitFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create a Submit transition with when condition', () => {
      // Arrange
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        when: {
          type: PredicateType.TEST,
          negate: false,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] },
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        },
      } satisfies SubmitTransition

      // Act
      const result = submitFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.TRANSITION)
      expect(result.transitionType).toBe(TransitionType.SUBMIT)
      expect(result.properties.when).toBeDefined()

      const whenNode = result.properties.when
      expect(whenNode!.type).toBe(ASTNodeType.PREDICATE)
    })

    it('should create a Submit transition with guards', () => {
      // Arrange
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        guards: {
          type: PredicateType.TEST,
          negate: false,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'test'] },
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        },
      } satisfies SubmitTransition

      // Act
      const result = submitFactory.create(json)

      // Assert
      expect(result.properties.guards).toBeDefined()

      const guardsNode = result.properties.guards
      expect(guardsNode!.type).toBe(ASTNodeType.PREDICATE)
    })

    it('should set validate to true when explicitly true', () => {
      // Arrange
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
      } satisfies SubmitTransition

      // Act
      const result = submitFactory.create(json)

      // Assert
      expect(result.properties.validate).toBe(true)
    })

    it('should set validate to false when explicitly false', () => {
      // Arrange
      const json = {
        type: TransitionType.SUBMIT,
        validate: false,
      } satisfies SubmitTransition

      // Act
      const result = submitFactory.create(json)

      // Assert
      expect(result.properties.validate).toBe(false)
    })

    it('should set validate property correctly', () => {
      // Act
      const result1 = submitFactory.create({
        type: TransitionType.SUBMIT,
        validate: true,
        onValid: {
          next: [{ type: OutcomeType.REDIRECT, goto: '/valid' } satisfies RedirectOutcome],
        },
        onInvalid: {
          next: [{ type: OutcomeType.REDIRECT, goto: '/invalid' } satisfies RedirectOutcome],
        },
      } satisfies SubmitTransition)

      // Assert
      expect(result1.properties.validate).toBe(true)

      // Act
      const result2 = submitFactory.create({
        type: TransitionType.SUBMIT,
        validate: false,
        onAlways: {
          next: [{ type: OutcomeType.REDIRECT, goto: '/next' } satisfies RedirectOutcome],
        },
      } satisfies SubmitTransition)

      // Assert
      expect(result2.properties.validate).toBe(false)
    })

    it('should create a Submit transition with onAlways branch', () => {
      // Arrange
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        onAlways: {
          effects: [{ type: FunctionType.EFFECT, name: 'saveData', arguments: [] as ValueExpr[] }],
          next: [{ type: OutcomeType.REDIRECT, goto: '/next-step' } satisfies RedirectOutcome],
        },
      } satisfies SubmitTransition

      // Act
      const result = submitFactory.create(json)

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

    it('should create a Submit transition with onValid branch', () => {
      // Arrange
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        onValid: {
          effects: [{ type: FunctionType.EFFECT, name: 'submitForm', arguments: [] as ValueExpr[] }],
          next: [{ type: OutcomeType.REDIRECT, goto: '/success' } satisfies RedirectOutcome],
        },
      } satisfies SubmitTransition

      // Act
      const result = submitFactory.create(json)

      // Assert
      expect(result.properties.onValid).toBeDefined()
      const onValid = result.properties.onValid!
      expect(onValid).toHaveProperty('effects')
      expect(onValid).toHaveProperty('next')

      expect(onValid.effects![0].type).toBe(ASTNodeType.EXPRESSION)
      expect(onValid.next![0].type).toBe(ASTNodeType.OUTCOME)
    })

    it('should create a Submit transition with onInvalid branch', () => {
      // Arrange
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        onInvalid: {
          effects: [{ type: FunctionType.EFFECT, name: 'logError', arguments: [] as ValueExpr[] }],
          next: [{ type: OutcomeType.REDIRECT, goto: '/error' } satisfies RedirectOutcome],
        },
      } satisfies SubmitTransition

      // Act
      const result = submitFactory.create(json)

      // Assert
      expect(result.properties.onInvalid).toBeDefined()
      const onInvalid = result.properties.onInvalid!
      expect(onInvalid).toHaveProperty('effects')
      expect(onInvalid).toHaveProperty('next')

      expect(onInvalid.effects![0].type).toBe(ASTNodeType.EXPRESSION)
      expect(onInvalid.next![0].type).toBe(ASTNodeType.OUTCOME)
    })

    it('should create a Submit transition with all branches', () => {
      // Arrange
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        onAlways: {
          effects: [{ type: FunctionType.EFFECT, name: 'always', arguments: [] as ValueExpr[] }],
        },
        onValid: {
          next: [{ type: OutcomeType.REDIRECT, goto: '/next' } satisfies RedirectOutcome],
        },
        onInvalid: {
          effects: [{ type: FunctionType.EFFECT, name: 'invalid', arguments: [] as ValueExpr[] }],
          next: [{ type: OutcomeType.REDIRECT, goto: '/error' } satisfies RedirectOutcome],
        },
      } satisfies SubmitTransition

      // Act
      const result = submitFactory.create(json)

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
        type: TransitionType.SUBMIT,
        validate: true,
        onAlways: {
          effects: [{ type: FunctionType.EFFECT, name: 'saveData', arguments: [] as ValueExpr[] }],
        },
      } satisfies SubmitTransition

      // Act
      const result = submitFactory.create(json)

      // Assert
      const onAlways = result.properties.onAlways!
      expect(onAlways).toHaveProperty('effects')
      expect(onAlways).not.toHaveProperty('next')
    })

    it('should handle branch with only next', () => {
      // Arrange
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        onValid: {
          next: [{ type: OutcomeType.REDIRECT, goto: '/next' } satisfies RedirectOutcome],
        },
      } satisfies SubmitTransition

      // Act
      const result = submitFactory.create(json)

      // Assert
      const onValid = result.properties.onValid!
      expect(onValid).toHaveProperty('next')
      expect(onValid).not.toHaveProperty('effects')
    })

    it('should return undefined for branch when branch is undefined', () => {
      // Arrange
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
      } satisfies SubmitTransition

      // Act
      const result = submitFactory.create(json)

      // Assert
      expect(result.properties.onAlways).toBeUndefined()
      expect(result.properties.onValid).toBeUndefined()
      expect(result.properties.onInvalid).toBeUndefined()
    })

    it('should not set branch effects if not an array', () => {
      // Arrange
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        onAlways: {
          effects: 'not-an-array',
        },
      } as any

      // Act
      const result = submitFactory.create(json)

      // Assert
      const onAlways = result.properties.onAlways!
      expect(onAlways).not.toHaveProperty('effects')
    })

    it('should not set branch next if not an array', () => {
      // Arrange
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
        onValid: {
          next: 'not-an-array',
        },
      } as any

      // Act
      const result = submitFactory.create(json)

      // Assert
      const onValid = result.properties.onValid!
      expect(onValid).not.toHaveProperty('next')
    })

    it('should generate unique node IDs from the ID generator', () => {
      // Arrange
      const json = {
        type: TransitionType.SUBMIT,
        validate: true,
      } satisfies SubmitTransition

      // Act
      const result = submitFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(typeof result.id).toBe('string')
    })
  })
})
