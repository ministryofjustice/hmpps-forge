import type { RuntimePlan } from '../../contracts/plans/runtimePlans.type'
import type { StepRequest } from '../../../framework'
import ContextPreparer from './ContextPreparer'

function setupMocks(staticData: Record<string, unknown> = {}): {
  preparer: ContextPreparer
  runtimePlan: RuntimePlan
  request: StepRequest
} {
  const runtimePlan: RuntimePlan = {
    nodeId: 'compile_ast:1',
    path: '/step',
    staticData,
  }
  const request = {} as StepRequest
  const preparer = new ContextPreparer()

  return { preparer, runtimePlan, request }
}

describe('ContextPreparer', () => {
  describe('prepare()', () => {
    it('should create context from request', () => {
      // Arrange
      const { preparer, runtimePlan, request } = setupMocks()

      // Act
      const result = preparer.prepare(runtimePlan, request)

      // Assert
      expect(result.request).toBe(request)
    })

    it('should not modify data when the runtime plan has no static data', () => {
      // Arrange
      const { preparer, runtimePlan, request } = setupMocks()

      // Act
      const context = preparer.prepare(runtimePlan, request)

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
      const { preparer, runtimePlan, request } = setupMocks(staticData)

      // Act
      const context = preparer.prepare(runtimePlan, request)

      // Assert
      expect(context.global.data).toEqual(staticData)
    })
  })
})
