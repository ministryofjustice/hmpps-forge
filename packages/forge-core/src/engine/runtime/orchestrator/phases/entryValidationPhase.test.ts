import { createEntryValidationPhase } from './entryValidationPhase'
import type { PipelineState } from '../types'
import RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { ForgeInstrumentation } from '../../../../instrumentation/ForgeInstrumentation'
import type { StepRequest } from '../../../../framework/types/request.type'
import type { ValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
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
const mockInstrumentation = {
  span: vi.fn((_n: string, fn: (s: { setAttributes: () => void; addEvent: () => void }) => unknown) =>
    fn({ setAttributes: vi.fn(), addEvent: vi.fn() }),
  ),
} as unknown as ForgeInstrumentation

describe('entryValidationPhase', () => {
  describe('execute()', () => {
    it('should return continue when no entry validation is configured', async () => {
      // Arrange
      const phase = createEntryValidationPhase(
        undefined,
        undefined,
        'compile_ast:1' as const,
        '/step',
        mockFunctionRegistry,
        mockInstrumentation,
      )

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(result).toEqual({ action: 'continue' })
    })

    it('should return continue when entry validation returns empty groups', async () => {
      // Arrange
      const compiledEntryValidation = vi.fn().mockReturnValue([])
      const phase = createEntryValidationPhase(
        compiledEntryValidation,
        undefined,
        'compile_ast:1' as const,
        '/step',
        mockFunctionRegistry,
        mockInstrumentation,
      )

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(result).toEqual({ action: 'continue' })
    })

    it('should run validation and set state when groups are active', async () => {
      // Arrange
      const compiledEntryValidation = vi.fn().mockReturnValue(['group-1'])
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
        compiledEntryValidation,
        validationPlan,
        'compile_ast:1' as const,
        '/step',
        mockFunctionRegistry,
        mockInstrumentation,
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

    it('should record a validation span with summary attributes and a per-field failure event when invalid', async () => {
      // Arrange
      const setAttributes = vi.fn()
      const addEvent = vi.fn()
      const instrumentation = {
        span: vi.fn(
          (_n: string, fn: (s: { setAttributes: typeof setAttributes; addEvent: typeof addEvent }) => unknown) =>
            fn({ setAttributes, addEvent }),
        ),
      } as unknown as ForgeInstrumentation
      const compiledEntryValidation = vi.fn().mockReturnValue(['group-1'])
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
        compiledEntryValidation,
        validationPlan,
        'compile_ast:1' as const,
        '/step',
        mockFunctionRegistry,
        instrumentation,
      )

      // Act
      await phase.execute(createMockState())

      // Assert
      expect(instrumentation.span).toHaveBeenCalledWith('validation', expect.any(Function))
      expect(setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'forge.validation.stepId': 'compile_ast:1',
          'forge.validation.isSubmission': false,
          'forge.validation.isValid': false,
          'forge.validation.fieldFailureCount': 1,
          'forge.validation.domainFailureCount': 0,
        }),
      )
      expect(addEvent).toHaveBeenCalledTimes(1)
      expect(addEvent).toHaveBeenCalledWith(
        'forge.validation.failure',
        expect.objectContaining({
          'forge.validation.failure.stepId': 'compile_ast:1',
          'forge.validation.failure.scope': 'field',
          'forge.validation.failure.isSubmission': false,
          'forge.validation.failure.message': 'Required',
          'forge.validation.failure.submissionOnly': false,
          'forge.validation.failure.blockId': 'compile_ast:2',
        }),
      )
    })

    it('should not emit failure events when validation passes', async () => {
      // Arrange
      const setAttributes = vi.fn()
      const addEvent = vi.fn()
      const instrumentation = {
        span: vi.fn(
          (_n: string, fn: (s: { setAttributes: typeof setAttributes; addEvent: typeof addEvent }) => unknown) =>
            fn({ setAttributes, addEvent }),
        ),
      } as unknown as ForgeInstrumentation
      const compiledEntryValidation = vi.fn().mockReturnValue(['group-1'])
      const validationPlan: ValidationPlan = {
        iteratorGroups: [],
        fields: [{ nodeId: 'compile_ast:2' as const, validate: vi.fn().mockReturnValue([]) }],
      }
      const phase = createEntryValidationPhase(
        compiledEntryValidation,
        validationPlan,
        'compile_ast:1' as const,
        '/step',
        mockFunctionRegistry,
        instrumentation,
      )

      // Act
      await phase.execute(createMockState())

      // Assert
      expect(addEvent).not.toHaveBeenCalled()
      expect(setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({ 'forge.validation.isValid': true, 'forge.validation.fieldFailureCount': 0 }),
      )
    })

    it('should emit a domain-scoped failure event without a blockId for domain failures', async () => {
      // Arrange
      const addEvent = vi.fn()
      const instrumentation = {
        span: vi.fn((_n: string, fn: (s: { setAttributes: () => void; addEvent: typeof addEvent }) => unknown) =>
          fn({ setAttributes: vi.fn(), addEvent }),
        ),
      } as unknown as ForgeInstrumentation
      const compiledEntryValidation = vi.fn().mockReturnValue(['group-1'])
      const validationPlan: ValidationPlan = {
        iteratorGroups: [],
        fields: [],
        domain: vi.fn().mockReturnValue([{ passed: false, message: 'Domain rule', submissionOnly: true }]),
      }
      const phase = createEntryValidationPhase(
        compiledEntryValidation,
        validationPlan,
        'compile_ast:1' as const,
        '/step',
        mockFunctionRegistry,
        instrumentation,
      )

      // Act
      await phase.execute(createMockState())

      // Assert
      expect(addEvent).toHaveBeenCalledTimes(1)
      expect(addEvent).toHaveBeenCalledWith(
        'forge.validation.failure',
        expect.objectContaining({
          'forge.validation.failure.scope': 'domain',
          'forge.validation.failure.message': 'Domain rule',
        }),
      )
      expect(addEvent).toHaveBeenCalledWith(
        'forge.validation.failure',
        expect.not.objectContaining({ 'forge.validation.failure.blockId': expect.anything() }),
      )
    })
  })
})
