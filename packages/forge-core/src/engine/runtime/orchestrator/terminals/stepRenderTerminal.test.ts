import { createStepRenderTerminal } from './stepRenderTerminal'
import type { RenderPlan } from '../../../contracts/plans/compilationArtefacts.type'
import { createPipelineState } from '../testing-helpers/pipelineStateFixtures'
import type FunctionRegistry from '../../../registries/FunctionRegistry'

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
      const state = createPipelineState()
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
      const result = await terminal.execute(state)

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(true)
      }
    })
  })
})
