import { createEntryValidationPhase } from './entryValidationPhase'
import type { PipelineState } from '../types'
import RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { StepRequest } from '../../../../framework/types/request.type'
import type { StepResponse } from '../../../../framework/types/response.type'

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
  const response = {} as StepResponse
  const context = new RuntimeEvaluationContext(request, response)

  return { context, request }
}

const mockFunctionRegistry = {} as FunctionRegistry

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
      )

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(result).toEqual({ action: 'continue' })
    })

    it('should run validation and set state when groups are active', async () => {
      // Arrange
      const compiledEntryValidation = vi.fn().mockReturnValue(['group-1'])
      const compiledValidation = vi.fn().mockReturnValue({
        isValid: false,
        fieldFailures: [
          { blockId: 'compile_ast:2' as const, passed: false, message: 'Required', submissionOnly: false },
        ],
        domainFailures: [],
      })
      const phase = createEntryValidationPhase(
        compiledEntryValidation,
        compiledValidation,
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
  })
})
