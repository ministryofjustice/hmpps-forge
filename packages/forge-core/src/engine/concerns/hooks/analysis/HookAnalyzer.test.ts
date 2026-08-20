import { FunctionType, HookType } from '../../../../authoring/types/enums'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import {
  createJourneyAnalysisContext,
  createStepAnalysisContext,
} from '../../../chassis/compilation/analysis/testing-helpers/analysisContexts'
import type { ASTNode } from '../../../chassis/contracts/ast/engine.type'
import type { AccessHookASTNode, SubmitHookASTNode } from '../../../chassis/contracts/ast/expressions.type'
import { AuthoredValueKind } from '../../../chassis/contracts/models/authoredValue.type'
import { HookOutcomeKind } from '../contracts/hookModel.type'
import HookAnalyzer from './HookAnalyzer'

function setParent(child: ASTNode, parent: ASTNode): void {
  Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
}

describe('HookAnalyzer', () => {
  let analyzer: HookAnalyzer

  beforeEach(() => {
    ASTTestFactory.resetIds()
    analyzer = new HookAnalyzer()
  })

  describe('analyzeStep()', () => {
    it('should collect access hooks root-first and submit hooks from the step', () => {
      // Arrange
      const journeyAccessHook = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const stepAccessHook = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const submitHook = ASTTestFactory.hook(HookType.SUBMIT).withProperty('validate', false).build()
      const journeyNode = ASTTestFactory.journey().withProperty('onAccess', [journeyAccessHook]).build()
      const stepNode = ASTTestFactory.step()
        .withPath('/step')
        .withProperty('onAccess', [stepAccessHook])
        .withProperty('onSubmission', [submitHook])
        .build()

      setParent(stepNode, journeyNode)

      // Act
      const model = analyzer.analyzeStep(createStepAnalysisContext({ stepNode }))

      // Assert
      expect(model.access.hooks.map(hook => hook.key)).toEqual(['access-hook-0', 'access-hook-1'])
      expect(model.submit.hooks.map(hook => hook.key)).toEqual(['submit-hook-0'])
    })

    it('should keep only effect nodes and stamp branch-scoped effect keys', () => {
      // Arrange
      const effect = ASTTestFactory.functionExpression(FunctionType.EFFECT, 'markAction')
      const nonEffect = ASTTestFactory.reference(['answers', 'ignored'])
      const submitHook = ASTTestFactory.hook(HookType.SUBMIT)
        .withProperty('validate', false)
        .withProperty('onAlways', { effects: [nonEffect, effect] })
        .build() as SubmitHookASTNode
      const stepNode = ASTTestFactory.step().withProperty('onSubmission', [submitHook]).build()

      // Act
      const model = analyzer.analyzeStep(createStepAnalysisContext({ stepNode }))

      // Assert
      const branch = model.submit.hooks[0].branches.onAlways

      expect(branch.effects).toHaveLength(1)
      expect(branch.effects[0].key).toBe('submit-hook-0-onAlways-effect-0')
      expect(branch.effects[0].name).toBe('markAction')
      expect(branch.effects[0].node.kind).toBe(AuthoredValueKind.EXPRESSION)
    })

    it('should default validation groups and omit unauthored branches', () => {
      // Arrange
      const submitHook = ASTTestFactory.hook(HookType.SUBMIT).withProperty('validate', true).build()
      const stepNode = ASTTestFactory.step().withProperty('onSubmission', [submitHook]).build()

      // Act
      const model = analyzer.analyzeStep(createStepAnalysisContext({ stepNode }))

      // Assert
      const hook = model.submit.hooks[0]

      expect(hook.validate).toBe(true)
      expect(hook.validationGroups).toEqual(['default'])
      expect(hook.branches.onAlways).toEqual({ effects: [], outcomes: [] })
      expect(hook.branches.onValid).toBeUndefined()
      expect(hook.branches.onInvalid).toBeUndefined()
    })

    it('should classify redirect and throw-error outcomes with static and dynamic values', () => {
      // Arrange
      const staticRedirect = ASTTestFactory.redirectOutcome({ goto: '/next' })
      const dynamicRedirect = ASTTestFactory.redirectOutcome({ goto: ASTTestFactory.reference(['data', 'target']) })
      const errorOutcome = ASTTestFactory.throwErrorOutcome({ status: 422, message: 'Invalid submission' })
      const accessHook = ASTTestFactory.hook(HookType.ACCESS)
        .withProperty('next', [staticRedirect, dynamicRedirect, errorOutcome])
        .build() as AccessHookASTNode
      const stepNode = ASTTestFactory.step().withProperty('onAccess', [accessHook]).build()

      // Act
      const model = analyzer.analyzeStep(createStepAnalysisContext({ stepNode }))

      // Assert
      const outcomes = model.access.hooks[0].outcomes

      expect(outcomes[0]).toEqual({ kind: HookOutcomeKind.REDIRECT, when: undefined, goto: '/next' })
      expect(outcomes[1].kind).toBe(HookOutcomeKind.REDIRECT)
      expect(outcomes[1]).toMatchObject({ goto: { kind: AuthoredValueKind.EXPRESSION } })
      expect(outcomes[2]).toEqual({
        kind: HookOutcomeKind.THROW_ERROR,
        when: undefined,
        status: 422,
        message: 'Invalid submission',
      })
    })
  })

  describe('analyzeJourney()', () => {
    it('should inherit access hooks from ancestor journeys root-first', () => {
      // Arrange
      const parentAccessHook = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const childAccessHook = ASTTestFactory.hook(HookType.ACCESS).build() as AccessHookASTNode
      const parentJourneyNode = ASTTestFactory.journey().withProperty('onAccess', [parentAccessHook]).build()
      const journeyNode = ASTTestFactory.journey().withProperty('onAccess', [childAccessHook]).build()

      setParent(journeyNode, parentJourneyNode)

      // Act
      const model = analyzer.analyzeJourney(createJourneyAnalysisContext({ journeyNode }))

      // Assert
      expect(model.access.hooks.map(hook => hook.key)).toEqual(['access-hook-0', 'access-hook-1'])
    })
  })
})
