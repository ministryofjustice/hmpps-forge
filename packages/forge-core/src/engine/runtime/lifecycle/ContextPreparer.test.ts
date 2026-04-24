import { ASTTestFactory } from '../../../testing/ASTTestFactory'
import { JourneyASTNode, StepASTNode } from '../../types/structures.type'
import { NodeId, AstNodeId, JourneyInstanceDependencies } from '../../types/engine.type'
import { StepRuntimePlan } from '../../compilation/RuntimePlanBuilder'
import type { StepRequest, StepResponse } from '../../../framework'
import { CompilationDependencies } from '../../compilation/CompilationDependencies'
import ContextPreparer from './ContextPreparer'

function createStep(data?: Record<string, unknown>): StepASTNode {
  const builder = ASTTestFactory.step().withPath('/step').withTitle('Step')

  if (data) {
    builder.withProperty('data', data)
  }

  return builder.build()
}

function createJourney(data?: Record<string, unknown>): JourneyASTNode {
  const builder = ASTTestFactory.journey().withProperty('path', '/journey').withCode('j').withTitle('Journey')

  if (data) {
    builder.withProperty('data', data)
  }

  return builder.build()
}

function setupMocks(ancestors: (JourneyASTNode | StepASTNode)[]): {
  preparer: ContextPreparer
  compilationDependencies: CompilationDependencies
  journeyInstanceDependencies: JourneyInstanceDependencies
  runtimePlan: StepRuntimePlan
  request: StepRequest
  response: StepResponse
} {
  const accessAncestorIds = ancestors.map(a => a.id) as AstNodeId[]
  const compilationDependencies = {
    nodeRegistry: {
      get: vi.fn().mockImplementation((nodeId: NodeId) => {
        return ancestors.find(a => a.id === nodeId)
      }),
    },
  } as unknown as CompilationDependencies
  const journeyInstanceDependencies = {
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    functionRegistry: {},
  } as unknown as JourneyInstanceDependencies

  const runtimePlan: StepRuntimePlan = {
    stepId: ancestors.at(-1)!.id,
    path: '/step',
    accessAncestorIds,
    submitHookIds: [],
    iterateNodeIds: [],
    validationBlockIds: [],
    domainValidationNodeIds: [],
    renderAncestorIds: accessAncestorIds.slice(0, -1),
    renderStepId: ancestors.at(-1)!.id,
    hasValidatingSubmitHook: false,
    hasDomainValidation: false,
  }

  const request = {} as StepRequest
  const response = {} as StepResponse
  const preparer = new ContextPreparer()

  return { preparer, compilationDependencies, journeyInstanceDependencies, runtimePlan, request, response }
}

describe('ContextPreparer', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('prepare()', () => {
    it('should create context from compilation and journey dependencies', () => {
      // Arrange
      const step = createStep()
      const { preparer, compilationDependencies, journeyInstanceDependencies, runtimePlan, request, response } =
        setupMocks([step])

      // Act
      const result = preparer.prepare(
        runtimePlan,
        compilationDependencies,
        journeyInstanceDependencies,
        request,
        response,
      )

      // Assert
      expect(result.request).toBe(request)
      expect(result.response).toBe(response)
      expect(result.nodeRegistry).toBe(compilationDependencies.nodeRegistry)
    })

    it('should not modify data when no ancestors have static data', () => {
      // Arrange
      const step = createStep()
      const { preparer, compilationDependencies, journeyInstanceDependencies, runtimePlan, request, response } =
        setupMocks([step])

      // Act
      const context = preparer.prepare(
        runtimePlan,
        compilationDependencies,
        journeyInstanceDependencies,
        request,
        response,
      )

      // Assert
      expect(context.global.data).toEqual({})
    })

    it('should merge journey static data into context', () => {
      // Arrange
      const journey = createJourney({ apiUrl: 'https://api.test', timeout: 5000 })
      const step = createStep()
      const { preparer, compilationDependencies, journeyInstanceDependencies, runtimePlan, request, response } =
        setupMocks([journey, step])

      // Act
      const context = preparer.prepare(
        runtimePlan,
        compilationDependencies,
        journeyInstanceDependencies,
        request,
        response,
      )

      // Assert
      expect(context.global.data).toEqual({ apiUrl: 'https://api.test', timeout: 5000 })
    })

    it('should merge all ancestors with inner overriding outer', () => {
      // Arrange
      const journey = createJourney({ env: 'production', apiUrl: 'https://journey-api' })
      const step = createStep({ apiUrl: 'https://step-api', stepKey: 'value' })
      const { preparer, compilationDependencies, journeyInstanceDependencies, runtimePlan, request, response } =
        setupMocks([journey, step])

      // Act
      const context = preparer.prepare(
        runtimePlan,
        compilationDependencies,
        journeyInstanceDependencies,
        request,
        response,
      )

      // Assert
      expect(context.global.data).toEqual({
        env: 'production',
        apiUrl: 'https://step-api',
        stepKey: 'value',
      })
    })

    it('should merge deeply nested journey hierarchy', () => {
      // Arrange
      const outerJourney = createJourney({ level: 'outer', shared: 'outer-value' })
      const innerJourney = createJourney({ shared: 'inner-value', innerKey: 'inner' })
      const step = createStep({ stepOnly: 'step' })
      const { preparer, compilationDependencies, journeyInstanceDependencies, runtimePlan, request, response } =
        setupMocks([outerJourney, innerJourney, step])

      // Act
      const context = preparer.prepare(
        runtimePlan,
        compilationDependencies,
        journeyInstanceDependencies,
        request,
        response,
      )

      // Assert
      expect(context.global.data).toEqual({
        level: 'outer',
        shared: 'inner-value',
        innerKey: 'inner',
        stepOnly: 'step',
      })
    })

    it('should skip ancestors without data property', () => {
      // Arrange
      const journey = createJourney({ journeyKey: 'value' })
      const stepWithoutData = createStep()
      const { preparer, compilationDependencies, journeyInstanceDependencies, runtimePlan, request, response } =
        setupMocks([journey, stepWithoutData])

      // Act
      const context = preparer.prepare(
        runtimePlan,
        compilationDependencies,
        journeyInstanceDependencies,
        request,
        response,
      )

      // Assert
      expect(context.global.data).toEqual({ journeyKey: 'value' })
    })
  })
})
