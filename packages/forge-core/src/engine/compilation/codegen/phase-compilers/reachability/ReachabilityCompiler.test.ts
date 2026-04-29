import { ASTTestFactory } from '../../../../../testing/ASTTestFactory'
import { ASTNodeType } from '../../../../types/enums'
import { ExpressionType, FunctionType, OutcomeType, PredicateType } from '../../../../../authoring/types/enums'
import { FunctionASTNode, ReferenceASTNode, RedirectOutcomeASTNode } from '../../../../types/expressions.type'
import { TestPredicateASTNode } from '../../../../types/predicates.type'
import { ReachabilityRuntimePlan, ReachabilityStepEntry } from '../../../RuntimePlanBuilder'
import NodeRegistry from '../../../registries/NodeRegistry'
import { NodeId } from '../../../../types/ast.type'
import FunctionRegistry from '../../../../registries/FunctionRegistry'
import ForgeRuntimeEvaluationError from '../../../../errors/ForgeRuntimeEvaluationError'
import ReachabilityCompiler, { ReachabilityContext } from './ReachabilityCompiler'

function createReference(path: string[]): ReferenceASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.REFERENCE,
    id: ASTTestFactory.getId(),
    properties: { path },
  } as ReferenceASTNode
}

function createConditionFunction(name: string, args: unknown[] = []): FunctionASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: FunctionType.CONDITION,
    id: ASTTestFactory.getId(),
    properties: { name, arguments: args },
  } as FunctionASTNode
}

function createGeneratorFunction(name: string, args: unknown[] = []): FunctionASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: FunctionType.GENERATOR,
    id: ASTTestFactory.getId(),
    properties: { name, arguments: args },
  } as FunctionASTNode
}

function createTestPredicate(subject: ReferenceASTNode, condition: FunctionASTNode): TestPredicateASTNode {
  return {
    type: ASTNodeType.PREDICATE,
    predicateType: PredicateType.TEST,
    id: ASTTestFactory.getId(),
    properties: { subject, condition, negate: false },
  } as TestPredicateASTNode
}

function createRedirectOutcome(goto: string | FunctionASTNode, when?: TestPredicateASTNode): RedirectOutcomeASTNode {
  return {
    type: ASTNodeType.OUTCOME,
    outcomeType: OutcomeType.REDIRECT,
    id: ASTTestFactory.getId(),
    properties: { goto, when },
  } as RedirectOutcomeASTNode
}

function createEntry(overrides: Partial<ReachabilityStepEntry> = {}): ReachabilityStepEntry {
  return {
    stepId: ASTTestFactory.getId() as NodeId,
    path: '/step',
    isEntryPoint: false,
    forwardOutcomeIds: [],
    hasValidation: false,
    cleardownFieldCodes: [],
    iterateNodeIds: [],
    validationBlockIds: [],
    domainValidationNodeIds: [],
    reachabilityTieBreakers: [],
    ...overrides,
  }
}

function createPlan(overrides: Partial<ReachabilityRuntimePlan> = {}): ReachabilityRuntimePlan {
  return {
    entries: [],
    resumeAlways: false,
    reachabilityDisabled: false,
    ...overrides,
  }
}

function createCtx(overrides: Partial<ReachabilityContext> = {}): ReachabilityContext {
  return {
    answers: {},
    data: {},
    session: {},
    params: {},
    query: {},
    request: {},
    conditions: {
      get: vi.fn((name: string) => {
        if (name === 'isRequired') {
          return {
            evaluate: (value: unknown) =>
              value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== ''),
          }
        }

        if (name === 'equals') {
          return {
            evaluate: (value: unknown, expected: unknown) => value === expected,
          }
        }

        return { evaluate: () => false }
      }),
    } as unknown as ReachabilityContext['conditions'],
    ...overrides,
  }
}

