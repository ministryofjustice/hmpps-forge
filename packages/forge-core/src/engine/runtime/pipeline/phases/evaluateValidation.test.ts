import { evaluateValidation } from './evaluateValidation'
import TraceRecorder from '../trace/TraceRecorder'
import type { ValidationContext } from '../../../contracts/compiled/phaseContexts.type'
import type { ValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { MaterialisedTemplateNode } from '../../../contracts/plans/materialisationArtefacts.type'

const mockCtx = {} as ValidationContext

const runTraced = async (plan: ValidationPlan, materialisedNodes: MaterialisedTemplateNode[] = []) => {
  const recorder = new TraceRecorder()

  recorder.beginPhase('validation')

  const result = await evaluateValidation(
    plan,
    mockCtx,
    { isSubmission: true, groups: [] },
    recorder,
    materialisedNodes,
  )

  recorder.endPhase('continue')

  return { result, units: recorder.finish('render').phases[0].units }
}

function createMaterialisedNode(index: number): MaterialisedTemplateNode {
  return {
    sourceNodeId: 'template:1' as const,
    instanceKey: `compile_ast:5[${index}]/template:1`,
    origin: {
      iteratorNodeId: 'compile_ast:5' as const,
      itemIndex: index,
    },
    validate: vi.fn().mockResolvedValue([]),
  }
}

describe('evaluateValidation', () => {
  describe('field tracing', () => {
    it('should record one verdict per field including passes when tracing', async () => {
      // Arrange
      const failure = { blockId: 'compile_ast:3' as const, passed: false, message: 'Required', submissionOnly: false }
      const plan: ValidationPlan = {
        fieldValidations: [
          { nodeId: 'compile_ast:2' as const, validate: vi.fn().mockResolvedValue([]) },
          { nodeId: 'compile_ast:3' as const, validate: vi.fn().mockResolvedValue([failure]) },
        ],
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
        fieldValidations: [{ nodeId: 'compile_ast:2' as const, validate: vi.fn().mockResolvedValue([]) }],
      }

      // Act
      const result = await evaluateValidation(plan, mockCtx, { isSubmission: true, groups: [] })

      // Assert
      expect(result.isValid).toBe(true)
    })
  })

  describe('iterator and domain tracing', () => {
    it('should record one verdict per materialised field when tracing', async () => {
      // Arrange
      const materialisedNodes = [createMaterialisedNode(0), createMaterialisedNode(1)]
      const plan: ValidationPlan = {
        fieldValidations: [],
      }

      // Act
      const { result, units } = await runTraced(plan, materialisedNodes)

      // Assert
      expect(result.isValid).toBe(true)
      expect(units).toEqual([
        expect.objectContaining({ kind: 'field-validation', nodeId: 'template:1', itemIndex: 0, isValid: true }),
        expect.objectContaining({ kind: 'field-validation', nodeId: 'template:1', itemIndex: 1, isValid: true }),
      ])
    })

    it('should record the domain verdict when tracing', async () => {
      // Arrange
      const domainFailure = { passed: false, message: 'Dates must not overlap', submissionOnly: false }
      const plan: ValidationPlan = {
        fieldValidations: [],
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
