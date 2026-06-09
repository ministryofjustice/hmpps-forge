import { evaluateValidation } from './evaluateValidation'
import TraceRecorder from '../trace/TraceRecorder'
import RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { ValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { StepRequest } from '../../../../framework/types/request.type'

const createMockContext = (): RuntimeEvaluationContext => {
  const request = {
    method: 'GET',
    url: 'http://localhost/forms/journey/step',
    baseUrl: '/forms/journey',
    location: {
      origin: 'http://localhost',
      href: 'http://localhost/forms/journey/step',
      pathname: '/forms/journey/step',
      basePath: '/forms/journey',
    },
    getHeader: () => undefined,
    getAllHeaders: () => ({}),
    getCookie: () => undefined,
    getAllCookies: () => ({}),
    getParam: () => undefined,
    getParams: () => ({}),
    getQuery: () => undefined,
    getAllQuery: () => ({}),
    getPost: () => undefined,
    getAllPost: () => ({}),
    getSession: () => undefined,
    getState: () => undefined,
    getAllState: () => ({}),
  } as unknown as StepRequest

  return new RuntimeEvaluationContext(request)
}

const mockFunctionRegistry = {} as FunctionRegistry

const runTraced = async (plan: ValidationPlan) => {
  const recorder = new TraceRecorder()

  recorder.beginPhase('validation')

  const result = await evaluateValidation(
    plan,
    '/step',
    'compile_ast:1' as const,
    createMockContext(),
    mockFunctionRegistry,
    true,
    [],
    recorder,
  )

  recorder.endPhase('continue')

  return { result, units: recorder.finish('render').phases[0].units }
}

describe('evaluateValidation', () => {
  describe('field tracing', () => {
    it('should record one verdict per field including passes when tracing', async () => {
      // Arrange
      const failure = { blockId: 'compile_ast:3' as const, passed: false, message: 'Required', submissionOnly: false }
      const plan: ValidationPlan = {
        fields: [
          { nodeId: 'compile_ast:2' as const, validate: vi.fn().mockResolvedValue([]) },
          { nodeId: 'compile_ast:3' as const, validate: vi.fn().mockResolvedValue([failure]) },
        ],
        iteratorGroups: [],
      }

      // Act
      const { result, units } = await runTraced(plan)

      // Assert
      expect(result.isValid).toBe(false)
      expect(units).toEqual([
        expect.objectContaining({ kind: 'field-validation', nodeId: 'compile_ast:2', isValid: true }),
        expect.objectContaining({
          kind: 'field-validation',
          nodeId: 'compile_ast:3',
          isValid: false,
          failures: [failure],
        }),
      ])
    })

    it('should record nothing and still validate when no recorder is supplied', async () => {
      // Arrange
      const plan: ValidationPlan = {
        fields: [{ nodeId: 'compile_ast:2' as const, validate: vi.fn().mockResolvedValue([]) }],
        iteratorGroups: [],
      }

      // Act
      const result = await evaluateValidation(
        plan,
        '/step',
        'compile_ast:1' as const,
        createMockContext(),
        mockFunctionRegistry,
        true,
        [],
      )

      // Assert
      expect(result.isValid).toBe(true)
    })
  })

  describe('iterator and domain tracing', () => {
    it('should record the iterator expansion and one verdict per field per item when tracing', async () => {
      // Arrange
      const itemScopes = [
        { item: { value: 'a' }, index: 0, rawItem: 'a', inputLength: 2 },
        { item: { value: 'b' }, index: 1, rawItem: 'b', inputLength: 2 },
      ]
      const plan: ValidationPlan = {
        fields: [],
        iteratorGroups: [
          {
            nodeId: 'compile_ast:5' as const,
            evaluateInput: vi.fn().mockResolvedValue(itemScopes),
            fields: [{ nodeId: 'template:1' as const, validate: vi.fn().mockResolvedValue([]) }],
          },
        ],
      }

      // Act
      const { result, units } = await runTraced(plan)

      // Assert
      expect(result.isValid).toBe(true)
      expect(units).toEqual([
        expect.objectContaining({ kind: 'iterator-input', nodeId: 'compile_ast:5', itemCount: 2 }),
        expect.objectContaining({ kind: 'field-validation', nodeId: 'template:1', itemIndex: 0, isValid: true }),
        expect.objectContaining({ kind: 'field-validation', nodeId: 'template:1', itemIndex: 1, isValid: true }),
      ])
    })

    it('should record the domain verdict when tracing', async () => {
      // Arrange
      const domainFailure = { passed: false, message: 'Dates must not overlap', submissionOnly: false }
      const plan: ValidationPlan = {
        fields: [],
        iteratorGroups: [],
        domain: vi.fn().mockResolvedValue([domainFailure]),
      }

      // Act
      const { result, units } = await runTraced(plan)

      // Assert
      expect(result.isValid).toBe(false)
      expect(units).toEqual([
        expect.objectContaining({ kind: 'domain-validation', isValid: false, failures: [domainFailure] }),
      ])
    })
  })
})
