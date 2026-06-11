import { createRenderEvaluationPhase } from './renderEvaluationPhase'
import type { RenderPlan } from '../../../contracts/plans/compilationArtefacts.type'
import { createPipelineState } from '../testing-helpers/pipelineStateFixtures'
import type FunctionRegistry from '../../../registries/FunctionRegistry'

const mockFunctionRegistry = {} as FunctionRegistry

describe('renderEvaluationPhase', () => {
  describe('execute()', () => {
    it('should store the built render context on state and continue', async () => {
      // Arrange
      const renderPlan: RenderPlan = {
        compiledStepMetadata: vi.fn().mockReturnValue({ title: 'Test Step' }),
        compiledAncestorMetadata: vi.fn().mockReturnValue([]),
        renderBlocks: [],
        iteratorRenderBlockGroups: [],
      }
      const phase = createRenderEvaluationPhase(renderPlan, [], '/journey/step', mockFunctionRegistry)

      // Act
      const state = createPipelineState()
      const result = await phase.execute(state)

      // Assert
      expect(result).toEqual({ action: 'continue' })
      expect(state.renderContext?.step.title).toBe('Test Step')
    })

    it('should include validation failures in the render context when showValidationFailures is set', async () => {
      // Arrange
      const renderPlan: RenderPlan = {
        compiledStepMetadata: vi.fn().mockReturnValue({ title: 'Test Step' }),
        compiledAncestorMetadata: vi.fn().mockReturnValue([]),
        renderBlocks: [],
        iteratorRenderBlockGroups: [],
      }
      const phase = createRenderEvaluationPhase(renderPlan, [], '/journey/step', mockFunctionRegistry)

      // Act
      const state = {
        ...createPipelineState(),
        validation: {
          isValid: false,
          fieldFailures: [
            { blockId: 'compile_ast:1' as const, passed: false, message: 'Required', submissionOnly: false },
          ],
          domainFailures: [],
        },
        showValidationFailures: true,
      }
      const result = await phase.execute(state)

      // Assert
      expect(result).toEqual({ action: 'continue' })
      expect(state.renderContext?.showValidationFailures).toBe(true)
    })
  })
})
