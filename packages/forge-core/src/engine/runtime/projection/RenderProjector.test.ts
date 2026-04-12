import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import { ThunkInvocationAdapter } from '../../compilation/thunks/types'
import { StepRuntimePlan } from '../../compilation/RuntimePlanBuilder'
import { JourneyAncestor, JourneyMetadata } from '../../../framework/rendering/types'
import { StepRequest } from '../../../framework/types/request.type'
import { StepValidityResult } from '../evaluation/StepValidityAnalyzer'
import { MetadataExecutionResult } from '../evaluation/MetadataExecutor'
import RuntimeArtifacts from '../RuntimeArtifacts'
import { NavigationEvaluation, NavigationStepState } from '../types/NavigationEvaluation.type'
import RenderProjector from './RenderProjector'

const mockMetadataExecutorExecute = jest.fn()
const mockRenderExecutorExecute = jest.fn()
const mockRenderContextFactoryBuild = jest.fn().mockReturnValue({
  step: {},
  blocks: [],
  ancestors: [],
})

jest.mock('../evaluation/MetadataExecutor', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      execute: (...args: unknown[]) => mockMetadataExecutorExecute(...args),
    })),
  }
})

jest.mock('../evaluation/RenderExecutor', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      execute: (...args: unknown[]) => mockRenderExecutorExecute(...args),
    })),
  }
})

jest.mock('./RenderContextFactory', () => {
  return {
    __esModule: true,
    default: {
      build: (...args: unknown[]) => mockRenderContextFactoryBuild(...args),
    },
  }
})

function createPlan(overrides: Partial<StepRuntimePlan> = {}): StepRuntimePlan {
  return {
    stepId: 'compile_ast:1',
    path: 'step-1',
    accessAncestorIds: [],
    actionHookIds: [],
    submitHookIds: [],
    fieldIteratorRootIds: [],
    validationIterateNodeIds: [],
    validationBlockIds: [],
    domainValidationNodeIds: [],
    renderAncestorIds: [],
    renderStepId: 'compile_ast:1',
    hasValidatingSubmitHook: false,
    hasDomainValidation: false,
    ...overrides,
  }
}

const defaultMetadata: MetadataExecutionResult = {
  step: { path: '/step-1', title: 'Step 1' },
  ancestors: [] as JourneyAncestor[],
}

const mockRequest = {
  baseUrl: '/forms/journey',
  location: {
    origin: 'https://service.test',
    href: 'https://service.test/forms/journey/step-1',
    pathname: '/forms/journey/step-1',
    basePath: '/forms/journey',
  },
  getParams: () => ({}),
} as unknown as StepRequest

function createNavigationStep(overrides: Partial<NavigationStepState> = {}): NavigationStepState {
  return {
    stepId: 'compile_ast:1',
    routeTemplatePath: '/forms/journey/step-1',
    isEntryPoint: false,
    isReachable: true,
    isValid: true,
    forwardRouteTemplatePaths: [],
    predecessorRouteTemplatePaths: [],
    ...overrides,
  }
}

