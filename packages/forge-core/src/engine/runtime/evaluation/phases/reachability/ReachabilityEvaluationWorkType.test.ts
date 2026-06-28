import { describe, expect, it } from 'vitest'
import type { CompiledNavigationContext } from '../../../../contracts/compiled/compiledContexts.type'
import type { NavigationRuntimePlan } from '../../../../contracts/plans/runtimePlans.type'
import type { JourneyRouteTemplateCatalog } from '../../../../contracts/routing/routeTree.type'
import FunctionRegistry from '../../../../registries/FunctionRegistry'
import WorkContext from '../../work/WorkContext'
import WorkExecutor from '../../work/WorkExecutor'
import { createWorkTask } from '../../work/workTask'
import {
  REACHABILITY_EVALUATION_KIND,
  REACHABILITY_EVALUATION_WORK_HANDLER,
  REACHABILITY_EVALUATION_WORK_INSTRUMENTATION,
} from './ReachabilityEvaluationWorkHandler'

function createContext(): WorkContext<CompiledNavigationContext> {
  return new WorkContext({
    answers: {},
    data: {},
    session: {},
    params: {},
    query: {},
    request: {},
    conditions: new FunctionRegistry(),
    workTasks: {},
  })
}

function createPlan(): NavigationRuntimePlan {
  return {
    entries: [
      {
        stepId: 'compile_ast:1',
        code: 'start',
        isEntryPoint: true,
      },
    ],
    resumeConfigured: false,
    unreachableRedirect: 'entry',
    reachabilityDisabled: false,
  }
}

function createRouteTemplateCatalog(): JourneyRouteTemplateCatalog {
  return {
    routeTemplatePathByStepId: new Map([['compile_ast:1', '/journey/start']]),
    stepIdByRouteTemplatePath: new Map([['/journey/start', 'compile_ast:1']]),
  }
}

describe('ReachabilityEvaluationWorkHandler', () => {
  describe('begin()', () => {
    it('should evaluate navigation from compiled reachability props', async () => {
      // Arrange
      const task = createWorkTask('navigation', REACHABILITY_EVALUATION_WORK_HANDLER, {
        input: {
          plan: createPlan(),
          currentStepId: 'compile_ast:1',
          routeTemplateCatalog: createRouteTemplateCatalog(),
        },
        compiledResult: {
          entryResults: [undefined],
          outcomeValues: [[]],
          declaredOutcomeValues: [[]],
          tieBreakerPriorities: [undefined],
          resumeActive: false,
        },
      })

      // Act
      const completed = await new WorkExecutor().execute(task, createContext())

      // Assert
      expect(completed.output.evaluation.currentStepId).toBe('compile_ast:1')
      expect(completed.output.evaluation.defaultEntryRouteTemplatePath).toBe('/journey/start')
      expect(completed.output.evaluation.steps[0].isReachable).toBe(true)
    })

    it('should emit executor-owned trace fields', async () => {
      // Arrange
      const task = createWorkTask(
        'navigation',
        REACHABILITY_EVALUATION_WORK_HANDLER,
        {
          input: {
            plan: createPlan(),
            currentStepId: 'compile_ast:1',
            routeTemplateCatalog: createRouteTemplateCatalog(),
            params: {},
          },
          compiledResult: {
            entryResults: [undefined],
            outcomeValues: [[]],
            declaredOutcomeValues: [[]],
            tieBreakerPriorities: [undefined],
            resumeActive: false,
          },
        },
        REACHABILITY_EVALUATION_WORK_INSTRUMENTATION,
      )

      // Act
      const completed = await new WorkExecutor().executeWithUnit(task, createContext())

      // Assert
      expect(completed.workUnit.kind).toBe(REACHABILITY_EVALUATION_KIND)
      expect(completed.workUnit.beginFields).toEqual({
        currentStepId: 'compile_ast:1',
        stepCount: 1,
        hasParams: true,
        hasFieldInventory: false,
      })
      expect(completed.workUnit.completeFields).toMatchObject({
        resumeOutcome: 'no-op',
        resumeActive: false,
        reachableSteps: 1,
        defaultEntryRouteTemplatePath: '/journey/start',
        hasReachabilityProjection: false,
      })
    })
  })
})
