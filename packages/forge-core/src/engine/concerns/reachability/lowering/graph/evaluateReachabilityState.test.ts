import { beforeEach, describe, expect, it } from 'vitest'
import { joinPaths } from '../../../../../shared/routePath'
import type { ReachabilityStateTable, ReachabilityStateTableEntry } from '../../contracts/reachabilityModel.type'
import { CompiledReachabilityResult } from '../../../../chassis/contracts/compiled/compiledFunctions.type'
import { NodeId } from '../../../../chassis/contracts/ast/engine.type'
import { JourneyRouteTemplateCatalog } from '../../../route/contracts/routeTree.type'
import { StepFieldInventory } from '../../../answer-cleardown/contracts/stepFieldInventory.type'
import { evaluateReachabilityState } from './evaluateReachabilityState'

const routePathsByStepId = new Map<NodeId, string>()
const validationStepIds = new Set<NodeId>()
let stepValidities = new Map<NodeId, boolean>()

function createEntry(options: {
  stepId: NodeId
  path: string
  code?: string
  isEntryPoint?: boolean
  hasValidation?: boolean
}): ReachabilityStateTableEntry {
  routePathsByStepId.set(options.stepId, options.path)

  if (options.hasValidation) {
    validationStepIds.add(options.stepId)
  }

  return {
    stepId: options.stepId,
    code: options.code,
    isEntryPoint: options.isEntryPoint ?? false,
  }
}

function createRouteTemplateCatalog(entries: ReachabilityStateTableEntry[]): JourneyRouteTemplateCatalog {
  const routeTemplatePathByStepId = new Map<NodeId, string>()
  const stepIdByRouteTemplatePath = new Map<string, NodeId>()

  entries.forEach(entry => {
    const routePath = routePathsByStepId.get(entry.stepId) ?? entry.stepId
    const routeTemplatePath = joinPaths('/journey', routePath)

    routeTemplatePathByStepId.set(entry.stepId, routeTemplatePath)
    stepIdByRouteTemplatePath.set(routeTemplatePath, entry.stepId)
  })

  return {
    routeTemplatePathByStepId,
    stepIdByRouteTemplatePath,
  }
}

function createFacts(
  plan: ReachabilityStateTable,
  overrides: {
    entryResults?: Record<number, boolean>
    outcomeValues?: Record<number, string[]>
    declaredOutcomeValues?: Record<number, string[]>
    tieBreakerPriorities?: Record<number, number>
    resumeActive?: boolean
  } = {},
): CompiledReachabilityResult {
  const count = plan.entries.length

  return {
    entryResults: Array.from({ length: count }, (_, i) => overrides.entryResults?.[i]),
    outcomeValues: Array.from({ length: count }, (_, i) => overrides.outcomeValues?.[i] ?? []),
    declaredOutcomeValues: Array.from(
      { length: count },
      (_, i) => overrides.declaredOutcomeValues?.[i] ?? overrides.outcomeValues?.[i] ?? [],
    ),
    tieBreakerPriorities: Array.from({ length: count }, (_, i) => overrides.tieBreakerPriorities?.[i]),
    resumeActive: overrides.resumeActive ?? false,
  }
}

// The compiled state function receives reachability-mode validity as a boolean map:
// a step is present iff it has validation, and the value is its validity.
function setStepValidities(plan: ReachabilityStateTable, validStepIds: NodeId[]): void {
  stepValidities = new Map()

  plan.entries.forEach(entry => {
    if (!validationStepIds.has(entry.stepId)) {
      return
    }

    stepValidities.set(entry.stepId, validStepIds.includes(entry.stepId))
  })
}

