import { buildComponent } from '../../components/utils/buildComponent'
import {
  BlockType,
  ExpressionType,
  FunctionType,
  HookType,
  OutcomeType,
  PredicateType,
  StructureType,
} from '../../authoring/types/enums'
import type { FieldBlockDefinition } from '../../components/types/structures.type'
import type { JourneyDefinition } from '../../authoring/types/structures.type'
import type { ReachabilityContext } from '../contracts/compiled/phaseContexts.type'
import JourneyCompiler from '../JourneyCompiler'
import ComponentRegistry from '../registries/ComponentRegistry'
import FunctionRegistry from '../registries/FunctionRegistry'
import type { CompiledStep } from '../contracts/plans/compilationArtefacts.type'
import type { NavigationRuntimeEntry } from '../contracts/plans/runtimePlans.type'

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
  const step = steps.find(entry => entry.runtimePlan.path === path)

  if (!step) {
    throw new Error(`Expected compiled step for path "${path}"`)
  }

  return step
}

function getNavigationEntry(step: CompiledStep): NavigationRuntimeEntry {
  const entry = step.navigationPlan.entries.find(item => item.stepId === step.runtimePlan.stepId)

  if (!entry) {
    throw new Error(`Expected navigation entry for step "${step.runtimePlan.stepId}"`)
  }

  return entry
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
      const startEntry = getNavigationEntry(startStep)
      const fieldCodes = await startEntry.evaluateFieldCodes?.(context)
      const outcomes = await startEntry.evaluateOutcomes?.(context)
      const resumeActive = await startStep.navigationPlan.evaluateResume?.(context)

      // Assert
      expect(startStep.navigationPlan).toBe(nextStep.navigationPlan)
      expect(startStep.navigationPlan.entries).toHaveLength(2)
      expect(startStep.navigationPlan.stepValidationPlans.get(startStep.runtimePlan.stepId)).toBe(
        startStep.validationPlan,
      )
      expect(startEntry).toEqual(
        expect.objectContaining({
          code: 'start',
          isEntryPoint: true,
          hasValidation: true,
          cleardownFieldCodes: ['stale-name'],
          declaredOutcomes: ['/next'],
        }),
      )
      expect(fieldCodes).toEqual(['name'])
      expect(outcomes).toEqual(['/next'])
      expect(resumeActive).toBe(true)
    })
  })
})
