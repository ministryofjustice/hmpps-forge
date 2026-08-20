import { FunctionType, HookType, OutcomeType, PredicateType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import type { RedirectOutcomeASTNode, SubmitHookASTNode } from '../../../chassis/contracts/ast/expressions.type'
import type { TestPredicateASTNode } from '../../../chassis/contracts/ast/predicates.type'
import type { StepASTNode } from '../../../chassis/contracts/ast/structures.type'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import ForwardNavigationAnalyzer from './ForwardNavigationAnalyzer'

function createSubmitHookWithRedirect(
  options: {
    readonly when?: TestPredicateASTNode
    readonly outcomeWhen?: TestPredicateASTNode
    readonly goto?: string
    readonly validate?: boolean
    readonly includeValidOutcome?: boolean
    readonly includeThrowOutcome?: boolean
  } = {},
): { hook: SubmitHookASTNode; redirect: RedirectOutcomeASTNode; validRedirect?: RedirectOutcomeASTNode } {
  const redirect = ASTTestFactory.redirectOutcome({
    goto: options.goto ?? '/next',
    when: options.outcomeWhen,
  })
  const hookBuilder = ASTTestFactory.hook(HookType.SUBMIT)
    .withProperty('validate', options.validate ?? false)
    .withProperty('onAlways', { next: [redirect] })

  if (options.when !== undefined) {
    hookBuilder.withProperty('when', options.when)
  }

  if (options.includeThrowOutcome) {
    hookBuilder.withProperty('onAlways', {
      next: [
        redirect,
        {
          type: ASTNodeType.OUTCOME,
          outcomeType: OutcomeType.THROW_ERROR,
          id: ASTTestFactory.getId(),
          properties: { status: 400, message: 'Nope' },
        },
      ],
    })
  }

  if (options.includeValidOutcome) {
    const validRedirect = ASTTestFactory.redirectOutcome({ goto: '/valid' })

    hookBuilder.withProperty('onValid', { next: [validRedirect] })

    return { hook: hookBuilder.build() as SubmitHookASTNode, redirect, validRedirect }
  }

  return { hook: hookBuilder.build() as SubmitHookASTNode, redirect }
}

function createStep(hooks: SubmitHookASTNode[]): StepASTNode {
  return ASTTestFactory.step()
    .withProperty('onSubmission', hooks)
    .build()
}

function createPredicate(path: string[]): TestPredicateASTNode {
  return ASTTestFactory.predicate(PredicateType.TEST, {
    subject: ASTTestFactory.reference(path),
    condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'equals', ['continue']),
  }) as TestPredicateASTNode
}

describe('ForwardNavigationAnalyzer', () => {
  let analyzer: ForwardNavigationAnalyzer

  beforeEach(() => {
    ASTTestFactory.resetIds()
    analyzer = new ForwardNavigationAnalyzer()
  })

  describe('analyze()', () => {
    it('should preserve forward outcomes as one group per submit hook', () => {
      // Arrange
      const { hook: firstHook, redirect: firstRedirect } = createSubmitHookWithRedirect({ goto: '/check' })
      const { hook: secondHook, redirect: secondRedirect } = createSubmitHookWithRedirect({ goto: '/add' })
      const stepNode = createStep([firstHook, secondHook])

      // Act
      const result = analyzer.analyze(stepNode)

      // Assert
      expect(result.forwardOutcomeGroups).toEqual([
        { hookWhen: undefined, redirectOutcomes: [{ node: firstRedirect, overApproximatesWhen: false }] },
        { hookWhen: undefined, redirectOutcomes: [{ node: secondRedirect, overApproximatesWhen: false }] },
      ])
    })

    it('should preserve a stable hook predicate on its forward outcome group', () => {
      // Arrange
      const hookWhen = createPredicate(['answers', 'route'])
      const { hook, redirect } = createSubmitHookWithRedirect({ when: hookWhen, goto: '/route-a' })
      const stepNode = createStep([hook])

      // Act
      const result = analyzer.analyze(stepNode)

      // Assert
      expect(result.forwardOutcomeGroups).toEqual([
        { hookWhen, redirectOutcomes: [{ node: redirect, overApproximatesWhen: false }] },
      ])
    })

    it('should over-approximate hook predicates that reference request-time namespaces', () => {
      // Arrange
      const hookWhen = createPredicate(['post', 'action'])
      const { hook, redirect } = createSubmitHookWithRedirect({ when: hookWhen, goto: '/check' })
      const stepNode = createStep([hook])

      // Act
      const result = analyzer.analyze(stepNode)

      // Assert
      expect(result.forwardOutcomeGroups).toEqual([
        { hookWhen: undefined, redirectOutcomes: [{ node: redirect, overApproximatesWhen: false }] },
      ])
    })

    it('should mark outcome predicates that reference request-time namespaces as over-approximated', () => {
      // Arrange
      const outcomeWhen = createPredicate(['request', 'method'])
      const { hook, redirect } = createSubmitHookWithRedirect({ outcomeWhen, goto: '/check' })
      const stepNode = createStep([hook])

      // Act
      const result = analyzer.analyze(stepNode)

      // Assert
      expect(result.forwardOutcomeGroups).toEqual([
        { hookWhen: undefined, redirectOutcomes: [{ node: redirect, overApproximatesWhen: true }] },
      ])
    })

    it('should include valid outcomes only when the hook validates and ignore non-redirect outcomes', () => {
      // Arrange
      const { hook, redirect, validRedirect } = createSubmitHookWithRedirect({
        validate: true,
        includeValidOutcome: true,
        includeThrowOutcome: true,
      })
      const stepNode = createStep([hook])

      // Act
      const result = analyzer.analyze(stepNode)

      // Assert
      expect(result.forwardOutcomeGroups).toEqual([
        {
          hookWhen: undefined,
          redirectOutcomes: [
            { node: redirect, overApproximatesWhen: false },
            { node: validRedirect, overApproximatesWhen: false },
          ],
        },
      ])
    })
  })
})
