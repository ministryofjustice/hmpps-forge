import { ASTTestFactory } from '../../../ast/testing-helpers/ASTTestFactory'
import { ASTNodeType } from '../../../contracts/ast/enums'
import { ExpressionType, FunctionType, OutcomeType, PredicateType } from '../../../../authoring/types/enums'
import { FunctionASTNode, ReferenceASTNode, RedirectOutcomeASTNode } from '../../../contracts/ast/expressions.type'
import { TestPredicateASTNode } from '../../../contracts/ast/predicates.type'
import type {
  ForwardOutcomeGroup,
  ReachabilityCompilationEntry,
  ReachabilityCompilationPlan,
} from '../../../contracts/plans/compilationPlan.type'
import ASTNodeIndex from '../../../ast/ast-state/ASTNodeIndex'
import { NodeId } from '../../../contracts/ast/ast.type'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import type { CompilationDependencies } from '../../compilationDependencies.type'
import { getForgeRuntimeEvaluationDiagnostics } from '../../../errors/ForgeRuntimeEvaluationError'
import ReachabilityCompiler from './ReachabilityCompiler'
import type { ReachabilityContext } from '../../../contracts/compiled/phaseContexts.type'

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

function createEntry(overrides: Partial<ReachabilityCompilationEntry> = {}): ReachabilityCompilationEntry {
  return {
    stepId: ASTTestFactory.getId() as NodeId,
    isEntryPoint: false,
    forwardOutcomeGroups: [],
    hasValidation: false,
    cleardownFieldCodes: [],
    declaredOutcomes: [],
    reachabilityTieBreakers: [],
    ...overrides,
  }
}

function createGroup(outcomeIds: NodeId[], hookWhenNodeId?: NodeId): ForwardOutcomeGroup {
  return { outcomeIds, hookWhenNodeId }
}

