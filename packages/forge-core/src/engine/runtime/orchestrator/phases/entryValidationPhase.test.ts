import { createEntryValidationPhase } from './entryValidationPhase'
import TraceRecorder from '../trace/TraceRecorder'
import type { EntryValidationPlan, ValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { PipelineState } from '../types'
import RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { StepRequest } from '../../../../framework/types/request.type'
import { NO_OP_RESPONSE_BINDINGS } from '../../../../framework/types/responseBindings.type'

const createMockState = (): PipelineState => {
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
  const context = new RuntimeEvaluationContext(request)

  return { context, request, responseBindings: NO_OP_RESPONSE_BINDINGS }
}

const mockFunctionRegistry = {} as FunctionRegistry

describe('entryValidationPhase', () => {
  describe('execute()', () => {
    it('should return continue when no entry validation plan is configured', async () => {
      // Arrange
      const phase = createEntryValidationPhase(
        undefined,
        undefined,
        'compile_ast:1' as const,
        '/step',
        mockFunctionRegistry,
      )

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(result).toEqual({ action: 'continue' })
    })

    it('should return continue when no rules match', async () => {
      // Arrange
      const entryValidationPlan: EntryValidationPlan = {
        rules: [{ nodeId: 'compile_ast:9' as const, groups: ['group-1'], evaluate: vi.fn().mockReturnValue(false) }],
      }
      const phase = createEntryValidationPhase(
        entryValidationPlan,
        undefined,
        'compile_ast:1' as const,
        '/step',
        mockFunctionRegistry,
      )

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(result).toEqual({ action: 'continue' })
    })

    it('should run validation and set state when groups are active', async () => {
      // Arrange
      const entryValidationPlan: EntryValidationPlan = {
        rules: [{ nodeId: 'compile_ast:9' as const, groups: ['group-1'] }],
      }
      const validationPlan: ValidationPlan = {
        iteratorGroups: [],
        fields: [
          {
            nodeId: 'compile_ast:2' as const,
            validate: vi
              .fn()
              .mockReturnValue([
                { blockId: 'compile_ast:2' as const, passed: false, message: 'Required', submissionOnly: false },
              ]),
          },
        ],
      }
      const phase = createEntryValidationPhase(
        entryValidationPlan,
        validationPlan,
        'compile_ast:1' as const,
        '/step',
        mockFunctionRegistry,
      )

      // Act
      const state = createMockState()
      const result = await phase.execute(state)

      // Assert
      expect(result).toEqual({ action: 'continue' })
      expect(state.showValidationFailures).toBe(true)
      expect(state.validation).toEqual(
        expect.objectContaining({
          isValid: false,
          fieldFailures: [
            { blockId: 'compile_ast:2' as const, passed: false, message: 'Required', submissionOnly: false },
          ],
        }),
      )
    })

    it('should stamp the verdict on the global context when groups are active', async () => {
      // Arrange
      const entryValidationPlan: EntryValidationPlan = {
        rules: [{ nodeId: 'compile_ast:9' as const, groups: ['group-1'] }],
      }
      const validationPlan: ValidationPlan = {
        fields: [{ nodeId: 'compile_ast:2' as const, validate: vi.fn().mockReturnValue([]) }],
        iteratorGroups: [],
      }
      const phase = createEntryValidationPhase(
        entryValidationPlan,
        validationPlan,
        'compile_ast:1' as const,
        '/step',
        mockFunctionRegistry,
      )

      // Act
      const state = createMockState()
      await phase.execute(state)

      // Assert
      expect(state.context.global.validation).toEqual(
        expect.objectContaining({
          stepId: 'compile_ast:1',
          validated: true,
          groups: ['group-1'],
          isSubmission: false,
          isValid: true,
        }),
      )
    })

    it('should throw when groups are selected but the validation plan is missing', async () => {
      // Arrange
      const entryValidationPlan: EntryValidationPlan = {
        rules: [{ nodeId: 'compile_ast:9' as const, groups: ['group-1'] }],
      }
      const phase = createEntryValidationPhase(
        entryValidationPlan,
        undefined,
        'compile_ast:1' as const,
        '/step',
        mockFunctionRegistry,
      )

      // Act & Assert
      await expect(phase.execute(createMockState())).rejects.toThrow('Validation plan is missing for step "/step"')
    })

    it('should record entry-validation-rule units into the state trace recorder when present', async () => {
      // Arrange
      const recorder = new TraceRecorder()
      const entryValidationPlan: EntryValidationPlan = {
        rules: [{ nodeId: 'compile_ast:9' as const, groups: ['group-1'], evaluate: vi.fn().mockReturnValue(false) }],
      }
      const phase = createEntryValidationPhase(
        entryValidationPlan,
        undefined,
        'compile_ast:1' as const,
        '/step',
        mockFunctionRegistry,
      )

      recorder.beginPhase('entry-validation')

      // Act
      await phase.execute({ ...createMockState(), trace: recorder })
      recorder.endPhase('continue')

      // Assert
      const trace = recorder.finish('render')

      expect(trace.phases[0].units).toEqual([
        expect.objectContaining({ kind: 'entry-validation-rule', nodeId: 'compile_ast:9', active: false }),
      ])
    })
  })
})
