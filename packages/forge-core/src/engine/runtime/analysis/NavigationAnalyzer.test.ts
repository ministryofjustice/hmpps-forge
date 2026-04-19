import { ReachabilityRuntimePlan, ReachabilityStepEntry } from '../../compilation/RuntimePlanBuilder'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter, ThunkResult } from '../../compilation/thunks/types'
import { joinPaths } from '../../../framework/path/routePath'
import { NodeId } from '../../types/engine.type'
import StepValidityAnalyzer, { StepValidityResult } from '../evaluation/StepValidityAnalyzer'
import { JourneyRouteTemplateCatalog } from '../types/routes.type'
import NavigationAnalyzer from './NavigationAnalyzer'

function createEntry(options: {
  stepId: NodeId
  path: string
  isEntryPoint?: boolean
  entryWhenNodeId?: NodeId
  forwardOutcomeIds?: NodeId[]
  hasValidation?: boolean
  cleardownFieldCodes?: ReachabilityStepEntry['cleardownFieldCodes']
  reachabilityTieBreakers?: ReachabilityStepEntry['reachabilityTieBreakers']
}): ReachabilityStepEntry {
  return {
    stepId: options.stepId,
    path: options.path,
    isEntryPoint: options.isEntryPoint ?? false,
    entryWhenNodeId: options.entryWhenNodeId,
    forwardOutcomeIds: options.forwardOutcomeIds ?? [],
    hasValidation: options.hasValidation ?? false,
    cleardownFieldCodes: options.cleardownFieldCodes ?? [],
    fieldIteratorRootIds: [],
    validationIterateNodeIds: [],
    validationBlockIds: [],
    domainValidationNodeIds: [],
    reachabilityTieBreakers: options.reachabilityTieBreakers ?? [],
  }
}

function successResult<T>(value: T): ThunkResult<T> {
  return { value, metadata: { source: 'test', timestamp: Date.now() } }
}

function createRouteTemplateCatalog(entries: ReachabilityStepEntry[]): JourneyRouteTemplateCatalog {
  const routeTemplatePathByStepId = new Map<NodeId, string>()
  const stepIdByRouteTemplatePath = new Map<string, NodeId>()

  entries.forEach(entry => {
    const routeTemplatePath = joinPaths('/journey', entry.path)

    routeTemplatePathByStepId.set(entry.stepId, routeTemplatePath)
    stepIdByRouteTemplatePath.set(routeTemplatePath, entry.stepId)
  })

  return {
    routeTemplatePathByStepId,
    stepIdByRouteTemplatePath,
  }
}

