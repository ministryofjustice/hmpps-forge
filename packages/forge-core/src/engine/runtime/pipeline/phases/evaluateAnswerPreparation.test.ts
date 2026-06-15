import { evaluateAnswerPreparation } from './evaluateAnswerPreparation'
import TraceRecorder from '../trace/TraceRecorder'
import type { AnswerPreparationContext } from '../../../contracts/compiled/phaseContexts.type'
import type { AnswerPreparationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type {
  CompiledTemplateMaterialisationRoot,
  MaterialisedTemplateNode,
} from '../../../contracts/plans/materialisationArtefacts.type'

const mockCtx = {} as AnswerPreparationContext

const runTraced = async (plan: AnswerPreparationPlan) => {
  const recorder = new TraceRecorder()

  recorder.beginPhase('answer-preparation')
  await evaluateAnswerPreparation(plan, mockCtx, recorder)
  recorder.endPhase('continue')

  return recorder.finish('render').phases[0].units
}

function createMaterialisedNode(index: number): MaterialisedTemplateNode {
  return {
    sourceNodeId: 'template:1' as const,
    instanceKey: `compile_ast:5[${index}]/template:1`,
    origin: {
      iteratorNodeId: 'compile_ast:5' as const,
      itemIndex: index,
    },
    prepare: vi.fn(),
  }
}

function createMaterialisationRoot(nodes: MaterialisedTemplateNode[]): CompiledTemplateMaterialisationRoot {
  return {
    nodeId: 'compile_ast:5' as const,
    templateFunctions: new Map(),
    materialise: vi.fn(() => nodes),
  }
}

describe('evaluateAnswerPreparation', () => {
  describe('sequential execution', () => {
    it('should await each field preparation before starting the next when an earlier one is async', async () => {
      // Arrange
      const order: string[] = []
      const first = vi.fn().mockImplementation(async () => {
        order.push('first:start')
        await new Promise(resolve => {
          setTimeout(resolve, 1)
        })
        order.push('first:end')
      })
      const second = vi.fn().mockImplementation(() => {
        order.push('second:start')
      })
      const plan: AnswerPreparationPlan = {
        items: [
          { kind: 'field', entry: { nodeId: 'compile_ast:2' as const, prepare: first } },
          { kind: 'field', entry: { nodeId: 'compile_ast:3' as const, prepare: second } },
        ],
      }

      // Act
      await evaluateAnswerPreparation(plan, mockCtx)

      // Assert
      expect(order).toEqual(['first:start', 'first:end', 'second:start'])
    })

    it('should prepare iterator items one at a time in item order', async () => {
      // Arrange
      const order: string[] = []
      const makePrepareFn = (index: number) =>
        vi.fn().mockImplementation(async () => {
          order.push(`item-${index}:start`)
          await new Promise(resolve => {
            setTimeout(resolve, 1)
          })
          order.push(`item-${index}:end`)
        })
      const materialisedNodes: MaterialisedTemplateNode[] = [
        {
          sourceNodeId: 'template:1' as const,
          instanceKey: 'compile_ast:5[0]/template:1',
          origin: { iteratorNodeId: 'compile_ast:5' as const, itemIndex: 0 },
          prepare: makePrepareFn(0),
        },
        {
          sourceNodeId: 'template:1' as const,
          instanceKey: 'compile_ast:5[1]/template:1',
          origin: { iteratorNodeId: 'compile_ast:5' as const, itemIndex: 1 },
          prepare: makePrepareFn(1),
        },
      ]
      const plan: AnswerPreparationPlan = {
        items: [{ kind: 'materialisation-root', root: createMaterialisationRoot(materialisedNodes) }],
      }

      // Act
      await evaluateAnswerPreparation(plan, mockCtx)

      // Assert
      expect(order).toEqual(['item-0:start', 'item-0:end', 'item-1:start', 'item-1:end'])
    })

    it('should prepare fields and materialise iterator roots in authored order', async () => {
      // Arrange
      const order: string[] = []
      const ctx = {
        answers: {},
      } as AnswerPreparationContext
      const firstNode: MaterialisedTemplateNode = {
        sourceNodeId: 'template:1' as const,
        instanceKey: 'compile_ast:5[0]/template:1',
        origin: { iteratorNodeId: 'compile_ast:5' as const, itemIndex: 0 },
        prepare: vi.fn(localCtx => {
          order.push('first-field')
          localCtx.answers.secondSeed = {
            current: 'opened',
            mutations: [{ value: 'opened', source: 'default' }],
          }
        }),
      }
      const secondNode: MaterialisedTemplateNode = {
        sourceNodeId: 'template:2' as const,
        instanceKey: 'compile_ast:6[0]/template:2',
        origin: { iteratorNodeId: 'compile_ast:6' as const, itemIndex: 0 },
        prepare: vi.fn(() => {
          order.push('second-field')
        }),
      }
      const firstRoot: CompiledTemplateMaterialisationRoot = {
        nodeId: 'compile_ast:5' as const,
        templateFunctions: new Map(),
        materialise: vi.fn(localCtx => {
          order.push(`first-root:${localCtx.answers.seed?.current}`)

          return [firstNode]
        }),
      }
      const secondRoot: CompiledTemplateMaterialisationRoot = {
        nodeId: 'compile_ast:6' as const,
        templateFunctions: new Map(),
        materialise: vi.fn(localCtx => {
          order.push(`second-root:${localCtx.answers.secondSeed?.current}`)

          return [secondNode]
        }),
      }
      const plan: AnswerPreparationPlan = {
        items: [
          {
            kind: 'field',
            entry: {
              nodeId: 'compile_ast:2' as const,
              prepare: vi.fn(localCtx => {
                order.push('plain')
                localCtx.answers.seed = { current: 'ready', mutations: [{ value: 'ready', source: 'default' }] }
              }),
            },
          },
          { kind: 'materialisation-root', root: firstRoot },
          { kind: 'materialisation-root', root: secondRoot },
        ],
      }

      // Act
      const materialisedNodes = await evaluateAnswerPreparation(plan, ctx)

      // Assert
      expect(order).toEqual(['plain', 'first-root:ready', 'first-field', 'second-root:opened', 'second-field'])
      expect(materialisedNodes).toEqual([firstNode, secondNode])
    })
  })

  describe('tracing', () => {
    it('should record one decision per field preparation when tracing', async () => {
      // Arrange
      const plan: AnswerPreparationPlan = {
        items: [
          { kind: 'field', entry: { nodeId: 'compile_ast:2' as const, prepare: vi.fn() } },
          { kind: 'field', entry: { nodeId: 'compile_ast:3' as const, prepare: vi.fn() } },
        ],
      }

      // Act
      const units = await runTraced(plan)

      // Assert
      expect(units).toEqual([
        expect.objectContaining({ kind: 'answer-preparation-field', nodeId: 'compile_ast:2' }),
        expect.objectContaining({ kind: 'answer-preparation-field', nodeId: 'compile_ast:3' }),
      ])
    })

    it('should record one decision per materialised field when tracing', async () => {
      // Arrange
      const materialisedNodes = [createMaterialisedNode(0), createMaterialisedNode(1)]
      const plan: AnswerPreparationPlan = {
        items: [{ kind: 'materialisation-root', root: createMaterialisationRoot(materialisedNodes) }],
      }

      // Act
      const units = await runTraced(plan)

      // Assert
      expect(units).toEqual([
        expect.objectContaining({
          kind: 'template-materialisation',
          nodeId: 'compile_ast:5',
          itemCount: 2,
          nodeCount: 2,
        }),
        expect.objectContaining({ kind: 'answer-preparation-field', nodeId: 'template:1', itemIndex: 0 }),
        expect.objectContaining({ kind: 'answer-preparation-field', nodeId: 'template:1', itemIndex: 1 }),
      ])
    })

    it('should record nothing and still prepare when no recorder is supplied', async () => {
      // Arrange
      const prepare = vi.fn()
      const plan: AnswerPreparationPlan = {
        items: [{ kind: 'field', entry: { nodeId: 'compile_ast:2' as const, prepare } }],
      }

      // Act
      await evaluateAnswerPreparation(plan, mockCtx)

      // Assert
      expect(prepare).toHaveBeenCalledTimes(1)
    })
  })
})