describe('RenderProjector', () => {
  let projector: RenderProjector
  let invoker: jest.Mocked<ThunkInvocationAdapter>
  let context: jest.Mocked<ThunkEvaluationContext>
  let artifacts: RuntimeArtifacts

  beforeEach(() => {
    mockMetadataExecutorExecute.mockReset()
    mockRenderExecutorExecute.mockReset()
    mockRenderContextFactoryBuild.mockReset()
    mockRenderContextFactoryBuild.mockReturnValue({ step: {}, blocks: [], ancestors: [] })

    mockMetadataExecutorExecute.mockResolvedValue(defaultMetadata)
    mockRenderExecutorExecute.mockResolvedValue([])

    projector = new RenderProjector([] as JourneyMetadata[], '/journey/step-1')

    invoker = {
      invoke: jest.fn(),
      invokeSync: jest.fn(),
    } as unknown as jest.Mocked<ThunkInvocationAdapter>

    context = {
      global: { answers: {}, data: {} },
      astNodeTree: {
        getNodeType: jest.fn(),
        hasDescendantOfType: jest.fn(),
      },
    } as unknown as jest.Mocked<ThunkEvaluationContext>

    artifacts = new RuntimeArtifacts()
    artifacts.setNavigation({
      currentStepId: 'compile_ast:1',
      steps: [
        createNavigationStep({
          isEntryPoint: true,
        }),
      ],
    })
  })

  describe('build()', () => {
    it('should evaluate metadata and blocks then build render context', async () => {
      // Arrange
      const plan = createPlan()

      // Act
      await projector.build(plan, invoker, context, artifacts, mockRequest)

      // Assert
      expect(mockMetadataExecutorExecute).toHaveBeenCalledWith(plan, invoker, context)
      expect(mockRenderExecutorExecute).toHaveBeenCalledWith(plan, invoker, context)
      expect(mockRenderContextFactoryBuild).toHaveBeenCalledTimes(1)
    })

    it('should pass validation failures from artifacts to render context', async () => {
      // Arrange
      const plan = createPlan()
      const fieldFailures = [
        { blockId: 'compile_ast:99', blockCode: 'email', passed: false, message: 'Required', submissionOnly: false },
      ]

      artifacts.setStepValidity({
        isValid: false,
        fieldFailures,
        domainFailures: [],
      } satisfies StepValidityResult)

      // Act
      await projector.build(plan, invoker, context, artifacts, mockRequest)

      // Assert
      expect(mockRenderContextFactoryBuild).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldValidationFailures: fieldFailures,
          domainValidationFailures: [],
        }),
        expect.any(Object),
      )
    })

    it('should pass empty validation failures when no validity result exists', async () => {
      // Arrange
      const plan = createPlan()

      // Act
      await projector.build(plan, invoker, context, artifacts, mockRequest)

      // Assert
      expect(mockRenderContextFactoryBuild).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldValidationFailures: [],
          domainValidationFailures: [],
        }),
        expect.any(Object),
      )
    })

    it('should pass showValidationFailures option through', async () => {
      // Arrange
      const plan = createPlan()

      // Act
      await projector.build(plan, invoker, context, artifacts, mockRequest, { showValidationFailures: true })

      // Assert
      expect(mockRenderContextFactoryBuild).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ showValidationFailures: true }),
      )
    })

    it('should resolve auto backlink from navigation predecessor path', async () => {
      // Arrange
      const plan = createPlan()

      artifacts.setNavigation({
        currentStepId: 'compile_ast:1',
        steps: [
          createNavigationStep({
            stepId: 'compile_ast:2',
            routeTemplatePath: '/forms/journey/step-0',
            isEntryPoint: true,
          }),
          createNavigationStep({
            predecessorRouteTemplatePaths: ['/forms/journey/step-0'],
          }),
        ],
      } satisfies NavigationEvaluation)

      // Act
      await projector.build(plan, invoker, context, artifacts, mockRequest)

      // Assert
      expect(mockRenderContextFactoryBuild).toHaveBeenCalledWith(
        expect.objectContaining({
          step: expect.objectContaining({ backlink: '/forms/journey/step-0' }),
        }),
        expect.any(Object),
      )
    })

    it('should not override explicit backlink', async () => {
      // Arrange
      const plan = createPlan()

      mockMetadataExecutorExecute.mockResolvedValue({
        step: { path: '/step-1', title: 'Step 1', backlink: '/explicit-back' },
        ancestors: [],
      })

      artifacts.setNavigation({
        currentStepId: 'compile_ast:1',
        steps: [
          createNavigationStep({
            predecessorRouteTemplatePaths: ['/forms/journey/step-0'],
          }),
        ],
      } satisfies NavigationEvaluation)

      // Act
      await projector.build(plan, invoker, context, artifacts, mockRequest)

      // Assert
      expect(mockRenderContextFactoryBuild).toHaveBeenCalledWith(
        expect.objectContaining({
          step: expect.objectContaining({ backlink: '/explicit-back' }),
        }),
        expect.any(Object),
      )
    })
  })

})