describe('ReachabilityCompiler', () => {
  let compiler: ReachabilityCompiler
  let registry: NodeRegistry

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new ReachabilityCompiler()
    registry = new NodeRegistry()
  })

  describe('compile()', () => {
    it('should keep compiled reachability synchronous when registry functions are sync', () => {
      // Arrange
      const predicate = createTestPredicate(
        createReference(['data', 'isAdmin']),
        createConditionFunction('equals', [true]),
      )
      const plan = createPlan({
        entries: [createEntry({ entryWhenNodeId: predicate.id })],
      })
      const functionRegistry = new FunctionRegistry()

      registry.register(predicate.id, predicate)
      functionRegistry.register({
        equals: {
          name: 'equals',
          isAsync: false,
          evaluate: (value: unknown, expected: unknown) => value === expected,
        },
      })

      // Act
      const source = compiler.generateSource(plan, registry, functionRegistry)
      const fn = compiler.compile(plan, registry, functionRegistry)
      const result = fn!(
        createCtx({
          data: { isAdmin: true },
          conditions: functionRegistry,
        }),
      )

      // Assert
      expect(source).not.toContain('await')
      expect(result).not.toBeInstanceOf(Promise)

      if (result instanceof Promise) {
        throw new Error('Expected sync reachability result')
      }

      expect(result.entryResults[0]).toBe(true)
    })

    it('should await async reachability entry predicates when registry functions are async', async () => {
      // Arrange
      const predicate = createTestPredicate(
        createReference(['data', 'isAdmin']),
        createConditionFunction('equals', [true]),
      )
      const plan = createPlan({
        entries: [createEntry({ entryWhenNodeId: predicate.id })],
      })
      const functionRegistry = new FunctionRegistry()

      registry.register(predicate.id, predicate)
      functionRegistry.register({
        equals: {
          name: 'equals',
          isAsync: true,
          evaluate: async (value: unknown, expected: unknown) => value === expected,
        },
      })

      // Act
      const source = compiler.generateSource(plan, registry, functionRegistry)
      const fn = compiler.compile(plan, registry, functionRegistry)
      const result = await fn!(
        createCtx({
          data: { isAdmin: true },
          conditions: functionRegistry,
        }),
      )

      // Assert
      expect(source).toContain('await')
      expect(result.entryResults[0]).toBe(true)
    })

    it('should await async reachability outcome expressions when registry functions are async', async () => {
      // Arrange
      const outcome = createRedirectOutcome(createGeneratorFunction('nextPath'))
      const plan = createPlan({
        entries: [createEntry({ isEntryPoint: true, forwardOutcomeIds: [outcome.id] })],
      })
      const functionRegistry = new FunctionRegistry()

      registry.register(outcome.id, outcome)
      functionRegistry.register({
        nextPath: {
          name: 'nextPath',
          isAsync: true,
          evaluate: async () => 'next',
        },
      })

      // Act
      const source = compiler.generateSource(plan, registry, functionRegistry)
      const fn = compiler.compile(plan, registry, functionRegistry)
      const result = await fn!(createCtx({ conditions: functionRegistry }))

      // Assert
      expect(source).toContain('await')
      expect(result.outcomeValues[0]).toEqual(['next'])
    })

    it('should compile a plan with no dynamic nodes', () => {
      // Arrange
      const plan = createPlan({
        entries: [createEntry({ isEntryPoint: true })],
      })

      // Act
      const fn = compiler.compile(plan, registry)

      // Assert
      expect(fn).toBeDefined()
      const result = fn!(createCtx())
      expect(result.entryResults).toHaveLength(1)
      expect(result.entryResults[0]).toBeUndefined()
      expect(result.outcomeValues).toHaveLength(1)
      expect(result.outcomeValues[0]).toEqual([])
      expect(result.resumeActive).toBe(false)
    })

    it('should evaluate a conditional entry predicate as true', () => {
      // Arrange
      const predicate = createTestPredicate(
        createReference(['data', 'isAdmin']),
        createConditionFunction('equals', [true]),
      )

      registry.register(predicate.id, predicate)

      const plan = createPlan({
        entries: [createEntry({ entryWhenNodeId: predicate.id })],
      })

      const ctx = createCtx({ data: { isAdmin: true } })

      // Act
      const fn = compiler.compile(plan, registry)
      const result = fn!(ctx)

      // Assert
      expect(result.entryResults[0]).toBe(true)
    })

    it('should evaluate a conditional entry predicate as false', () => {
      // Arrange
      const predicate = createTestPredicate(
        createReference(['data', 'isAdmin']),
        createConditionFunction('equals', [true]),
      )

      registry.register(predicate.id, predicate)

      const plan = createPlan({
        entries: [createEntry({ entryWhenNodeId: predicate.id })],
      })

      const ctx = createCtx({ data: { isAdmin: false } })

      // Act
      const fn = compiler.compile(plan, registry)
      const result = fn!(ctx)

      // Assert
      expect(result.entryResults[0]).toBe(false)
    })
  })

  describe('forward outcomes', () => {
    it('should compile a static goto outcome', () => {
      // Arrange
      const outcome = createRedirectOutcome('/step-2')

      registry.register(outcome.id, outcome)

      const plan = createPlan({
        entries: [createEntry({ forwardOutcomeIds: [outcome.id] })],
      })

      // Act
      const fn = compiler.compile(plan, registry)
      const result = fn!(createCtx())

      // Assert
      expect(result.outcomeValues[0]).toEqual(['/step-2'])
    })

    it('should compile a guarded outcome that passes', () => {
      // Arrange
      const whenPred = createTestPredicate(
        createReference(['answers', 'choice']),
        createConditionFunction('equals', ['yes']),
      )
      const outcome = createRedirectOutcome('/step-2', whenPred)

      registry.register(outcome.id, outcome)

      const plan = createPlan({
        entries: [createEntry({ forwardOutcomeIds: [outcome.id] })],
      })

      const ctx = createCtx({ answers: { choice: { current: 'yes' } } })

      // Act
      const fn = compiler.compile(plan, registry)
      const result = fn!(ctx)

      // Assert
      expect(result.outcomeValues[0]).toEqual(['/step-2'])
    })

    it('should skip a guarded outcome that fails', () => {
      // Arrange
      const whenPred = createTestPredicate(
        createReference(['answers', 'choice']),
        createConditionFunction('equals', ['yes']),
      )
      const outcome = createRedirectOutcome('/step-2', whenPred)

      registry.register(outcome.id, outcome)

      const plan = createPlan({
        entries: [createEntry({ forwardOutcomeIds: [outcome.id] })],
      })

      const ctx = createCtx({ answers: { choice: { current: 'no' } } })

      // Act
      const fn = compiler.compile(plan, registry)
      const result = fn!(ctx)

      // Assert
      expect(result.outcomeValues[0]).toEqual([])
    })

    it('should compile multiple outcomes for one step', () => {
      // Arrange
      const outcome1 = createRedirectOutcome('/step-2')
      const outcome2 = createRedirectOutcome('/step-3')

      registry.register(outcome1.id, outcome1)
      registry.register(outcome2.id, outcome2)

      const plan = createPlan({
        entries: [createEntry({ forwardOutcomeIds: [outcome1.id, outcome2.id] })],
      })

      // Act
      const fn = compiler.compile(plan, registry)
      const result = fn!(createCtx())

      // Assert
      expect(result.outcomeValues[0]).toEqual(['/step-2', '/step-3'])
    })

    it('should compile match expressions in dynamic goto outcomes', () => {
      // Arrange
      const gotoMatch = ASTTestFactory.expression(ExpressionType.MATCH)
        .withProperty('branches', [
          {
            predicate: createTestPredicate(
              createReference(['answers', 'choice']),
              createConditionFunction('equals', ['yes']),
            ),
            value: '/step-yes',
          },
        ])
        .withProperty('otherwise', '/step-no')
        .build()
      const outcome = {
        type: ASTNodeType.OUTCOME,
        outcomeType: OutcomeType.REDIRECT,
        id: ASTTestFactory.getId(),
        properties: { goto: gotoMatch },
      } as RedirectOutcomeASTNode

      registry.register(outcome.id, outcome)

      const plan = createPlan({
        entries: [createEntry({ forwardOutcomeIds: [outcome.id] })],
      })

      const ctx = createCtx({ answers: { choice: { current: 'yes' } } })

      // Act
      const fn = compiler.compile(plan, registry)
      const result = fn!(ctx)

      // Assert
      expect(result.outcomeValues[0]).toEqual(['/step-yes'])
    })
  })

  describe('tie-breakers', () => {
    it('should compile a catch-all tie-breaker', () => {
      // Arrange
      const plan = createPlan({
        entries: [
          createEntry({
            reachabilityTieBreakers: [{ priority: 5 }],
          }),
        ],
      })

      // Act
      const fn = compiler.compile(plan, registry)
      const result = fn!(createCtx())

      // Assert
      expect(result.tieBreakerPriorities[0]).toBe(5)
    })

    it('should compile a conditional tie-breaker that matches', () => {
      // Arrange
      const pred = createTestPredicate(
        createReference(['data', 'priority']),
        createConditionFunction('equals', ['high']),
      )

      registry.register(pred.id, pred)

      const plan = createPlan({
        entries: [
          createEntry({
            reachabilityTieBreakers: [{ priority: 10, whenNodeId: pred.id }, { priority: 5 }],
          }),
        ],
      })

      const ctx = createCtx({ data: { priority: 'high' } })

      // Act
      const fn = compiler.compile(plan, registry)
      const result = fn!(ctx)

      // Assert
      expect(result.tieBreakerPriorities[0]).toBe(10)
    })

    it('should fall through to catch-all when conditional fails', () => {
      // Arrange
      const pred = createTestPredicate(
        createReference(['data', 'priority']),
        createConditionFunction('equals', ['high']),
      )

      registry.register(pred.id, pred)

      const plan = createPlan({
        entries: [
          createEntry({
            reachabilityTieBreakers: [{ priority: 10, whenNodeId: pred.id }, { priority: 5 }],
          }),
        ],
      })

      const ctx = createCtx({ data: { priority: 'low' } })

      // Act
      const fn = compiler.compile(plan, registry)
      const result = fn!(ctx)

      // Assert
      expect(result.tieBreakerPriorities[0]).toBe(5)
    })
  })

  describe('resume condition', () => {
    it('should set resumeActive true when resumeAlways', () => {
      // Arrange
      const plan = createPlan({ resumeAlways: true })

      // Act
      const fn = compiler.compile(plan, registry)
      const result = fn!(createCtx())

      // Assert
      expect(result.resumeActive).toBe(true)
    })

    it('should evaluate resume predicate as true', () => {
      // Arrange
      const pred = createTestPredicate(
        createReference(['data', 'hasProgress']),
        createConditionFunction('equals', [true]),
      )

      registry.register(pred.id, pred)

      const plan = createPlan({ resumeWhenNodeId: pred.id })

      const ctx = createCtx({ data: { hasProgress: true } })

      // Act
      const fn = compiler.compile(plan, registry)
      const result = fn!(ctx)

      // Assert
      expect(result.resumeActive).toBe(true)
    })

    it('should evaluate resume predicate as false', () => {
      // Arrange
      const pred = createTestPredicate(
        createReference(['data', 'hasProgress']),
        createConditionFunction('equals', [true]),
      )

      registry.register(pred.id, pred)

      const plan = createPlan({ resumeWhenNodeId: pred.id })

      const ctx = createCtx({ data: { hasProgress: false } })

      // Act
      const fn = compiler.compile(plan, registry)
      const result = fn!(ctx)

      // Assert
      expect(result.resumeActive).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should throw runtime errors for entry predicate failures', () => {
      // Arrange
      const pred = createTestPredicate(createReference(['data', 'value']), createConditionFunction('throwingCondition'))

      registry.register(pred.id, pred)

      const plan = createPlan({
        entries: [createEntry({ entryWhenNodeId: pred.id })],
      })

      const ctx = createCtx({
        conditions: {
          get: vi.fn(() => ({
            evaluate: () => {
              throw new Error('boom')
            },
          })),
        } as unknown as ReachabilityContext['conditions'],
      })

      // Act
      const fn = compiler.compile(plan, registry)
      const evaluate = () => fn!(ctx)

      // Assert
      expect(evaluate).toThrow(ForgeRuntimeEvaluationError)
    })
  })

  describe('generateSource()', () => {
    it('should produce readable source code', () => {
      // Arrange
      const pred = createTestPredicate(createReference(['data', 'isAdmin']), createConditionFunction('equals', [true]))
      const outcome = createRedirectOutcome('/step-2')

      registry.register(pred.id, pred)
      registry.register(outcome.id, outcome)

      const plan = createPlan({
        entries: [
          createEntry({
            entryWhenNodeId: pred.id,
            forwardOutcomeIds: [outcome.id],
          }),
        ],
      })

      // Act
      const source = compiler.generateSource(plan, registry)

      // Assert
      expect(source).toContain('"use strict"')
      expect(source).toContain('entryResults')
      expect(source).toContain('outcomeValues')
      expect(source).toContain('_forgeHelpers.evaluateFunction')
      expect(source).toContain('"equals"')
      expect(source).toContain('"/step-2"')
      expect(source).toContain('return {')
    })
  })

  describe('multi-step plan', () => {
    it('should compile a plan with multiple steps', () => {
      // Arrange
      const entryPred = createTestPredicate(
        createReference(['data', 'skipIntro']),
        createConditionFunction('equals', [true]),
      )
      const outcome1 = createRedirectOutcome('/step-2')
      const outcome2 = createRedirectOutcome('/step-3')

      registry.register(entryPred.id, entryPred)
      registry.register(outcome1.id, outcome1)
      registry.register(outcome2.id, outcome2)

      const plan = createPlan({
        entries: [
          createEntry({
            isEntryPoint: true,
            forwardOutcomeIds: [outcome1.id],
          }),
          createEntry({
            entryWhenNodeId: entryPred.id,
            forwardOutcomeIds: [outcome2.id],
            reachabilityTieBreakers: [{ priority: 10 }],
          }),
          createEntry(),
        ],
      })

      const ctx = createCtx({ data: { skipIntro: true } })

      // Act
      const fn = compiler.compile(plan, registry)
      const result = fn!(ctx)

      // Assert
      expect(result.entryResults).toHaveLength(3)
      expect(result.entryResults[0]).toBeUndefined()
      expect(result.entryResults[1]).toBe(true)
      expect(result.entryResults[2]).toBeUndefined()

      expect(result.outcomeValues[0]).toEqual(['/step-2'])
      expect(result.outcomeValues[1]).toEqual(['/step-3'])
      expect(result.outcomeValues[2]).toEqual([])

      expect(result.tieBreakerPriorities[1]).toBe(10)
    })
  })
})
