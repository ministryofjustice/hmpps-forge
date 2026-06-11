import { evaluateEntryValidation } from './evaluateEntryValidation'
import TraceRecorder from '../trace/TraceRecorder'
import type { EntryValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { BasePhaseContext } from '../../../contracts/compiled/phaseContexts.type'

const mockCtx = {} as BasePhaseContext

const runTraced = async (plan: EntryValidationPlan) => {
  const recorder = new TraceRecorder()

  recorder.beginPhase('entry-validation')

  const groups = await evaluateEntryValidation(plan, mockCtx, recorder)

  recorder.endPhase('continue')

  return { groups, units: recorder.finish('render').phases[0].units }
}

describe('evaluateEntryValidation', () => {
  describe('group selection', () => {
    it('should treat rules without a predicate as always active and exclude inactive rules', async () => {
      // Arrange
      const plan: EntryValidationPlan = {
        entryValidationRules: [
          { nodeId: 'compile_ast:1' as const, groups: ['contact'] },
          { nodeId: 'compile_ast:2' as const, groups: ['address'], evaluate: vi.fn().mockReturnValue(false) },
        ],
      }

      // Act
      const groups = await evaluateEntryValidation(plan, mockCtx)

      // Assert
      expect(groups).toEqual(['contact'])
    })

    it('should deduplicate groups in declared rule order when a slow predicate resolves late', async () => {
      // Arrange
      const slow = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => {
          setTimeout(resolve, 5)
        })

        return true
      })
      const plan: EntryValidationPlan = {
        entryValidationRules: [
          { nodeId: 'compile_ast:1' as const, groups: ['address', 'contact'], evaluate: slow },
          { nodeId: 'compile_ast:2' as const, groups: ['contact', 'payment'] },
        ],
      }

      // Act
      const groups = await evaluateEntryValidation(plan, mockCtx)

      // Assert
      expect(groups).toEqual(['address', 'contact', 'payment'])
    })
  })

  describe('tracing', () => {
    it('should record one unit per rule with its verdict and groups when tracing', async () => {
      // Arrange
      const plan: EntryValidationPlan = {
        entryValidationRules: [
          { nodeId: 'compile_ast:1' as const, groups: ['contact'] },
          { nodeId: 'compile_ast:2' as const, groups: ['address'], evaluate: vi.fn().mockReturnValue(false) },
        ],
      }

      // Act
      const { units } = await runTraced(plan)

      // Assert
      expect(units).toEqual([
        expect.objectContaining({
          kind: 'entry-validation-rule',
          nodeId: 'compile_ast:1',
          active: true,
          groups: ['contact'],
        }),
        expect.objectContaining({
          kind: 'entry-validation-rule',
          nodeId: 'compile_ast:2',
          active: false,
          groups: ['address'],
        }),
      ])
    })

    it('should record nothing and still select groups when no recorder is supplied', async () => {
      // Arrange
      const plan: EntryValidationPlan = {
        entryValidationRules: [{ nodeId: 'compile_ast:1' as const, groups: ['contact'] }],
      }

      // Act
      const groups = await evaluateEntryValidation(plan, mockCtx)

      // Assert
      expect(groups).toEqual(['contact'])
    })
  })
})
