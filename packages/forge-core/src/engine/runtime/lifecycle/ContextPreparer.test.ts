import type { StepRuntimePlan } from '../../contracts/plans/runtimePlans.type'
import type { StepRequest, StepResponse } from '../../../framework'
import ContextPreparer from './ContextPreparer'

function setupMocks(staticData: Record<string, unknown> = {}): {
  preparer: ContextPreparer
  runtimePlan: StepRuntimePlan
  request: StepRequest
  response: StepResponse
} {
  const runtimePlan: StepRuntimePlan = {
    stepId: 'compile_ast:1',
    path: '/step',
    staticData,
  }
  const request = {} as StepRequest
  const response = {} as StepResponse
  const preparer = new ContextPreparer()

  return { preparer, runtimePlan, request, response }
}

describe('ContextPreparer', () => {
  describe('prepare()', () => {
    it('should create context from request and response', () => {
      // Arrange
      const { preparer, runtimePlan, request, response } = setupMocks()

      // Act
      const result = preparer.prepare(runtimePlan, request, response)

      // Assert
      expect(result.request).toBe(request)
      expect(result.response).toBe(response)
    })

    it('should not modify data when the runtime plan has no static data', () => {
      // Arrange
      const { preparer, runtimePlan, request, response } = setupMocks()

      // Act
      const context = preparer.prepare(runtimePlan, request, response)

      // Assert
      expect(context.global.data).toEqual({})
    })

    it('should seed context data from pre-merged runtime plan static data', () => {
      // Arrange
      const staticData = {
        env: 'production',
        apiUrl: 'https://step-api',
        stepKey: 'value',
      }
      const { preparer, runtimePlan, request, response } = setupMocks(staticData)

      // Act
      const context = preparer.prepare(runtimePlan, request, response)

      // Assert
      expect(context.global.data).toEqual(staticData)
    })
  })
})
