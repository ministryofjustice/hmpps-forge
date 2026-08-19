import { ASTTestFactory } from '../../../compilation/ast/testing-helpers/ASTTestFactory'
import { ASTNodeType } from '../../../contracts/ast/enums'
import { ExpressionType, FunctionType, OutcomeType, PredicateType } from '../../../../authoring/types/enums'
import { FunctionASTNode, ReferenceASTNode, RedirectOutcomeASTNode } from '../../../contracts/ast/expressions.type'
import { TestPredicateASTNode } from '../../../contracts/ast/predicates.type'
import type {
  ReachabilityStateTable,
  ForwardOutcomeGroup,
  ReachabilityEntryModel,
  ReachabilityModel,
} from '../contracts/reachabilityModel.type'
import type { ASTNode, NodeId } from '../../../contracts/ast/ast.type'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import type { CompilationDependencies } from '../../../compilation/lowering/compilationDependencies.type'
import { getForgeRuntimeEvaluationDiagnostics } from '../../../errors/ForgeRuntimeEvaluationError'
import ReachabilityCompiler from './ReachabilityCompiler'
import type { CompiledReachabilityContext } from '../../../contracts/compiled/compiledContexts.type'
import { workTaskBuilders } from '../../../runtime/context/compiledEvaluationContext'

function createReference(path: string[]): ReferenceASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.REFERENCE,
    id: ASTTestFactory.getId(),
    diagnostics: ASTTestFactory.diagnostics(),
    properties: { path },
  } as ReferenceASTNode
}

function createConditionFunction(name: string, args: unknown[] = []): FunctionASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: FunctionType.CONDITION,
    id: ASTTestFactory.getId(),
    diagnostics: ASTTestFactory.diagnostics(),
    properties: { name, arguments: args },
  } as FunctionASTNode
}

function createGeneratorFunction(name: string, args: unknown[] = []): FunctionASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: FunctionType.GENERATOR,
    id: ASTTestFactory.getId(),
    diagnostics: ASTTestFactory.diagnostics(),
    properties: { name, arguments: args },
  } as FunctionASTNode
}

function createTestPredicate(subject: ReferenceASTNode, condition: FunctionASTNode): TestPredicateASTNode {
  return {
    type: ASTNodeType.PREDICATE,
    predicateType: PredicateType.TEST,
    id: ASTTestFactory.getId(),
    diagnostics: ASTTestFactory.diagnostics(),
    properties: { subject, condition, negate: false },
  } as TestPredicateASTNode
}

function createRedirectOutcome(goto: string | FunctionASTNode, when?: TestPredicateASTNode): RedirectOutcomeASTNode {
  return {
    type: ASTNodeType.OUTCOME,
    outcomeType: OutcomeType.REDIRECT,
    id: ASTTestFactory.getId(),
    diagnostics: ASTTestFactory.diagnostics(),
    properties: { goto, when },
  } as RedirectOutcomeASTNode
}

function createEntry(overrides: Partial<ReachabilityEntryModel> = {}): ReachabilityEntryModel {
  return {
    stepId: ASTTestFactory.getId() as NodeId,
    isEntryPoint: false,
    forwardOutcomeGroups: [],
    cleardownFieldCodes: [],
    reachabilityTieBreakers: [],
    ...overrides,
  }
}

function createGroup(
  outcomes: RedirectOutcomeASTNode[],
  hookWhen?: ASTNode,
  overApproximateOutcomes: RedirectOutcomeASTNode[] = [],
): ForwardOutcomeGroup {
  return {
    hookWhen,
    redirectOutcomes: outcomes.map(node => ({
      node,
      overApproximatesWhen: overApproximateOutcomes.includes(node),
    })),
  }
}

function createPlan(overrides: Partial<ReachabilityModel> = {}): ReachabilityModel {
  const entries = overrides.entries ?? []
  const stateTable = overrides.stateTable ?? createStateTable(entries)

  return {
    entries,
    resumeAlways: false,
    stateTable,
    ...overrides,
  }
}

