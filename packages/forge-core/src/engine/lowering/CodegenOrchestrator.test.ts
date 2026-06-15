import { buildComponent } from '../../components/utils/buildComponent'
import {
  BlockType,
  ExpressionType,
  FunctionType,
  HookType,
  IteratorType,
  OutcomeType,
  PredicateType,
  StructureType,
} from '../../authoring/types/enums'
import type { BlockDefinition, FieldBlockDefinition } from '../../components/types/structures.type'
import type { JourneyDefinition } from '../../authoring/types/structures.type'
import type { ReachabilityContext } from '../contracts/compiled/phaseContexts.type'
import JourneyCompiler from '../JourneyCompiler'
import ComponentRegistry from '../registries/ComponentRegistry'
import FunctionRegistry from '../registries/FunctionRegistry'
import type { CompiledStep } from '../contracts/plans/compilationArtefacts.type'
import type { CompiledNavigationStep } from '../contracts/plans/runtimePlans.type'

function createFunctionRegistry(): FunctionRegistry {
  const functionRegistry = new FunctionRegistry()

  functionRegistry.register({
    Equals: {
      name: 'Equals',
      isAsync: false,
      evaluate: (value: unknown, expected: unknown) => value === expected,
    },
    IsRequired: {
      name: 'IsRequired',
      isAsync: false,
      evaluate: (value: unknown) =>
        value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== ''),
    },
  })

  return functionRegistry
}

function createComponentRegistry(): ComponentRegistry {
  const componentRegistry = new ComponentRegistry()

  componentRegistry.registerMany([buildComponent<FieldBlockDefinition>('text', () => '<input />')])
  componentRegistry.registerMany([buildComponent<BlockDefinition>('collection-block', () => '<div />')])

  return componentRegistry
}

function createFieldBlock(): FieldBlockDefinition {
  return {
    type: StructureType.BLOCK,
    blockType: BlockType.FIELD,
    variant: 'text',
    code: 'name',
    validWhen: [
      {
        type: ExpressionType.VALIDATION,
        message: 'Enter a name',
        condition: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['@self'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] },
        },
      },
    ],
  }
}

function createJourneyDefinition(): JourneyDefinition {
  return {
    type: StructureType.JOURNEY,
    path: '/journey',
    code: 'journey',
    title: 'Journey',
    reachability: {
      resumeWhen: {
        type: PredicateType.TEST,
        subject: { type: ExpressionType.REFERENCE, path: ['session', 'resume'] },
        negate: false,
        condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: [true] },
      },
    },
    steps: [
      {
        type: StructureType.STEP,
        path: '/start',
        code: 'start',
        title: 'Start',
        reachability: { entryWhen: true },
        cleardownFieldCodes: ['stale-name'],
        blocks: [createFieldBlock()],
        onSubmission: [
          {
            type: HookType.SUBMIT,
            validate: false,
            onAlways: {
              next: [{ type: OutcomeType.REDIRECT, goto: '/next' }],
            },
          },
        ],
      },
      {
        type: StructureType.STEP,
        path: '/next',
        code: 'next',
        title: 'Next',
        blocks: [],
      },
    ],
  }
}

function getCompiledStep(steps: readonly CompiledStep[], path: string): CompiledStep {
  const step = steps.find(candidate => candidate.runtimePlan.path === path)

  if (!step) {
    throw new Error(`Expected compiled step for path "${path}"`)
  }

  return step
}

function getNavigationStep(step: CompiledStep): CompiledNavigationStep {
  const navigationStep = step.navigationPlan.navigationSteps.find(item => item.nodeId === step.runtimePlan.nodeId)

  if (!navigationStep) {
    throw new Error(`Expected navigation step for step "${step.runtimePlan.nodeId}"`)
  }

  return navigationStep
}

function createReachabilityContext(functionRegistry: FunctionRegistry): ReachabilityContext {
  return {
    answers: {},
    data: {},
    session: { resume: true },
    params: {},
    query: {},
    request: {},
    conditions: functionRegistry,
  }
}

describe('CodegenOrchestrator', () => {
  describe('compileAll()', () => {
    it('should assemble a shared immutable navigation plan with compiled leaves', async () => {
      // Arrange
      const functionRegistry = createFunctionRegistry()
      const compiler = new JourneyCompiler({
        functionRegistry,
        componentRegistry: createComponentRegistry(),
      })
      const context = createReachabilityContext(functionRegistry)

      // Act
      const result = compiler.compile(createJourneyDefinition())
      const steps = Array.from(result.steps.values())
      const startStep = getCompiledStep(steps, 'start')
      const nextStep = getCompiledStep(steps, 'next')
      const startNavigationStep = getNavigationStep(startStep)
      const fieldCodes = await startNavigationStep.evaluateFieldCodes?.(context)
      const outcomes = await startNavigationStep.evaluateOutcomes?.(context)
      const resumeActive = await startStep.navigationPlan.evaluateResumeWhen?.(context)

      // Assert
      expect(startStep.navigationPlan).toBe(nextStep.navigationPlan)
      expect(startStep.navigationPlan.navigationSteps).toHaveLength(2)
      expect(startNavigationStep.validationPlan).toBe(startStep.validationPlan)
      expect(startNavigationStep).toEqual(
        expect.objectContaining({
          code: 'start',
          isEntryPoint: true,
          cleardownFieldCodes: ['stale-name'],
          declaredOutcomes: ['/next'],
        }),
      )
      expect(fieldCodes).toEqual(['name'])
      expect(outcomes).toEqual(['/next'])
      expect(resumeActive).toBe(true)
    })

    it('should assemble answer preparation items in authored order', () => {
      // Arrange
      const compiler = new JourneyCompiler({
        functionRegistry: createFunctionRegistry(),
        componentRegistry: createComponentRegistry(),
      })
      const journey = createJourneyDefinition()
      const startStep = journey.steps?.[0]

      if (startStep === undefined) {
        throw new Error('Expected start step')
      }

      startStep.blocks = [
        createFieldBlock(),
        {
          type: StructureType.BLOCK,
          blockType: BlockType.BASIC,
          variant: 'collection-block',
          collection: {
            type: ExpressionType.ITERATE,
            input: { type: ExpressionType.REFERENCE, path: ['data', 'firstItems'] },
            iterator: {
              type: IteratorType.MAP,
              yield: {
                blocks: [
                  {
                    type: StructureType.BLOCK,
                    blockType: BlockType.FIELD,
                    variant: 'text',
                    code: 'firstItem',
                  },
                ],
              },
            },
          },
        } as BlockDefinition,
        {
          ...createFieldBlock(),
          code: 'secondName',
        },
        {
          type: StructureType.BLOCK,
          blockType: BlockType.BASIC,
          variant: 'collection-block',
          collection: {
            type: ExpressionType.ITERATE,
            input: { type: ExpressionType.REFERENCE, path: ['answers', 'firstItem'] },
            iterator: {
              type: IteratorType.MAP,
              yield: {
                blocks: [
                  {
                    type: StructureType.BLOCK,
                    blockType: BlockType.FIELD,
                    variant: 'text',
                    code: 'secondItem',
                  },
                ],
              },
            },
          },
        } as BlockDefinition,
      ]

      // Act
      const result = compiler.compile(journey)
      const step = getCompiledStep(Array.from(result.steps.values()), 'start')

      // Assert
      expect(step.answerPreparationPlan.items.map(item => item.kind)).toEqual([
        'field',
        'materialisation-root',
        'field',
        'materialisation-root',
      ])
    })
  })
})