describe('NavigationAnalyzer', () => {
  let evaluator: NavigationAnalyzer
  let context: Mocked<ThunkEvaluationContext>
  let invoker: Mocked<ThunkInvocationAdapter>
  let mockStepValidityAnalyzer: Mocked<StepValidityAnalyzer>

  beforeEach(() => {
    evaluator = new NavigationAnalyzer()
    mockStepValidityAnalyzer = {
      execute: vi.fn().mockResolvedValue({
        isValid: true,
        fieldFailures: [],
        domainFailures: [],
      } satisfies StepValidityResult),
    } as unknown as Mocked<StepValidityAnalyzer>

    context = {
      global: {
        answers: {},
        data: {},
      },
      nodeRegistry: {
        findByType: vi.fn().mockReturnValue([]),
      },
      metadataRegistry: {},
    } as unknown as Mocked<ThunkEvaluationContext>

    invoker = {
      invoke: vi.fn().mockResolvedValue(successResult(undefined)),
      invokeSync: vi.fn(),
    } as unknown as Mocked<ThunkInvocationAdapter>
  })

  it('should seed reachability from all entry points', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({ stepId: 'compile_ast:1', path: 'one', isEntryPoint: true }),
        createEntry({ stepId: 'compile_ast:2', path: 'two', isEntryPoint: true }),
        createEntry({ stepId: 'compile_ast:3', path: 'three' }),
      ],
      resumeAlways: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:3',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.steps.filter(step => step.isReachable).map(step => step.routeTemplatePath)).toEqual([
      '/journey/one',
      '/journey/two',
    ])
    expect(result.steps.filter(step => !step.isReachable).map(step => step.routeTemplatePath)).toEqual([
      '/journey/three',
    ])
    expect(result.resumeActive).toBe(false)
  })

  it('should match internal redirects using canonical paths', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:4',
          path: 'one',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:5'],
        }),
        createEntry({ stepId: 'compile_ast:6', path: 'two' }),
      ],
      resumeAlways: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:5') {
        return successResult('two?tab=current#focus')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:6',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.steps.find(step => step.routeTemplatePath === '/journey/two')?.isReachable).toBe(true)
    expect(result.resumeActive).toBe(false)
  })

  it('should resolve relative ancestor redirects using route template paths', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:10',
          path: 'people/:personId/details',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:11'],
        }),
        createEntry({
          stepId: 'compile_ast:12',
          path: 'people/list',
        }),
      ],
      resumeAlways: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:11') {
        return successResult('../../people/list?from=details#errors')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:12',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.steps.find(step => step.routeTemplatePath === '/journey/people/list')?.isReachable).toBe(true)
    expect(result.resumeActive).toBe(false)
  })

  it('should exclude external and unknown absolute redirects from the reachability graph', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:13',
          path: 'entry',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:14', 'compile_ast:15'],
        }),
        createEntry({
          stepId: 'compile_ast:16',
          path: 'known',
        }),
      ],
      resumeAlways: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:14') {
        return successResult('https://service.test/logout')
      }

      if (nodeId === 'compile_ast:15') {
        return successResult('/help/contact')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:16',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.steps.find(step => step.routeTemplatePath === '/journey/entry')?.forwardRouteTemplatePaths).toEqual(
      [],
    )
    expect(result.steps.find(step => step.routeTemplatePath === '/journey/known')?.isReachable).toBe(false)
    expect(result.resumeActive).toBe(false)
  })

  it('should only evaluate validation for reachable steps', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:21',
          path: 'entry',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:22'],
        }),
        createEntry({
          stepId: 'compile_ast:23',
          path: 'reachable',
          hasValidation: true,
        }),
        createEntry({
          stepId: 'compile_ast:24',
          path: 'unreachable',
          hasValidation: true,
        }),
      ],
      resumeAlways: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:22') {
        return successResult('reachable')
      }

      return successResult(undefined)
    })

    // Act
    await evaluator.evaluate(plan, 'compile_ast:24', routeTemplateCatalog, invoker, context, mockStepValidityAnalyzer)

    // Assert
    const checkedStepIds = mockStepValidityAnalyzer.execute.mock.calls.map(call => call[0].stepId)

    expect(checkedStepIds).toContain('compile_ast:23')
    expect(checkedStepIds).not.toContain('compile_ast:24')
  })

  it('should record predecessor paths for reachable steps', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:50',
          path: 'first',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:51'],
        }),
        createEntry({
          stepId: 'compile_ast:52',
          path: 'second',
          forwardOutcomeIds: ['compile_ast:53'],
        }),
        createEntry({ stepId: 'compile_ast:54', path: 'third' }),
      ],
      resumeAlways: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:51') {
        return successResult('second')
      }

      if (nodeId === 'compile_ast:53') {
        return successResult('third')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:54',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(
      result.steps.find(step => step.routeTemplatePath === '/journey/first')?.predecessorRouteTemplatePaths,
    ).toEqual([])
    expect(
      result.steps.find(step => step.routeTemplatePath === '/journey/second')?.predecessorRouteTemplatePaths,
    ).toEqual(['/journey/first'])
    expect(
      result.steps.find(step => step.routeTemplatePath === '/journey/third')?.predecessorRouteTemplatePaths,
    ).toEqual(['/journey/second'])
    expect(result.resumeActive).toBe(false)
  })

  it('should record multiple predecessor paths for converging steps', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:55',
          path: 'branch-a',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:56'],
        }),
        createEntry({
          stepId: 'compile_ast:57',
          path: 'branch-b',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:58'],
        }),
        createEntry({ stepId: 'compile_ast:59', path: 'converge' }),
      ],
      resumeAlways: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:56' || nodeId === 'compile_ast:58') {
        return successResult('converge')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:59',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(
      result.steps.find(step => step.routeTemplatePath === '/journey/converge')?.predecessorRouteTemplatePaths,
    ).toEqual(['/journey/branch-a', '/journey/branch-b'])
    expect(result.resumeActive).toBe(false)
  })

  it('should assign tieBreakerPriority from the first matching when-thunk', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:70',
          path: 'entry',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:71'],
          reachabilityTieBreakers: [
            { priority: 100, whenNodeId: 'compile_ast:72' },
            { priority: 10, whenNodeId: 'compile_ast:73' },
          ],
        }),
        createEntry({ stepId: 'compile_ast:74', path: 'next' }),
      ],
      resumeAlways: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:71') {
        return successResult('next')
      }

      if (nodeId === 'compile_ast:72') {
        return successResult(false)
      }

      if (nodeId === 'compile_ast:73') {
        return successResult(true)
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:74',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.steps.find(step => step.stepId === 'compile_ast:70')?.tieBreakerPriority).toBe(10)
    expect(result.resumeActive).toBe(false)
  })

  it('should short-circuit tie-breaker evaluation on the first matching rule', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:75',
          path: 'entry',
          isEntryPoint: true,
          reachabilityTieBreakers: [
            { priority: 50, whenNodeId: 'compile_ast:76' },
            { priority: 5, whenNodeId: 'compile_ast:77' },
          ],
        }),
      ],
      resumeAlways: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    invoker.invoke.mockResolvedValue(successResult(true))

    // Act
    const result = await evaluator.evaluate(
      plan,
      undefined,
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.steps.find(step => step.stepId === 'compile_ast:75')?.tieBreakerPriority).toBe(50)
    expect(invoker.invoke).toHaveBeenCalledWith('compile_ast:76', context)
    expect(invoker.invoke).not.toHaveBeenCalledWith('compile_ast:77', context)
    expect(result.resumeActive).toBe(false)
  })

  it('should treat a tie-breaker with no whenNodeId as a catch-all', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:80',
          path: 'entry',
          isEntryPoint: true,
          reachabilityTieBreakers: [{ priority: 7 }],
        }),
      ],
      resumeAlways: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    // Act
    const result = await evaluator.evaluate(
      plan,
      undefined,
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.steps.find(step => step.stepId === 'compile_ast:80')?.tieBreakerPriority).toBe(7)
    expect(result.resumeActive).toBe(false)
  })

  it('should leave tieBreakerPriority undefined when no rule matches', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:85',
          path: 'entry',
          isEntryPoint: true,
          reachabilityTieBreakers: [{ priority: 99, whenNodeId: 'compile_ast:86' }],
        }),
      ],
      resumeAlways: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    invoker.invoke.mockResolvedValue(successResult(false))

    // Act
    const result = await evaluator.evaluate(
      plan,
      undefined,
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.steps.find(step => step.stepId === 'compile_ast:85')?.tieBreakerPriority).toBeUndefined()
    expect(result.resumeActive).toBe(false)
  })

  it('should only evaluate tie-breakers for reachable steps', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:90',
          path: 'entry',
          isEntryPoint: true,
          reachabilityTieBreakers: [{ priority: 1, whenNodeId: 'compile_ast:91' }],
        }),
        createEntry({
          stepId: 'compile_ast:92',
          path: 'orphan',
          reachabilityTieBreakers: [{ priority: 2, whenNodeId: 'compile_ast:93' }],
        }),
      ],
      resumeAlways: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    invoker.invoke.mockResolvedValue(successResult(true))

    // Act
    const result = await evaluator.evaluate(
      plan,
      undefined,
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.steps.find(step => step.stepId === 'compile_ast:90')?.tieBreakerPriority).toBe(1)
    expect(result.steps.find(step => step.stepId === 'compile_ast:92')?.tieBreakerPriority).toBeUndefined()
    expect(invoker.invoke).not.toHaveBeenCalledWith('compile_ast:93', context)
    expect(result.resumeActive).toBe(false)
  })

  it('should perform a full walk when currentStepId is undefined', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:95',
          path: 'entry',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:96'],
        }),
        createEntry({
          stepId: 'compile_ast:97',
          path: 'next',
          hasValidation: true,
        }),
      ],
      resumeAlways: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:96') {
        return successResult('next')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(
      plan,
      undefined,
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    const checkedStepIds = mockStepValidityAnalyzer.execute.mock.calls.map(call => call[0].stepId)

    expect(checkedStepIds).toEqual(['compile_ast:95', 'compile_ast:97'])
    expect(result.currentStepId).toBeUndefined()
    expect(result.steps.find(step => step.stepId === 'compile_ast:97')?.isReachable).toBe(true)
    expect(result.resumeActive).toBe(false)
  })

  it('should stop once the target step is reachable without validating the target step itself', async () => {
    // Arrange
    const plan: ReachabilityRuntimePlan = {
      entries: [
        createEntry({
          stepId: 'compile_ast:25',
          path: 'entry',
          isEntryPoint: true,
          forwardOutcomeIds: ['compile_ast:26'],
        }),
        createEntry({
          stepId: 'compile_ast:27',
          path: 'middle',
          hasValidation: true,
          forwardOutcomeIds: ['compile_ast:28'],
        }),
        createEntry({
          stepId: 'compile_ast:29',
          path: 'target',
          hasValidation: true,
          forwardOutcomeIds: ['compile_ast:30'],
        }),
        createEntry({
          stepId: 'compile_ast:31',
          path: 'after-target',
          hasValidation: true,
        }),
      ],
      resumeAlways: false,
    }
    const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === 'compile_ast:26') {
        return successResult('middle')
      }

      if (nodeId === 'compile_ast:28') {
        return successResult('target')
      }

      if (nodeId === 'compile_ast:30') {
        return successResult('after-target')
      }

      return successResult(undefined)
    })

    // Act
    const result = await evaluator.evaluate(
      plan,
      'compile_ast:29',
      routeTemplateCatalog,
      invoker,
      context,
      mockStepValidityAnalyzer,
    )

    // Assert
    expect(result.steps.find(step => step.routeTemplatePath === '/journey/target')?.isReachable).toBe(true)

    const checkedStepIds = mockStepValidityAnalyzer.execute.mock.calls.map(call => call[0].stepId)

    expect(checkedStepIds).toContain('compile_ast:27')
    expect(checkedStepIds).not.toContain('compile_ast:29')
    expect(checkedStepIds).not.toContain('compile_ast:31')
    expect(result.resumeActive).toBe(false)
  })

  function mockValidityByStepId(invalidStepIds: NodeId[]): void {
    const invalid = new Set(invalidStepIds)

    mockStepValidityAnalyzer.execute.mockImplementation(async entry => ({
      isValid: !invalid.has(entry.stepId),
      fieldFailures: [],
      domainFailures: [],
    }))
  }

  describe('redirectTargetRouteTemplatePath', () => {
    it('should return the entry step when the entry is invalid on a fresh journey', async () => {
      // Arrange
      const plan: ReachabilityRuntimePlan = {
        entries: [
          createEntry({
            stepId: 'compile_ast:100',
            path: 'entry',
            isEntryPoint: true,
            hasValidation: true,
            forwardOutcomeIds: ['compile_ast:101'],
          }),
          createEntry({ stepId: 'compile_ast:102', path: 'next', hasValidation: true }),
        ],
        resumeAlways: false,
      }
      const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

      mockValidityByStepId(['compile_ast:100'])
      invoker.invoke.mockImplementation(async nodeId => {
        if (nodeId === 'compile_ast:101') {
          return successResult('next')
        }

        return successResult(undefined)
      })

      // Act
      const result = await evaluator.evaluate(
        plan,
        undefined,
        routeTemplateCatalog,
        invoker,
        context,
        mockStepValidityAnalyzer,
      )

      // Assert
      expect(result.redirectTargetRouteTemplatePath).toBe('/journey/entry')
      expect(result.resumeActive).toBe(false)
    })

    it('should walk past a valid entry to the first invalid step', async () => {
      // Arrange
      const plan: ReachabilityRuntimePlan = {
        entries: [
          createEntry({
            stepId: 'compile_ast:110',
            path: 'entry',
            isEntryPoint: true,
            hasValidation: true,
            forwardOutcomeIds: ['compile_ast:111'],
          }),
          createEntry({
            stepId: 'compile_ast:112',
            path: 'middle',
            hasValidation: true,
            forwardOutcomeIds: ['compile_ast:113'],
          }),
          createEntry({ stepId: 'compile_ast:114', path: 'end', hasValidation: true }),
        ],
        resumeAlways: false,
      }
      const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

      mockValidityByStepId(['compile_ast:114'])
      invoker.invoke.mockImplementation(async nodeId => {
        if (nodeId === 'compile_ast:111') {
          return successResult('middle')
        }

        if (nodeId === 'compile_ast:113') {
          return successResult('end')
        }

        return successResult(undefined)
      })

      // Act
      const result = await evaluator.evaluate(
        plan,
        undefined,
        routeTemplateCatalog,
        invoker,
        context,
        mockStepValidityAnalyzer,
      )

      // Assert
      expect(result.redirectTargetRouteTemplatePath).toBe('/journey/end')
      expect(result.resumeActive).toBe(false)
    })

    it('should return the terminal valid step when the journey is complete', async () => {
      // Arrange
      const plan: ReachabilityRuntimePlan = {
        entries: [
          createEntry({
            stepId: 'compile_ast:120',
            path: 'entry',
            isEntryPoint: true,
            forwardOutcomeIds: ['compile_ast:121'],
          }),
          createEntry({ stepId: 'compile_ast:122', path: 'final' }),
        ],
        resumeAlways: false,
      }
      const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

      invoker.invoke.mockImplementation(async nodeId => {
        if (nodeId === 'compile_ast:121') {
          return successResult('final')
        }

        return successResult(undefined)
      })

      // Act
      const result = await evaluator.evaluate(
        plan,
        undefined,
        routeTemplateCatalog,
        invoker,
        context,
        mockStepValidityAnalyzer,
      )

      // Assert
      expect(result.redirectTargetRouteTemplatePath).toBe('/journey/final')
      expect(result.resumeActive).toBe(false)
    })

    it('should pick the blocker with the highest tie-breaker priority among multiple branches', async () => {
      // Arrange
      const plan: ReachabilityRuntimePlan = {
        entries: [
          createEntry({
            stepId: 'compile_ast:130',
            path: 'entry',
            isEntryPoint: true,
            forwardOutcomeIds: ['compile_ast:131', 'compile_ast:132'],
          }),
          createEntry({
            stepId: 'compile_ast:133',
            path: 'branch-a',
            hasValidation: true,
            reachabilityTieBreakers: [{ priority: 10 }],
          }),
          createEntry({
            stepId: 'compile_ast:134',
            path: 'branch-b',
            hasValidation: true,
            reachabilityTieBreakers: [{ priority: 100 }],
          }),
        ],
        resumeAlways: false,
      }
      const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

      mockValidityByStepId(['compile_ast:133', 'compile_ast:134'])
      invoker.invoke.mockImplementation(async nodeId => {
        if (nodeId === 'compile_ast:131') {
          return successResult('branch-a')
        }

        if (nodeId === 'compile_ast:132') {
          return successResult('branch-b')
        }

        return successResult(undefined)
      })

      // Act
      const result = await evaluator.evaluate(
        plan,
        undefined,
        routeTemplateCatalog,
        invoker,
        context,
        mockStepValidityAnalyzer,
      )

      // Assert
      expect(result.redirectTargetRouteTemplatePath).toBe('/journey/branch-b')
      expect(result.resumeActive).toBe(false)
    })

    it('should prefer the in-progress blocker over an untouched higher-priority entry', async () => {
      // Regression for multi-entry resume: when a user starts on a lower-priority
      // entry and progresses into its subtree, the frontier must land on the
      // in-progress blocker rather than the untouched higher-priority entry.

      // Arrange
      const plan: ReachabilityRuntimePlan = {
        entries: [
          createEntry({
            stepId: 'compile_ast:140',
            path: 'entry-low',
            isEntryPoint: true,
            forwardOutcomeIds: ['compile_ast:141'],
            reachabilityTieBreakers: [{ priority: 10 }],
          }),
          createEntry({
            stepId: 'compile_ast:142',
            path: 'entry-high',
            isEntryPoint: true,
            hasValidation: true,
            reachabilityTieBreakers: [{ priority: 50 }],
          }),
          createEntry({ stepId: 'compile_ast:143', path: 'after-low', hasValidation: true }),
        ],
        resumeAlways: false,
      }
      const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

      mockValidityByStepId(['compile_ast:142', 'compile_ast:143'])
      invoker.invoke.mockImplementation(async nodeId => {
        if (nodeId === 'compile_ast:141') {
          return successResult('after-low')
        }

        return successResult(undefined)
      })

      // Act
      const result = await evaluator.evaluate(
        plan,
        undefined,
        routeTemplateCatalog,
        invoker,
        context,
        mockStepValidityAnalyzer,
      )

      // Assert
      expect(result.redirectTargetRouteTemplatePath).toBe('/journey/after-low')
      expect(result.resumeActive).toBe(false)
    })

    it('should not loop forever on a cycle in the terminal walk', async () => {
      // Arrange
      const plan: ReachabilityRuntimePlan = {
        entries: [
          createEntry({
            stepId: 'compile_ast:150',
            path: 'a',
            isEntryPoint: true,
            forwardOutcomeIds: ['compile_ast:151'],
          }),
          createEntry({
            stepId: 'compile_ast:152',
            path: 'b',
            forwardOutcomeIds: ['compile_ast:153'],
          }),
        ],
        resumeAlways: false,
      }
      const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

      invoker.invoke.mockImplementation(async nodeId => {
        if (nodeId === 'compile_ast:151') {
          return successResult('b')
        }

        if (nodeId === 'compile_ast:153') {
          return successResult('a')
        }

        return successResult(undefined)
      })

      // Act
      const result = await evaluator.evaluate(
        plan,
        undefined,
        routeTemplateCatalog,
        invoker,
        context,
        mockStepValidityAnalyzer,
      )

      // Assert
      expect(result.redirectTargetRouteTemplatePath).toBe('/journey/b')
      expect(result.resumeActive).toBe(false)
    })

    it('should be undefined when the plan has no steps', async () => {
      // Arrange
      const plan: ReachabilityRuntimePlan = { entries: [], resumeAlways: false }
      const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

      // Act
      const result = await evaluator.evaluate(
        plan,
        undefined,
        routeTemplateCatalog,
        invoker,
        context,
        mockStepValidityAnalyzer,
      )

      // Assert
      expect(result.redirectTargetRouteTemplatePath).toBeUndefined()
      expect(result.resumeActive).toBe(false)
    })

    it('should select a conditional entry over blockers when it has a higher tie-breaker priority', async () => {
      // Arrange
      const plan: ReachabilityRuntimePlan = {
        entries: [
          createEntry({
            stepId: 'compile_ast:200',
            path: 'entry',
            isEntryPoint: true,
            hasValidation: true,
          }),
          createEntry({
            stepId: 'compile_ast:201',
            path: 'confirmation',
            entryWhenNodeId: 'compile_ast:202',
            reachabilityTieBreakers: [{ priority: 200 }],
          }),
        ],
        resumeAlways: false,
      }
      const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

      mockValidityByStepId(['compile_ast:200'])
      invoker.invoke.mockImplementation(async nodeId => {
        if (nodeId === 'compile_ast:202') {
          return successResult(true)
        }

        return successResult(undefined)
      })

      // Act
      const result = await evaluator.evaluate(
        plan,
        undefined,
        routeTemplateCatalog,
        invoker,
        context,
        mockStepValidityAnalyzer,
      )

      // Assert
      expect(result.redirectTargetRouteTemplatePath).toBe('/journey/confirmation')
      expect(result.resumeActive).toBe(false)
    })

    it('should select a blocker over a conditional entry when it has no tie-breaker', async () => {
      // Arrange
      const plan: ReachabilityRuntimePlan = {
        entries: [
          createEntry({
            stepId: 'compile_ast:200',
            path: 'entry',
            isEntryPoint: true,
            hasValidation: true,
          }),
          createEntry({
            stepId: 'compile_ast:201',
            path: 'confirmation',
            entryWhenNodeId: 'compile_ast:202',
          }),
        ],
        resumeAlways: false,
      }
      const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

      mockValidityByStepId(['compile_ast:200'])
      invoker.invoke.mockImplementation(async nodeId => {
        if (nodeId === 'compile_ast:202') {
          return successResult(true)
        }

        return successResult(undefined)
      })

      // Act
      const result = await evaluator.evaluate(
        plan,
        undefined,
        routeTemplateCatalog,
        invoker,
        context,
        mockStepValidityAnalyzer,
      )

      // Assert — blocker (entry) wins because both have no tie-breaker and entry comes first
      expect(result.redirectTargetRouteTemplatePath).toBe('/journey/entry')
      expect(result.resumeActive).toBe(false)
    })

    it('should fall back to normal blocker logic when conditional entry is inactive', async () => {
      // Arrange
      const plan: ReachabilityRuntimePlan = {
        entries: [
          createEntry({
            stepId: 'compile_ast:210',
            path: 'entry',
            isEntryPoint: true,
            hasValidation: true,
          }),
          createEntry({
            stepId: 'compile_ast:211',
            path: 'confirmation',
            entryWhenNodeId: 'compile_ast:212',
          }),
        ],
        resumeAlways: false,
      }
      const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

      mockValidityByStepId(['compile_ast:210'])
      invoker.invoke.mockImplementation(async nodeId => {
        if (nodeId === 'compile_ast:212') {
          return successResult(false)
        }

        return successResult(undefined)
      })

      // Act
      const result = await evaluator.evaluate(
        plan,
        undefined,
        routeTemplateCatalog,
        invoker,
        context,
        mockStepValidityAnalyzer,
      )

      // Assert
      expect(result.redirectTargetRouteTemplatePath).toBe('/journey/entry')
      expect(result.resumeActive).toBe(false)
    })
  })

  describe('conditional entry points', () => {
    it('should seed a conditional entry when the condition evaluates to true', async () => {
      // Arrange
      const plan: ReachabilityRuntimePlan = {
        entries: [
          createEntry({ stepId: 'compile_ast:220', path: 'start', isEntryPoint: true }),
          createEntry({
            stepId: 'compile_ast:221',
            path: 'gated',
            entryWhenNodeId: 'compile_ast:222',
          }),
        ],
        resumeAlways: false,
      }
      const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

      invoker.invoke.mockImplementation(async nodeId => {
        if (nodeId === 'compile_ast:222') {
          return successResult(true)
        }

        return successResult(undefined)
      })

      // Act
      const result = await evaluator.evaluate(
        plan,
        'compile_ast:221',
        routeTemplateCatalog,
        invoker,
        context,
        mockStepValidityAnalyzer,
      )

      // Assert
      expect(result.steps.find(step => step.stepId === 'compile_ast:221')?.isReachable).toBe(true)
      expect(result.steps.find(step => step.stepId === 'compile_ast:221')?.isConditionalEntry).toBe(true)
      expect(result.resumeActive).toBe(false)
    })

    it('should not seed a conditional entry when the condition evaluates to false', async () => {
      // Arrange
      const plan: ReachabilityRuntimePlan = {
        entries: [
          createEntry({ stepId: 'compile_ast:230', path: 'start', isEntryPoint: true }),
          createEntry({
            stepId: 'compile_ast:231',
            path: 'gated',
            entryWhenNodeId: 'compile_ast:232',
          }),
        ],
        resumeAlways: false,
      }
      const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

      invoker.invoke.mockImplementation(async nodeId => {
        if (nodeId === 'compile_ast:232') {
          return successResult(false)
        }

        return successResult(undefined)
      })

      // Act
      const result = await evaluator.evaluate(
        plan,
        'compile_ast:231',
        routeTemplateCatalog,
        invoker,
        context,
        mockStepValidityAnalyzer,
      )

      // Assert
      expect(result.steps.find(step => step.stepId === 'compile_ast:231')?.isReachable).toBe(false)
      expect(result.steps.find(step => step.stepId === 'compile_ast:231')?.isConditionalEntry).toBe(false)
      expect(result.resumeActive).toBe(false)
    })

    it('should allow a conditional entry to participate in tie-breaking', async () => {
      // Arrange
      const plan: ReachabilityRuntimePlan = {
        entries: [
          createEntry({
            stepId: 'compile_ast:240',
            path: 'entry',
            isEntryPoint: true,
            hasValidation: true,
          }),
          createEntry({
            stepId: 'compile_ast:241',
            path: 'conditional-a',
            entryWhenNodeId: 'compile_ast:242',
            reachabilityTieBreakers: [{ priority: 10 }],
          }),
          createEntry({
            stepId: 'compile_ast:243',
            path: 'conditional-b',
            entryWhenNodeId: 'compile_ast:244',
            reachabilityTieBreakers: [{ priority: 100 }],
          }),
        ],
        resumeAlways: false,
      }
      const routeTemplateCatalog = createRouteTemplateCatalog(plan.entries)

      mockValidityByStepId(['compile_ast:240'])
      invoker.invoke.mockImplementation(async nodeId => {
        if (nodeId === 'compile_ast:242' || nodeId === 'compile_ast:244') {
          return successResult(true)
        }

        return successResult(undefined)
      })

      // Act
      const result = await evaluator.evaluate(
        plan,
        undefined,
        routeTemplateCatalog,
        invoker,
        context,
        mockStepValidityAnalyzer,
      )

      // Assert
      expect(result.redirectTargetRouteTemplatePath).toBe('/journey/conditional-b')
      expect(result.resumeActive).toBe(false)
    })
  })
})