function createStateTable(entries: readonly ReachabilityEntryModel[]): ReachabilityStateTable {
  return {
    entries: entries.map(entry => ({
      stepId: entry.stepId,
      code: entry.code,
      isEntryPoint: entry.isEntryPoint,
    })),
    unreachableRedirect: 'entry',
    reachabilityDisabled: false,
  }
}

function createCtx(overrides: Partial<CompiledReachabilityContext> = {}): CompiledReachabilityContext {
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
    } as unknown as CompiledReachabilityContext['conditions'],
    workTasks: workTaskBuilders,
    ...overrides,
  }
}

describe('ReachabilityCompiler', () => {
  let compiler: ReachabilityCompiler
  const dependencies: CompilationDependencies = {
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }

  dependencies.functionRegistry.register({
    equals: { name: 'equals', isAsync: true, evaluate: () => undefined },
    throwingCondition: { name: 'throwingCondition', isAsync: true, evaluate: () => undefined },
    nextStep: { name: 'nextStep', isAsync: false, evaluate: () => undefined },
  })

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new ReachabilityCompiler(dependencies)
  })

  describe('compile()', () => {
    it('should keep compiled reachability synchronous when registry functions are sync', async () => {
      // Arrange
      const predicate = createTestPredicate(
        createReference(['data', 'isAdmin']),
        createConditionFunction('equals', [true]),
      )
      const plan = createPlan({
        entries: [createEntry({ entryWhen: predicate })],
      })
      const functionRegistry = new FunctionRegistry()

      functionRegistry.register({
        equals: {
          name: 'equals',
          isAsync: false,
          evaluate: (value: unknown, expected: unknown) => value === expected,
        },
      })

      const localCompiler = new ReachabilityCompiler({ functionRegistry, componentRegistry: new ComponentRegistry() })

      // Act
      const source = localCompiler.generateFactsSource(plan)
      const fn = localCompiler.compileFacts(plan)
      const result = await fn!(
        createCtx({
          data: { isAdmin: true },
          conditions: functionRegistry,
        }),
      )

      // Assert
      expect(source).not.toContain('await')
      expect(result.entryResults[0]).toBe(true)
    })

    it('should await async reachability entry predicates when registry functions are async', async () => {
      // Arrange
      const predicate = createTestPredicate(
        createReference(['data', 'isAdmin']),
        createConditionFunction('equals', [true]),
      )
      const plan = createPlan({
        entries: [createEntry({ entryWhen: predicate })],
      })
      const functionRegistry = new FunctionRegistry()

      functionRegistry.register({
        equals: {
          name: 'equals',
          isAsync: true,
          evaluate: async (value: unknown, expected: unknown) => value === expected,
        },
      })

      const localCompiler = new ReachabilityCompiler({ functionRegistry, componentRegistry: new ComponentRegistry() })

      // Act
      const source = localCompiler.generateFactsSource(plan)
      const fn = localCompiler.compileFacts(plan)
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
        entries: [createEntry({ isEntryPoint: true, forwardOutcomeGroups: [createGroup([outcome])] })],
      })
      const functionRegistry = new FunctionRegistry()

      functionRegistry.register({
        nextPath: {
          name: 'nextPath',
          isAsync: true,
          evaluate: async () => 'next',
        },
      })

      const localCompiler = new ReachabilityCompiler({ functionRegistry, componentRegistry: new ComponentRegistry() })

      // Act
      const source = localCompiler.generateFactsSource(plan)
      const fn = localCompiler.compileFacts(plan)
      const result = await fn!(createCtx({ conditions: functionRegistry }))

      // Assert
      expect(source).toContain('await')
      expect(result.outcomeValues[0]).toEqual(['next'])
    })

    it('should compile a plan with no dynamic nodes', async () => {
      // Arrange
      const plan = createPlan({
        entries: [createEntry({ isEntryPoint: true })],
      })

      // Act
      const fn = compiler.compileFacts(plan)

      // Assert
      expect(fn).toBeDefined()
      const result = await fn!(createCtx())
      expect(result.entryResults).toHaveLength(1)
      expect(result.entryResults[0]).toBeUndefined()
      expect(result.outcomeValues).toHaveLength(1)
      expect(result.outcomeValues[0]).toEqual([])
      expect(result.resumeActive).toBe(false)
    })

    it('should evaluate a conditional entry predicate as true', async () => {
      // Arrange
      const predicate = createTestPredicate(
        createReference(['data', 'isAdmin']),
        createConditionFunction('equals', [true]),
      )

      const plan = createPlan({
        entries: [createEntry({ entryWhen: predicate })],
      })

      const ctx = createCtx({ data: { isAdmin: true } })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(ctx)

      // Assert
      expect(result.entryResults[0]).toBe(true)
    })

    it('should evaluate a conditional entry predicate as false', async () => {
      // Arrange
      const predicate = createTestPredicate(
        createReference(['data', 'isAdmin']),
        createConditionFunction('equals', [true]),
      )

      const plan = createPlan({
        entries: [createEntry({ entryWhen: predicate })],
      })

      const ctx = createCtx({ data: { isAdmin: false } })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(ctx)

      // Assert
      expect(result.entryResults[0]).toBe(false)
    })

    it('should set entryResult true when a non-predicate expression resolves truthy', async () => {
      // Arrange
      const plan = createPlan({
        entries: [createEntry({ entryWhen: createReference(['data', 'entryActive']) })],
      })

      const ctx = createCtx({ data: { entryActive: true } })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(ctx)

      // Assert
      expect(result.entryResults[0]).toBe(true)
    })

    it('should set entryResult false when a non-predicate expression resolves falsy', async () => {
      // Arrange
      const plan = createPlan({
        entries: [createEntry({ entryWhen: createReference(['data', 'entryActive']) })],
      })

      const ctx = createCtx({ data: { entryActive: false } })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(ctx)

      // Assert
      expect(result.entryResults[0]).toBe(false)
    })
  })

  describe('forward outcomes', () => {
    it('should compile a static goto outcome', async () => {
      // Arrange
      const outcome = createRedirectOutcome('/step-2')

      const plan = createPlan({
        entries: [createEntry({ forwardOutcomeGroups: [createGroup([outcome])] })],
      })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(createCtx())

      // Assert
      expect(result.outcomeValues[0]).toEqual(['/step-2'])
      expect(result.declaredOutcomeValues[0]).toEqual(['/step-2'])
    })

    it('should compile a guarded outcome that passes', async () => {
      // Arrange
      const whenPred = createTestPredicate(
        createReference(['answers', 'choice']),
        createConditionFunction('equals', ['yes']),
      )
      const outcome = createRedirectOutcome('/step-2', whenPred)

      const plan = createPlan({
        entries: [createEntry({ forwardOutcomeGroups: [createGroup([outcome])] })],
      })

      const ctx = createCtx({ answers: { choice: { current: 'yes' } } })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(ctx)

      // Assert
      expect(result.outcomeValues[0]).toEqual(['/step-2'])
    })

    it('should skip a guarded outcome that fails', async () => {
      // Arrange
      const whenPred = createTestPredicate(
        createReference(['answers', 'choice']),
        createConditionFunction('equals', ['yes']),
      )
      const outcome = createRedirectOutcome('/step-2', whenPred)

      const plan = createPlan({
        entries: [createEntry({ forwardOutcomeGroups: [createGroup([outcome])] })],
      })

      const ctx = createCtx({ answers: { choice: { current: 'no' } } })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(ctx)

      // Assert
      expect(result.outcomeValues[0]).toEqual([])
    })

    it('should compile the first matching outcome for one step', async () => {
      // Arrange
      const outcome1 = createRedirectOutcome('/step-2')
      const outcome2 = createRedirectOutcome('/step-3')

      const plan = createPlan({
        entries: [createEntry({ forwardOutcomeGroups: [createGroup([outcome1, outcome2])] })],
      })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(createCtx())

      // Assert
      expect(result.outcomeValues[0]).toEqual(['/step-2'])
      expect(result.declaredOutcomeValues[0]).toEqual(['/step-2', '/step-3'])
    })

    it('should not evaluate fallback outcomes when an earlier guard matches', async () => {
      // Arrange
      const whenPred = createTestPredicate(
        createReference(['answers', 'choice']),
        createConditionFunction('equals', ['yes']),
      )
      const guardedOutcome = createRedirectOutcome('/step-yes', whenPred)
      const fallbackOutcome = createRedirectOutcome('/step-fallback')

      const plan = createPlan({
        entries: [createEntry({ forwardOutcomeGroups: [createGroup([guardedOutcome, fallbackOutcome])] })],
      })

      const ctx = createCtx({ answers: { choice: { current: 'yes' } } })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(ctx)

      // Assert
      expect(result.outcomeValues[0]).toEqual(['/step-yes'])
      expect(result.declaredOutcomeValues[0]).toEqual(['/step-yes', '/step-fallback'])
    })

    it('should evaluate fallback outcomes when earlier guards fail', async () => {
      // Arrange
      const whenPred = createTestPredicate(
        createReference(['answers', 'choice']),
        createConditionFunction('equals', ['yes']),
      )
      const guardedOutcome = createRedirectOutcome('/step-yes', whenPred)
      const fallbackOutcome = createRedirectOutcome('/step-fallback')

      const plan = createPlan({
        entries: [createEntry({ forwardOutcomeGroups: [createGroup([guardedOutcome, fallbackOutcome])] })],
      })

      const ctx = createCtx({ answers: { choice: { current: 'no' } } })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(ctx)

      // Assert
      expect(result.outcomeValues[0]).toEqual(['/step-fallback'])
      expect(result.declaredOutcomeValues[0]).toEqual(['/step-yes', '/step-fallback'])
    })

    it('should keep fallback outcomes possible when outcome guards are unsafe for reachability', async () => {
      // Arrange
      const whenPred = createTestPredicate(
        createReference(['post', 'action']),
        createConditionFunction('equals', ['continue']),
      )
      const guardedOutcome = createRedirectOutcome('/step-guarded', whenPred)
      const fallbackOutcome = createRedirectOutcome('/step-fallback')

      const plan = createPlan({
        entries: [
          createEntry({
            forwardOutcomeGroups: [createGroup([guardedOutcome, fallbackOutcome], undefined, [guardedOutcome])],
          }),
        ],
      })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(createCtx())

      // Assert
      expect(result.outcomeValues[0]).toEqual(['/step-guarded', '/step-fallback'])
      expect(result.declaredOutcomeValues[0]).toEqual(['/step-guarded', '/step-fallback'])
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
        diagnostics: ASTTestFactory.diagnostics(),
        properties: { goto: gotoMatch },
      } as RedirectOutcomeASTNode

      const plan = createPlan({
        entries: [createEntry({ forwardOutcomeGroups: [createGroup([outcome])] })],
      })

      const ctx = createCtx({ answers: { choice: { current: 'yes' } } })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(ctx)

      // Assert
      expect(result.outcomeValues[0]).toEqual(['/step-yes'])
    })

    it('should contribute outcomes from every hook group when none have a compilable hook when', async () => {
      // Arrange
      const outcomeA = createRedirectOutcome('/step-a')
      const outcomeB = createRedirectOutcome('/step-b')

      const plan = createPlan({
        entries: [
          createEntry({
            forwardOutcomeGroups: [createGroup([outcomeA]), createGroup([outcomeB])],
          }),
        ],
      })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(createCtx())

      // Assert
      expect(result.outcomeValues[0]).toEqual(['/step-a', '/step-b'])
      expect(result.declaredOutcomeValues[0]).toEqual(['/step-a', '/step-b'])
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

      const plan = createPlan({
        entries: [
          createEntry({
            forwardOutcomeGroups: [createGroup([outcomeA], hookWhenA), createGroup([outcomeB], hookWhenB)],
          }),
        ],
      })

      const ctx = createCtx({ answers: { route: { current: 'a' } } })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(ctx)

      // Assert
      expect(result.outcomeValues[0]).toEqual(['/route-a'])
      expect(result.declaredOutcomeValues[0]).toEqual(['/route-a', '/route-b'])
    })

    it('should reset the cascade between hook groups so each contributes its first match', async () => {
      // Arrange
      const guardA = createTestPredicate(createReference(['answers', 'a']), createConditionFunction('equals', ['yes']))
      const guardB = createTestPredicate(createReference(['answers', 'b']), createConditionFunction('equals', ['yes']))
      const fallbackA = createRedirectOutcome('/a-fallback')
      const fallbackB = createRedirectOutcome('/b-fallback')
      const guardedA = createRedirectOutcome('/a-yes', guardA)
      const guardedB = createRedirectOutcome('/b-yes', guardB)

      const plan = createPlan({
        entries: [
          createEntry({
            forwardOutcomeGroups: [createGroup([guardedA, fallbackA]), createGroup([guardedB, fallbackB])],
          }),
        ],
      })

      const ctx = createCtx({ answers: { a: { current: 'no' }, b: { current: 'yes' } } })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(ctx)

      // Assert
      expect(result.outcomeValues[0]).toEqual(['/a-fallback', '/b-yes'])
    })
  })

  describe('tie-breakers', () => {
    it('should compile a catch-all tie-breaker', async () => {
      // Arrange
      const plan = createPlan({
        entries: [
          createEntry({
            reachabilityTieBreakers: [{ priority: 5 }],
          }),
        ],
      })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(createCtx())

      // Assert
      expect(result.tieBreakerPriorities[0]).toBe(5)
    })

    it('should compile a conditional tie-breaker that matches', async () => {
      // Arrange
      const pred = createTestPredicate(
        createReference(['data', 'priority']),
        createConditionFunction('equals', ['high']),
      )

      const plan = createPlan({
        entries: [
          createEntry({
            reachabilityTieBreakers: [{ priority: 10, when: pred }, { priority: 5 }],
          }),
        ],
      })

      const ctx = createCtx({ data: { priority: 'high' } })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(ctx)

      // Assert
      expect(result.tieBreakerPriorities[0]).toBe(10)
    })

    it('should fall through to catch-all when conditional fails', async () => {
      // Arrange
      const pred = createTestPredicate(
        createReference(['data', 'priority']),
        createConditionFunction('equals', ['high']),
      )

      const plan = createPlan({
        entries: [
          createEntry({
            reachabilityTieBreakers: [{ priority: 10, when: pred }, { priority: 5 }],
          }),
        ],
      })

      const ctx = createCtx({ data: { priority: 'low' } })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(ctx)

      // Assert
      expect(result.tieBreakerPriorities[0]).toBe(5)
    })
  })

  describe('resume condition', () => {
    it('should set resumeActive true when resumeAlways', async () => {
      // Arrange
      const plan = createPlan({ resumeAlways: true })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(createCtx())

      // Assert
      expect(result.resumeActive).toBe(true)
    })

    it('should evaluate resume predicate as true', async () => {
      // Arrange
      const pred = createTestPredicate(
        createReference(['data', 'hasProgress']),
        createConditionFunction('equals', [true]),
      )

      const plan = createPlan({ resumeWhen: pred })

      const ctx = createCtx({ data: { hasProgress: true } })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(ctx)

      // Assert
      expect(result.resumeActive).toBe(true)
    })

    it('should evaluate resume predicate as false', async () => {
      // Arrange
      const pred = createTestPredicate(
        createReference(['data', 'hasProgress']),
        createConditionFunction('equals', [true]),
      )

      const plan = createPlan({ resumeWhen: pred })

      const ctx = createCtx({ data: { hasProgress: false } })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(ctx)

      // Assert
      expect(result.resumeActive).toBe(false)
    })

    it('should set resumeActive true when a non-predicate expression resolves truthy', async () => {
      // Arrange
      const plan = createPlan({ resumeWhen: createReference(['data', 'resumeActive']) })

      const ctx = createCtx({ data: { resumeActive: true } })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(ctx)

      // Assert
      expect(result.resumeActive).toBe(true)
    })

    it('should set resumeActive false when a non-predicate expression resolves falsy', async () => {
      // Arrange
      const plan = createPlan({ resumeWhen: createReference(['data', 'resumeActive']) })

      const ctx = createCtx({ data: { resumeActive: false } })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(ctx)

      // Assert
      expect(result.resumeActive).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should throw runtime errors for entry predicate failures', async () => {
      // Arrange
      const pred = createTestPredicate(createReference(['data', 'value']), createConditionFunction('throwingCondition'))

      const plan = createPlan({
        entries: [createEntry({ entryWhen: pred })],
      })

      const ctx = createCtx({
        conditions: {
          get: vi.fn(() => ({
            evaluate: () => {
              throw new Error('boom')
            },
          })),
        } as unknown as CompiledReachabilityContext['conditions'],
      })

      // Act
      const fn = compiler.compileFacts(plan)

      // Assert
      await expect(fn!(ctx)).rejects.toThrow('boom')

      try {
        await fn!(ctx)
      } catch (error) {
        if (!(error instanceof Error)) {
          throw new Error('Expected throwingCondition to throw the original Error')
        }

        expect(getForgeRuntimeEvaluationDiagnostics(error)).toMatchObject({
          phase: 'reachability',
          functionName: 'throwingCondition',
          functionType: FunctionType.CONDITION,
        })
      }
    })
  })

  describe('generateSource()', () => {
    it('should produce readable source code', () => {
      // Arrange
      const pred = createTestPredicate(createReference(['data', 'isAdmin']), createConditionFunction('equals', [true]))
      const outcome = createRedirectOutcome('/step-2')

      const plan = createPlan({
        entries: [
          createEntry({
            entryWhen: pred,
            forwardOutcomeGroups: [createGroup([outcome])],
          }),
        ],
      })

      // Act
      const source = compiler.generateFactsSource(plan)

      // Assert
      expect(source).toContain('"use strict"')
      expect(source).toContain('entryResults')
      expect(source).toContain('outcomeValues')
      expect(source).toContain('_forgeHelpers.evaluateFunction')
      expect(source).toContain('"equals"')
      expect(source).toContain('"/step-2"')
      expect(source).toContain('return {')
    })

    it('should label sections with the step code and map indices in a step-order note', () => {
      // Arrange
      const outcome = createRedirectOutcome('/step-2')
      const plan = createPlan({
        entries: [
          createEntry({
            code: 'check-answers',
            entryWhen: createTestPredicate(
              createReference(['data', 'done']),
              createConditionFunction('equals', [true]),
            ),
            forwardOutcomeGroups: [createGroup([outcome])],
            reachabilityTieBreakers: [{ priority: 10 }],
          }),
        ],
      })

      // Act
      const source = compiler.generateFactsSource(plan)

      // Assert
      expect(source).toContain('Step order: 0 "check-answers"')
      expect(source).toContain('Entry predicate — step "check-answers"')
      expect(source).toContain('Forward outcomes — step "check-answers"')
      expect(source).toContain('Tie-breaker priority — step "check-answers"')
    })

    it('should collapse a single static outcome to one push without cascade scaffold', () => {
      // Arrange
      const plan = createPlan({
        entries: [createEntry({ forwardOutcomeGroups: [createGroup([createRedirectOutcome('/step-2')])] })],
      })

      // Act
      const source = compiler.generateFactsSource(plan)

      // Assert
      expect(source).toContain('outcomeValues[0].push("/step-2");')
      expect(source).not.toContain('outcomeMatched')
      expect(source).not.toContain('gotoValue')
      expect(source).not.toContain('String(')
    })

    it('should emit guarded static outcomes as an if/else chain without a latch', () => {
      // Arrange
      const guard = () =>
        createTestPredicate(createReference(['data', 'flag']), createConditionFunction('equals', [true]))
      const plan = createPlan({
        entries: [
          createEntry({
            forwardOutcomeGroups: [
              createGroup([
                createRedirectOutcome('/step-2', guard()),
                createRedirectOutcome('/step-3', guard()),
                createRedirectOutcome('/step-4'),
              ]),
            ],
          }),
        ],
      })

      // Act
      const source = compiler.generateFactsSource(plan)

      // Assert
      expect(source).toContain('else {')
      expect(source).toContain('outcomeWhen')
      expect(source).toContain('outcomeValues[0].push("/step-4");')
      expect(source).not.toContain('outcomeMatched')
    })

    it('should keep the runtime latch when a goto is a dynamic expression', () => {
      // Arrange
      const dynamicGoto = createGeneratorFunction('nextStep')
      const plan = createPlan({
        entries: [
          createEntry({
            forwardOutcomeGroups: [createGroup([createRedirectOutcome(dynamicGoto), createRedirectOutcome('/step-2')])],
          }),
        ],
      })

      // Act
      const source = compiler.generateFactsSource(plan)

      // Assert
      expect(source).toContain('outcomeMatched')
      expect(source).toContain('gotoValue')
      expect(source).toContain('gotoValue !== undefined')
    })

    it('should fold a single unconditional tie-breaker to a direct assignment', () => {
      // Arrange
      const plan = createPlan({
        entries: [createEntry({ reachabilityTieBreakers: [{ priority: 100 }] })],
      })

      // Act
      const source = compiler.generateFactsSource(plan)

      // Assert
      expect(source).toContain('tieBreakerPriorities[0] = 100;')
      expect(source).not.toContain('let tieBreakerPriority')
      expect(source).not.toContain('tieBreakerWhen')
    })

    it('should emit conditional tie-breakers as an if/else chain ending in the catch-all', () => {
      // Arrange
      const when = createTestPredicate(createReference(['data', 'flag']), createConditionFunction('equals', [true]))
      const plan = createPlan({
        entries: [createEntry({ reachabilityTieBreakers: [{ priority: 10, when }, { priority: 100 }] })],
      })

      // Act
      const source = compiler.generateFactsSource(plan)

      // Assert
      expect(source).toContain('tieBreakerWhen')
      expect(source).toContain('tieBreakerPriorities[0] = 10;')
      expect(source).toContain('tieBreakerPriorities[0] = 100;')
      expect(source).not.toContain('=== undefined')
    })
  })

  describe('multi-step plan', () => {
    it('should compile a plan with multiple steps', async () => {
      // Arrange
      const entryPred = createTestPredicate(
        createReference(['data', 'skipIntro']),
        createConditionFunction('equals', [true]),
      )
      const outcome1 = createRedirectOutcome('/step-2')
      const outcome2 = createRedirectOutcome('/step-3')

      const plan = createPlan({
        entries: [
          createEntry({
            isEntryPoint: true,
            forwardOutcomeGroups: [createGroup([outcome1])],
          }),
          createEntry({
            entryWhen: entryPred,
            forwardOutcomeGroups: [createGroup([outcome2])],
            reachabilityTieBreakers: [{ priority: 10 }],
          }),
          createEntry(),
        ],
      })

      const ctx = createCtx({ data: { skipIntro: true } })

      // Act
      const fn = compiler.compileFacts(plan)
      const result = await fn!(ctx)

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