function createPlan(overrides: Partial<ReachabilityCompilationPlan> = {}): ReachabilityCompilationPlan {
  const entries = overrides.entries ?? []

  return {
    entries,
    resumeAlways: false,
    navigationPlan: {
      entries: entries.map(entry => ({
        stepId: entry.stepId,
        code: entry.code,
        isEntryPoint: entry.isEntryPoint,
        hasValidation: entry.hasValidation,
        cleardownFieldCodes: entry.cleardownFieldCodes,
        declaredOutcomes: entry.declaredOutcomes,
      })),
      resumeConfigured: false,
      resumeAlways: false,
      unreachableRedirect: 'entry',
      reachabilityDisabled: false,
      compiledStepValidations: new Map(),
    },
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
  let registry: ASTNodeIndex
  const dependencies: CompilationDependencies = {
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new ReachabilityCompiler(dependencies)
    registry = new ASTNodeIndex()
  })

  describe('compileEntryPredicate()', () => {
    it('should return undefined when the entry has no entryWhen predicate', () => {
      // Arrange
      const entry = createEntry({ isEntryPoint: true })

      // Act
      const fn = compiler.compileEntryPredicate(entry, registry)

      // Assert
      expect(fn).toBeUndefined()
    })

    it('should keep the compiled predicate synchronous when registry functions are sync', () => {
      // Arrange
      const predicate = createTestPredicate(
        createReference(['data', 'isAdmin']),
        createConditionFunction('equals', [true]),
      )
      const functionRegistry = new FunctionRegistry()

      registry.register(predicate.id, predicate)
      functionRegistry.register({
        equals: {
          name: 'equals',
          isAsync: false,
          evaluate: (value: unknown, expected: unknown) => value === expected,
        },
      })

      const localCompiler = new ReachabilityCompiler({ functionRegistry, componentRegistry: new ComponentRegistry() })
      const fn = localCompiler.compileEntryPredicate(createEntry({ entryWhenNodeId: predicate.id }), registry)

      // Act
      const result = fn!(createCtx({ data: { isAdmin: true }, conditions: functionRegistry }))

      // Assert
      expect(result).not.toBeInstanceOf(Promise)
      expect(result).toBe(true)
    })

    it('should await async entry predicates when registry functions are async', async () => {
      // Arrange
      const predicate = createTestPredicate(
        createReference(['data', 'isAdmin']),
        createConditionFunction('equals', [true]),
      )
      const functionRegistry = new FunctionRegistry()

      registry.register(predicate.id, predicate)
      functionRegistry.register({
        equals: {
          name: 'equals',
          isAsync: true,
          evaluate: async (value: unknown, expected: unknown) => value === expected,
        },
      })

      const localCompiler = new ReachabilityCompiler({ functionRegistry, componentRegistry: new ComponentRegistry() })
      const fn = localCompiler.compileEntryPredicate(createEntry({ entryWhenNodeId: predicate.id }), registry)

      // Act
      const pending = fn!(createCtx({ data: { isAdmin: true }, conditions: functionRegistry }))

      // Assert
      expect(pending).toBeInstanceOf(Promise)
      expect(await pending).toBe(true)
    })

    it('should evaluate a conditional entry predicate as true', async () => {
      // Arrange
      const predicate = createTestPredicate(
        createReference(['data', 'isAdmin']),
        createConditionFunction('equals', [true]),
      )

      registry.register(predicate.id, predicate)

      const fn = compiler.compileEntryPredicate(createEntry({ entryWhenNodeId: predicate.id }), registry)

      // Act
      const result = await fn!(createCtx({ data: { isAdmin: true } }))

      // Assert
      expect(result).toBe(true)
    })

    it('should evaluate a conditional entry predicate as false', async () => {
      // Arrange
      const predicate = createTestPredicate(
        createReference(['data', 'isAdmin']),
        createConditionFunction('equals', [true]),
      )

      registry.register(predicate.id, predicate)

      const fn = compiler.compileEntryPredicate(createEntry({ entryWhenNodeId: predicate.id }), registry)

      // Act
      const result = await fn!(createCtx({ data: { isAdmin: false } }))

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('compileStepOutcomes()', () => {
    it('should return undefined when no hook contributes a redirect outcome', () => {
      // Arrange
      const entry = createEntry()

      // Act
      const fn = compiler.compileStepOutcomes(entry, registry)

      // Assert
      expect(fn).toBeUndefined()
    })

    it('should compile a static goto outcome', async () => {
      // Arrange
      const outcome = createRedirectOutcome('/step-2')

      registry.register(outcome.id, outcome)

      const fn = compiler.compileStepOutcomes(
        createEntry({ forwardOutcomeGroups: [createGroup([outcome.id])] }),
        registry,
      )

      // Act
      const result = await fn!(createCtx())

      // Assert
      expect(result).toEqual(['/step-2'])
    })

    it('should await async outcome expressions when registry functions are async', async () => {
      // Arrange
      const outcome = createRedirectOutcome(createGeneratorFunction('nextPath'))
      const functionRegistry = new FunctionRegistry()

      registry.register(outcome.id, outcome)
      functionRegistry.register({
        nextPath: {
          name: 'nextPath',
          isAsync: true,
          evaluate: async () => 'next',
        },
      })

      const localCompiler = new ReachabilityCompiler({ functionRegistry, componentRegistry: new ComponentRegistry() })
      const fn = localCompiler.compileStepOutcomes(
        createEntry({ forwardOutcomeGroups: [createGroup([outcome.id])] }),
        registry,
      )

      // Act
      const pending = fn!(createCtx({ conditions: functionRegistry }))

      // Assert
      expect(pending).toBeInstanceOf(Promise)
      expect(await pending).toEqual(['next'])
    })

    it('should compile a guarded outcome that passes', async () => {
      // Arrange
      const whenPred = createTestPredicate(
        createReference(['answers', 'choice']),
        createConditionFunction('equals', ['yes']),
      )
      const outcome = createRedirectOutcome('/step-2', whenPred)

      registry.register(outcome.id, outcome)

      const fn = compiler.compileStepOutcomes(
        createEntry({ forwardOutcomeGroups: [createGroup([outcome.id])] }),
        registry,
      )

      // Act
      const result = await fn!(createCtx({ answers: { choice: { current: 'yes' } } }))

      // Assert
      expect(result).toEqual(['/step-2'])
    })

    it('should skip a guarded outcome that fails', async () => {
      // Arrange
      const whenPred = createTestPredicate(
        createReference(['answers', 'choice']),
        createConditionFunction('equals', ['yes']),
      )
      const outcome = createRedirectOutcome('/step-2', whenPred)

      registry.register(outcome.id, outcome)

      const fn = compiler.compileStepOutcomes(
        createEntry({ forwardOutcomeGroups: [createGroup([outcome.id])] }),
        registry,
      )

      // Act
      const result = await fn!(createCtx({ answers: { choice: { current: 'no' } } }))

      // Assert
      expect(result).toEqual([])
    })

    it('should compile the first matching outcome for one step', async () => {
      // Arrange
      const outcome1 = createRedirectOutcome('/step-2')
      const outcome2 = createRedirectOutcome('/step-3')

      registry.register(outcome1.id, outcome1)
      registry.register(outcome2.id, outcome2)

      const fn = compiler.compileStepOutcomes(
        createEntry({ forwardOutcomeGroups: [createGroup([outcome1.id, outcome2.id])] }),
        registry,
      )

      // Act
      const result = await fn!(createCtx())

      // Assert
      expect(result).toEqual(['/step-2'])
    })

    it('should not evaluate fallback outcomes when an earlier guard matches', async () => {
      // Arrange
      const whenPred = createTestPredicate(
        createReference(['answers', 'choice']),
        createConditionFunction('equals', ['yes']),
      )
      const guardedOutcome = createRedirectOutcome('/step-yes', whenPred)
      const fallbackOutcome = createRedirectOutcome('/step-fallback')

      registry.register(guardedOutcome.id, guardedOutcome)
      registry.register(fallbackOutcome.id, fallbackOutcome)

      const fn = compiler.compileStepOutcomes(
        createEntry({ forwardOutcomeGroups: [createGroup([guardedOutcome.id, fallbackOutcome.id])] }),
        registry,
      )

      // Act
      const result = await fn!(createCtx({ answers: { choice: { current: 'yes' } } }))

      // Assert
      expect(result).toEqual(['/step-yes'])
    })

    it('should evaluate fallback outcomes when earlier guards fail', async () => {
      // Arrange
      const whenPred = createTestPredicate(
        createReference(['answers', 'choice']),
        createConditionFunction('equals', ['yes']),
      )
      const guardedOutcome = createRedirectOutcome('/step-yes', whenPred)
      const fallbackOutcome = createRedirectOutcome('/step-fallback')

      registry.register(guardedOutcome.id, guardedOutcome)
      registry.register(fallbackOutcome.id, fallbackOutcome)

      const fn = compiler.compileStepOutcomes(
        createEntry({ forwardOutcomeGroups: [createGroup([guardedOutcome.id, fallbackOutcome.id])] }),
        registry,
      )

      // Act
      const result = await fn!(createCtx({ answers: { choice: { current: 'no' } } }))

      // Assert
      expect(result).toEqual(['/step-fallback'])
    })

    it('should compile match expressions in dynamic goto outcomes', async () => {
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

      const fn = compiler.compileStepOutcomes(
        createEntry({ forwardOutcomeGroups: [createGroup([outcome.id])] }),
        registry,
      )

      // Act
      const result = await fn!(createCtx({ answers: { choice: { current: 'yes' } } }))

      // Assert
      expect(result).toEqual(['/step-yes'])
    })

    it('should contribute outcomes from every hook group when none have a compilable hook when', async () => {
      // Arrange
      const outcomeA = createRedirectOutcome('/step-a')
      const outcomeB = createRedirectOutcome('/step-b')

      registry.register(outcomeA.id, outcomeA)
      registry.register(outcomeB.id, outcomeB)

      const fn = compiler.compileStepOutcomes(
        createEntry({ forwardOutcomeGroups: [createGroup([outcomeA.id]), createGroup([outcomeB.id])] }),
        registry,
      )

      // Act
      const result = await fn!(createCtx())

      // Assert
      expect(result).toEqual(['/step-a', '/step-b'])
    })

    it('should evaluate the compilable hook when and skip outcomes when it is falsy', async () => {
      // Arrange
      const hookWhenA = createTestPredicate(
        createReference(['answers', 'route']),
        createConditionFunction('equals', ['a']),
      )
      const hookWhenB = createTestPredicate(
        createReference(['answers', 'route']),
        createConditionFunction('equals', ['b']),
      )
      const outcomeA = createRedirectOutcome('/route-a')
      const outcomeB = createRedirectOutcome('/route-b')

      registry.register(hookWhenA.id, hookWhenA)
      registry.register(hookWhenB.id, hookWhenB)
      registry.register(outcomeA.id, outcomeA)
      registry.register(outcomeB.id, outcomeB)

      const fn = compiler.compileStepOutcomes(
        createEntry({
          forwardOutcomeGroups: [createGroup([outcomeA.id], hookWhenA.id), createGroup([outcomeB.id], hookWhenB.id)],
        }),
        registry,
      )

      // Act
      const result = await fn!(createCtx({ answers: { route: { current: 'a' } } }))

      // Assert
      expect(result).toEqual(['/route-a'])
    })

    it('should reset the cascade between hook groups so each contributes its first match', async () => {
      // Arrange
      const guardA = createTestPredicate(createReference(['answers', 'a']), createConditionFunction('equals', ['yes']))
      const guardB = createTestPredicate(createReference(['answers', 'b']), createConditionFunction('equals', ['yes']))
      const fallbackA = createRedirectOutcome('/a-fallback')
      const fallbackB = createRedirectOutcome('/b-fallback')
      const guardedA = createRedirectOutcome('/a-yes', guardA)
      const guardedB = createRedirectOutcome('/b-yes', guardB)

      registry.register(guardA.id, guardA)
      registry.register(guardB.id, guardB)
      registry.register(fallbackA.id, fallbackA)
      registry.register(fallbackB.id, fallbackB)
      registry.register(guardedA.id, guardedA)
      registry.register(guardedB.id, guardedB)

      const fn = compiler.compileStepOutcomes(
        createEntry({
          forwardOutcomeGroups: [createGroup([guardedA.id, fallbackA.id]), createGroup([guardedB.id, fallbackB.id])],
        }),
        registry,
      )

      // Act
      const result = await fn!(createCtx({ answers: { a: { current: 'no' }, b: { current: 'yes' } } }))

      // Assert
      expect(result).toEqual(['/a-fallback', '/b-yes'])
    })
  })

  describe('compileTieBreaker()', () => {
    it('should return undefined when the entry declares no tie-breakers', () => {
      // Arrange
      const entry = createEntry()

      // Act
      const fn = compiler.compileTieBreaker(entry, registry)

      // Assert
      expect(fn).toBeUndefined()
    })

    it('should compile a catch-all tie-breaker', async () => {
      // Arrange
      const fn = compiler.compileTieBreaker(createEntry({ reachabilityTieBreakers: [{ priority: 5 }] }), registry)

      // Act
      const result = await fn!(createCtx())

      // Assert
      expect(result).toBe(5)
    })

    it('should compile a conditional tie-breaker that matches', async () => {
      // Arrange
      const pred = createTestPredicate(
        createReference(['data', 'priority']),
        createConditionFunction('equals', ['high']),
      )

      registry.register(pred.id, pred)

      const fn = compiler.compileTieBreaker(
        createEntry({ reachabilityTieBreakers: [{ priority: 10, whenNodeId: pred.id }, { priority: 5 }] }),
        registry,
      )

      // Act
      const result = await fn!(createCtx({ data: { priority: 'high' } }))

      // Assert
      expect(result).toBe(10)
    })

    it('should fall through to catch-all when conditional fails', async () => {
      // Arrange
      const pred = createTestPredicate(
        createReference(['data', 'priority']),
        createConditionFunction('equals', ['high']),
      )

      registry.register(pred.id, pred)

      const fn = compiler.compileTieBreaker(
        createEntry({ reachabilityTieBreakers: [{ priority: 10, whenNodeId: pred.id }, { priority: 5 }] }),
        registry,
      )

      // Act
      const result = await fn!(createCtx({ data: { priority: 'low' } }))

      // Assert
      expect(result).toBe(5)
    })
  })

  describe('compileResumePredicate()', () => {
    it('should return undefined when resume is always or unconfigured', () => {
      // Arrange
      const alwaysPlan = createPlan({ resumeAlways: true })
      const unconfiguredPlan = createPlan()

      // Act / Assert
      expect(compiler.compileResumePredicate(alwaysPlan, registry)).toBeUndefined()
      expect(compiler.compileResumePredicate(unconfiguredPlan, registry)).toBeUndefined()
    })

    it('should evaluate resume predicate as true', async () => {
      // Arrange
      const pred = createTestPredicate(
        createReference(['data', 'hasProgress']),
        createConditionFunction('equals', [true]),
      )

      registry.register(pred.id, pred)

      const fn = compiler.compileResumePredicate(createPlan({ resumeWhenNodeId: pred.id }), registry)

      // Act
      const result = await fn!(createCtx({ data: { hasProgress: true } }))

      // Assert
      expect(result).toBe(true)
    })

    it('should evaluate resume predicate as false', async () => {
      // Arrange
      const pred = createTestPredicate(
        createReference(['data', 'hasProgress']),
        createConditionFunction('equals', [true]),
      )

      registry.register(pred.id, pred)

      const fn = compiler.compileResumePredicate(createPlan({ resumeWhenNodeId: pred.id }), registry)

      // Act
      const result = await fn!(createCtx({ data: { hasProgress: false } }))

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should throw runtime errors for entry predicate failures', async () => {
      // Arrange
      const pred = createTestPredicate(createReference(['data', 'value']), createConditionFunction('throwingCondition'))

      registry.register(pred.id, pred)

      const fn = compiler.compileEntryPredicate(createEntry({ entryWhenNodeId: pred.id }), registry)
      const ctx = createCtx({
        conditions: {
          get: vi.fn(() => ({
            evaluate: () => {
              throw new Error('boom')
            },
          })),
        } as unknown as ReachabilityContext['conditions'],
      })

      // Act & Assert
      await expect(async () => fn!(ctx)).rejects.toThrow('boom')

      try {
        await fn!(ctx)
      } catch (error) {
        if (!(error instanceof Error)) {
          throw new Error('Expected throwingCondition to throw the original Error')
        }

        expect(getForgeRuntimeEvaluationDiagnostics(error)).toMatchObject({
          phase: 'navigation',
          functionName: 'throwingCondition',
          functionType: FunctionType.CONDITION,
        })
      }
    })
  })

  describe('multi-step plan', () => {
    it('should compile independent leaves for each step in the plan', async () => {
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
            forwardOutcomeGroups: [createGroup([outcome1.id])],
          }),
          createEntry({
            entryWhenNodeId: entryPred.id,
            forwardOutcomeGroups: [createGroup([outcome2.id])],
            reachabilityTieBreakers: [{ priority: 10 }],
          }),
          createEntry(),
        ],
      })

      const ctx = createCtx({ data: { skipIntro: true } })
      const leaves = plan.entries.map(entry => ({
        evaluateEntry: compiler.compileEntryPredicate(entry, registry),
        evaluateOutcomes: compiler.compileStepOutcomes(entry, registry),
        evaluateTieBreaker: compiler.compileTieBreaker(entry, registry),
      }))

      // Act
      const entryResults = await Promise.all(leaves.map(leaf => leaf.evaluateEntry?.(ctx)))
      const outcomeValues = await Promise.all(leaves.map(leaf => leaf.evaluateOutcomes?.(ctx) ?? []))
      const tieBreakerPriorities = await Promise.all(leaves.map(leaf => leaf.evaluateTieBreaker?.(ctx)))

      // Assert
      expect(entryResults).toEqual([undefined, true, undefined])
      expect(outcomeValues).toEqual([['/step-2'], ['/step-3'], []])
      expect(tieBreakerPriorities).toEqual([undefined, 10, undefined])
    })
  })
})