describe('evaluateReachabilityState', () => {
  beforeEach(() => {
    routePathsByStepId.clear()
    validationStepIds.clear()
    stepValidities = new Map()
  })

  it('should seed unconditional and conditional entry points when entry results are true', () => {
    // Arrange
    const plan: ReachabilityStateTable = {
      entries: [
        createEntry({ stepId: 'compile_ast:1', path: 'start', isEntryPoint: true }),
        createEntry({ stepId: 'compile_ast:2', path: 'gated' }),
        createEntry({ stepId: 'compile_ast:3', path: 'later' }),
      ],
      unreachableRedirect: 'entry',
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)
    const facts = createFacts(plan, { entryResults: { 1: true } })

    // Act
    const { evaluation } = evaluateReachabilityState(plan, {
      facts,
      currentStepId: 'compile_ast:3',
      routeTemplateCatalog,
      stepValidities,
    })

    // Assert
    expect(evaluation.steps.filter(step => step.isReachable).map(step => step.routeTemplatePath)).toEqual([
      '/journey/start',
      '/journey/gated',
    ])
    expect(evaluation.defaultEntryRouteTemplatePath).toBe('/journey/start')
    expect(evaluation.unreachableRedirect).toBe('entry')
  })

  it('should not propagate reachability past an invalid step', () => {
    // Arrange
    const plan: ReachabilityStateTable = {
      entries: [
        createEntry({ stepId: 'compile_ast:110', path: 'entry', isEntryPoint: true, hasValidation: true }),
        createEntry({ stepId: 'compile_ast:111', path: 'middle', hasValidation: true }),
        createEntry({ stepId: 'compile_ast:112', path: 'end' }),
      ],
      unreachableRedirect: 'entry',
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)
    const facts = createFacts(plan, { outcomeValues: { 0: ['middle'], 1: ['end'] } })

    setStepValidities(plan, ['compile_ast:110'])

    // Act
    const { evaluation } = evaluateReachabilityState(plan, {
      facts,
      currentStepId: 'compile_ast:112',
      routeTemplateCatalog,
      stepValidities,
    })

    // Assert
    expect(evaluation.steps.find(step => step.stepId === 'compile_ast:111')?.isReachable).toBe(true)
    expect(evaluation.steps.find(step => step.stepId === 'compile_ast:111')?.isValid).toBe(false)
    expect(evaluation.steps.find(step => step.stepId === 'compile_ast:112')?.isReachable).toBe(false)
  })

  it('should redirect resume requests to the first invalid non-entry step on the progress path', () => {
    // Arrange
    const plan: ReachabilityStateTable = {
      entries: [
        createEntry({ stepId: 'compile_ast:30', path: 'your-name', isEntryPoint: true, hasValidation: true }),
        createEntry({ stepId: 'compile_ast:32', path: 'your-role', hasValidation: true }),
        createEntry({ stepId: 'compile_ast:34', path: 'check-answers', hasValidation: true }),
      ],
      unreachableRedirect: 'entry',
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)
    const facts = createFacts(plan, {
      outcomeValues: { 0: ['your-role'], 1: ['check-answers'] },
      resumeActive: true,
    })

    setStepValidities(plan, ['compile_ast:30'])

    // Act
    const { evaluation } = evaluateReachabilityState(plan, {
      facts,
      currentStepId: 'compile_ast:30',
      routeTemplateCatalog,
      stepValidities,
    })

    // Assert
    expect(evaluation.canonicalPathRouteTemplatePaths).toEqual(['/journey/your-name', '/journey/your-role'])
    expect(evaluation.frontierRouteTemplatePath).toBe('/journey/your-role')
    expect(evaluation.resumeOutcome).toBe('redirect')
  })

  it('should not redirect when the current step is already the frontier', () => {
    // Arrange
    const plan: ReachabilityStateTable = {
      entries: [
        createEntry({ stepId: 'compile_ast:40', path: 'your-name', isEntryPoint: true, hasValidation: true }),
        createEntry({ stepId: 'compile_ast:42', path: 'your-role', hasValidation: true }),
      ],
      unreachableRedirect: 'entry',
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)
    const facts = createFacts(plan, { outcomeValues: { 0: ['your-role'] }, resumeActive: true })

    setStepValidities(plan, ['compile_ast:40'])

    // Act
    const { evaluation } = evaluateReachabilityState(plan, {
      facts,
      currentStepId: 'compile_ast:42',
      routeTemplateCatalog,
      stepValidities,
    })

    // Assert
    expect(evaluation.frontierRouteTemplatePath).toBe('/journey/your-role')
    expect(evaluation.resumeOutcome).toBe('no-op')
  })

  it('should derive a canonical current-step path using predecessor tie-breakers for converging branches', () => {
    // Arrange
    const plan: ReachabilityStateTable = {
      entries: [
        createEntry({ stepId: 'compile_ast:70', path: 'entry', isEntryPoint: true }),
        createEntry({ stepId: 'compile_ast:73', path: 'branch-a', hasValidation: true }),
        createEntry({ stepId: 'compile_ast:75', path: 'branch-b', hasValidation: true }),
        createEntry({ stepId: 'compile_ast:77', path: 'merge', hasValidation: true }),
      ],
      unreachableRedirect: 'entry',
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)
    const facts = createFacts(plan, {
      outcomeValues: { 0: ['branch-a', 'branch-b'], 1: ['merge'], 2: ['merge'] },
      tieBreakerPriorities: { 1: 10, 2: 100 },
    })

    setStepValidities(plan, ['compile_ast:73', 'compile_ast:75', 'compile_ast:77'])

    // Act
    const { evaluation } = evaluateReachabilityState(plan, {
      facts,
      currentStepId: 'compile_ast:77',
      routeTemplateCatalog,
      stepValidities,
    })

    // Assert
    expect(evaluation.canonicalPathRouteTemplatePaths).toEqual([
      '/journey/entry',
      '/journey/branch-b',
      '/journey/merge',
    ])
  })

  it('should mark all steps reachable and skip the walk when reachabilityDisabled is true', () => {
    // Arrange
    const plan: ReachabilityStateTable = {
      entries: [
        createEntry({ stepId: 'compile_ast:90', path: 'page-one' }),
        createEntry({ stepId: 'compile_ast:91', path: 'page-two' }),
        createEntry({ stepId: 'compile_ast:92', path: 'page-three' }),
      ],
      unreachableRedirect: 'entry',
      reachabilityDisabled: true,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)
    const facts = createFacts(plan)

    // Act
    const { evaluation } = evaluateReachabilityState(plan, {
      facts,
      currentStepId: 'compile_ast:91',
      routeTemplateCatalog,
      stepValidities,
    })

    // Assert
    expect(evaluation.steps.every(step => step.isReachable)).toBe(true)
    expect(evaluation.defaultEntryRouteTemplatePath).toBe('/journey/page-one')
    expect(evaluation.resumeOutcome).toBe('no-op')
  })

  it('should fall back to the first declared step when no active entry point exists', () => {
    // Arrange
    const plan: ReachabilityStateTable = {
      entries: [
        createEntry({ stepId: 'compile_ast:80', path: 'first' }),
        createEntry({ stepId: 'compile_ast:81', path: 'second' }),
      ],
      unreachableRedirect: 'entry',
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)
    const facts = createFacts(plan)

    // Act
    const { evaluation } = evaluateReachabilityState(plan, {
      facts,
      currentStepId: 'compile_ast:81',
      routeTemplateCatalog,
      stepValidities,
    })

    // Assert
    expect(evaluation.defaultEntryRouteTemplatePath).toBe('/journey/first')
    expect(evaluation.steps.every(step => !step.isReachable)).toBe(true)
  })

  it('should propagate reachability through the current step to steps ahead of it', () => {
    // Arrange
    const plan: ReachabilityStateTable = {
      entries: [
        createEntry({ stepId: 'compile_ast:400', path: 'entry', isEntryPoint: true }),
        createEntry({ stepId: 'compile_ast:401', path: 'next' }),
        createEntry({ stepId: 'compile_ast:402', path: 'last' }),
      ],
      unreachableRedirect: 'entry',
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)
    const facts = createFacts(plan, { outcomeValues: { 0: ['next'], 1: ['last'] } })

    // Act
    const { evaluation } = evaluateReachabilityState(plan, {
      facts,
      currentStepId: 'compile_ast:400',
      routeTemplateCatalog,
      stepValidities,
    })

    // Assert
    expect(evaluation.steps.filter(step => step.isReachable).map(step => step.routeTemplatePath)).toEqual([
      '/journey/entry',
      '/journey/next',
      '/journey/last',
    ])
  })

  it('should project reachable and unreachable steps when field inventory and params are supplied', () => {
    // Arrange
    const plan: ReachabilityStateTable = {
      entries: [
        createEntry({
          stepId: 'compile_ast:200',
          path: 'entry',
          code: 'entry',
          isEntryPoint: true,
          hasValidation: true,
        }),
        createEntry({ stepId: 'compile_ast:201', path: 'question', code: 'question', hasValidation: true }),
        createEntry({ stepId: 'compile_ast:202', path: 'unreached', hasValidation: true }),
      ],
      unreachableRedirect: 'entry',
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)
    const facts = createFacts(plan, { outcomeValues: { 0: ['question'] } })
    const fieldInventory: StepFieldInventory[] = [
      { stepId: 'compile_ast:201', fieldCodes: ['question-field'], cleardownFieldCodes: ['question-clear'] },
    ]

    setStepValidities(plan, ['compile_ast:200', 'compile_ast:201'])

    // Act
    const { reachability } = evaluateReachabilityState(plan, {
      facts,
      currentStepId: 'compile_ast:201',
      routeTemplateCatalog,
      stepValidities,
      params: {},
      fieldInventory,
    })

    // Assert
    expect(reachability?.reachableSteps.map(step => step.path)).toEqual(['/journey/entry', '/journey/question'])
    expect(reachability?.unreachableSteps.map(step => step.path)).toEqual(['/journey/unreached'])
    const question = reachability?.reachableSteps.find(step => step.code === 'question')
    expect(question?.fieldCodes).toEqual(['question-field'])
    expect(question?.cleardownFieldCodes).toEqual(['question-clear'])
    expect(question?.backPath).toBe('/journey/entry')
  })

  it('should omit the projection when field inventory or params are absent', () => {
    // Arrange
    const plan: ReachabilityStateTable = {
      entries: [createEntry({ stepId: 'compile_ast:300', path: 'entry', isEntryPoint: true })],
      unreachableRedirect: 'entry',
      reachabilityDisabled: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)
    const facts = createFacts(plan)

    // Act
    const result = evaluateReachabilityState(plan, {
      facts,
      currentStepId: undefined,
      routeTemplateCatalog,
      stepValidities,
    })

    // Assert
    expect(result.reachability).toBeUndefined()
  })
})
