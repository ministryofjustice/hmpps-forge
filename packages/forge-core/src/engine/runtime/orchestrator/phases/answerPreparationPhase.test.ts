import { createAnswerPreparationPhase } from './answerPreparationPhase'
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

describe('answerPreparationPhase', () => {
  describe('execute()', () => {
    it('should call compiled function and return continue', async () => {
      // Arrange
      const compiledFn = vi.fn()
      const phase = createAnswerPreparationPhase(compiledFn, '/step', mockFunctionRegistry)

      // Act
      const result = await phase.execute(createMockState())

      // Assert
      expect(compiledFn).toHaveBeenCalled()
      expect(result).toEqual({ action: 'continue' })
    })

    it('should await async answer preparation', async () => {
      // Arrange
      let prepared = false
      const compiledFn = vi.fn().mockImplementation(async () => {
        await Promise.resolve()
        prepared = true
      })
      const phase = createAnswerPreparationPhase(compiledFn, '/step', mockFunctionRegistry)

      // Act
      await phase.execute(createMockState())

      // Assert
      expect(prepared).toBe(true)
    })

    it('should throw when compiled function is missing', async () => {
      // Arrange
      const phase = createAnswerPreparationPhase(undefined, '/step', mockFunctionRegistry)

      // Act & Assert
      await expect(phase.execute(createMockState())).rejects.toThrow('compiledAnswerPreparation is missing for "/step"')
    })
  })
})
