import { createStepRenderTerminal } from './stepRenderTerminal'
import type { RenderPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { PipelineState } from '../types'
import RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { StepRequest } from '../../../../framework/types/request.type'
import { NO_OP_RESPONSE_BINDINGS } from '../../../../framework/types/responseBindings.type'

const createMockState = (overrides: Partial<PipelineState> = {}): PipelineState => {
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

  return { context, request, responseBindings: NO_OP_RESPONSE_BINDINGS, ...overrides }
}

const mockFunctionRegistry = {} as FunctionRegistry

describe('stepRenderTerminal', () => {
  describe('execute()', () => {
    it('should return a render result with built context', async () => {
      // Arrange
      const renderPlan: RenderPlan = {
        compiledStepMetadata: vi.fn().mockReturnValue({ title: 'Test Step' }),
        compiledAncestorMetadata: vi.fn().mockReturnValue([]),
        renderBlocks: [],
        iteratorRenderBlockGroups: [],
      }
      const terminal = createStepRenderTerminal(renderPlan, [], '/journey/step', mockFunctionRegistry)

      // Act
      const state = createMockState()
      const result = await terminal.execute(state)

      // Assert
      expect(result.type).toBe('render')
    })

    it('should include validation failures in render context', async () => {
      // Arrange
      const renderPlan: RenderPlan = {
        compiledStepMetadata: vi.fn().mockReturnValue({ title: 'Test Step' }),
        compiledAncestorMetadata: vi.fn().mockReturnValue([]),
        renderBlocks: [],
        iteratorRenderBlockGroups: [],
      }
      const terminal = createStepRenderTerminal(renderPlan, [], '/journey/step', mockFunctionRegistry)

      // Act
      const state = createMockState({
        validation: {
          isValid: false,
          fieldFailures: [
            { blockId: 'compile_ast:1' as const, passed: false, message: 'Required', submissionOnly: false },
          ],
          domainFailures: [],
        },
        showValidationFailures: true,
      })
      const result = await terminal.execute(state)

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(true)
      }
    })
  })
})
