import type { NodeId } from '../../contracts/ast/engine.type'
import type {
  CompiledJourney,
  CompiledJourneyFunctions,
  CompiledPackageFunctions,
  CompiledStep,
  CompiledStepFunctions,
} from '../../contracts/plans/compilationArtefacts.type'
import type { ReachabilityStateTable } from '../../contracts/plans/runtimePlans.type'
import type {
  CompiledStaticDataFunction,
  CompiledValidationFunction,
} from '../../contracts/compiled/compiledFunctions.type'
import type { CompilationDependencies } from './compilationDependencies.type'
import type {
  CompilationPlan,
  JourneyCompilationInputs,
  ReachabilityCompilationInputs,
  RouteMetadataCompilationInputs,
  StepCompilationInputs,
} from '../../contracts/plans/compilationPlan.type'
import StepValidationCompiler from '../../concerns/validation/lowering/StepValidationCompiler'
import EntryValidationCompiler from '../../concerns/entry-validation/lowering/EntryValidationCompiler'
import ReachabilityCompiler from '../../concerns/reachability/lowering/ReachabilityCompiler'
import { evaluateReachabilityState } from '../../concerns/reachability/lowering/graph/evaluateReachabilityState'
import StepResolveCompiler from '../../concerns/resolve/lowering/StepResolveCompiler'
import StepAnswerPreparationCompiler from '../../concerns/answer-preparation/lowering/StepAnswerPreparationCompiler'
import HookLifecycleCompiler from '../../concerns/hooks/lowering/HookLifecycleCompiler'
import RouteMetadataCompiler from '../../concerns/route/lowering/RouteMetadataCompiler'
import CompilationTracer from '../../diagnostics/tracing/CompilationTracer'
import ForgeInternalError from '../../errors/ForgeInternalError'

export default class CodegenOrchestrator {
  private readonly tracer: CompilationTracer

  constructor(private readonly dependencies: CompilationDependencies) {
    this.tracer = dependencies.tracer ?? CompilationTracer.disabled
  }

  compileAll(plan: CompilationPlan): { steps: Map<NodeId, CompiledStep>; journeys: Map<NodeId, CompiledJourney> } {
    const packageFunctions = this.tracer.span('package-functions', 'codegen.package-functions', () =>
      this.compilePackageFunctions(plan.routeMetadataInputs),
    )
    const journeys = new Map<NodeId, CompiledJourney>()
    const steps = new Map<NodeId, CompiledStep>()

    plan.journeyInputs.forEach((journeyInputs, journeyId) => {
      this.tracer.span(
        `journey:${journeyId}`,
        'codegen.journey',
        () => {
          const reachabilityInputs = this.resolveReachabilityInputs(plan, journeyId)
          const journeyFunctions = this.compileJourneyFunctions(plan, journeyInputs, reachabilityInputs)
          const journeyStepIds = this.resolveJourneyStepIds(reachabilityInputs.stateTable)

          journeys.set(journeyId, {
            runtimePlan: journeyInputs.runtimePlan,
            ...journeyFunctions,
            ...packageFunctions,
          })

          journeyStepIds.forEach(stepId => {
            this.tracer.span(
              `step:${stepId}`,
              'codegen.step',
              () => {
                const stepInputs = this.resolveStepInputs(plan, stepId)
                const stepFunctions = this.compileStepFunctions(stepInputs)

                steps.set(stepId, {
                  runtimePlan: stepInputs.core.runtimePlan,
                  compiledReachabilityFacts: journeyFunctions.compiledReachabilityFacts,
                  compiledReachabilityState: journeyFunctions.compiledReachabilityState,
                  compiledStepValidations: journeyFunctions.compiledStepValidations,
                  ...stepFunctions,
                  ...packageFunctions,
                })
              },
              { nodeId: stepId },
            )
          })
        },
        { nodeId: journeyId },
      )
    })

    return { steps, journeys }
  }

  private compilePackageFunctions(
    routeMetadataInputs: ReadonlyMap<NodeId, RouteMetadataCompilationInputs>,
  ): CompiledPackageFunctions {
    const routeMetadataCompiler = new RouteMetadataCompiler(this.dependencies)

    return {
      compiledRouteMetadata: routeMetadataCompiler.compile(routeMetadataInputs.values()),
    }
  }

  private compileStepFunctions(inputs: StepCompilationInputs): CompiledStepFunctions {
    const hookCompiler = new HookLifecycleCompiler(this.dependencies)
    const answerPrepCompiler = new StepAnswerPreparationCompiler(this.dependencies)
    const validationCompiler = new StepValidationCompiler(this.dependencies)
    const entryValidationCompiler = new EntryValidationCompiler(this.dependencies)
    const resolveCompiler = new StepResolveCompiler(this.dependencies)

    return {
      compiledStaticData: this.compileStaticData(inputs.core.staticData),
      compiledAccessLifecycle: hookCompiler.compileAccessLifecycle(inputs.hooks.accessHooks),
      compiledSubmitHooks: hookCompiler.compileSubmitHooks(inputs.hooks.submitHooks),
      compiledAnswerPreparation: answerPrepCompiler.compile(
        inputs.answerPreparation.fieldBlocks,
        inputs.answerPreparation.mapIterateNodes,
      ),
      compiledValidation: validationCompiler.compileOnSubmitValidation(
        inputs.validation.stepNode,
        inputs.validation.validatingFieldBlocks,
        inputs.validation.stepNode.properties.validWhen,
        inputs.validation.mapIterateNodes,
      ),
      compiledEntryValidation: entryValidationCompiler.compileOnEntryValidation(
        inputs.validation.stepNode.properties.validateOnEntry,
      ),
      compiledResolve: resolveCompiler.compile(
        inputs.resolve.stepNode,
        inputs.resolve.ancestorJourneys,
        inputs.resolve.allIterateNodes,
      ),
    }
  }

  private compileJourneyFunctions(
    plan: CompilationPlan,
    inputs: JourneyCompilationInputs,
    reachabilityInputs: ReachabilityCompilationInputs,
  ): CompiledJourneyFunctions {
    const { stateTable } = reachabilityInputs
    const reachabilityCompiler = new ReachabilityCompiler(this.dependencies)
    const hookCompiler = new HookLifecycleCompiler(this.dependencies)
    const answerPrepCompiler = new StepAnswerPreparationCompiler(this.dependencies)

    return {
      compiledReachabilityFacts: reachabilityCompiler.compileFacts(
        reachabilityInputs.reachabilityPlan,
        reachabilityInputs.fieldInventorySources,
      ),
      compiledReachabilityState: input => evaluateReachabilityState(stateTable, input),
      compiledStaticData: this.compileStaticData(inputs.staticData),
      compiledAccessLifecycle: hookCompiler.compileAccessLifecycle(inputs.accessHooks),
      compiledAnswerPreparation: answerPrepCompiler.compile(inputs.stepFieldBlocks, inputs.stepMapIterateNodes),
      compiledStepValidations: this.tracer.span('validation-index', 'codegen.validation-index', () =>
        this.compileJourneyValidationIndex(plan, stateTable),
      ),
    }
  }

  private compileJourneyValidationIndex(
    plan: CompilationPlan,
    stateTable: ReachabilityStateTable,
  ): ReadonlyMap<NodeId, CompiledValidationFunction> {
    if (stateTable.reachabilityDisabled) {
      return new Map()
    }

    const validationCompiler = new StepValidationCompiler(this.dependencies)
    const validatingStepIds = this.resolveValidatingStepIds(plan)
    const compiledStepValidations = new Map<NodeId, CompiledValidationFunction>()

    stateTable.entries.forEach(entry => {
      const stepInputs = this.resolveStepInputs(plan, entry.stepId)

      if (!validatingStepIds.has(entry.stepId)) {
        return
      }

      compiledStepValidations.set(
        entry.stepId,
        validationCompiler.compileOnSubmitValidation(
          stepInputs.validation.stepNode,
          stepInputs.validation.validatingFieldBlocks,
          stepInputs.validation.stepNode.properties.validWhen,
          stepInputs.validation.mapIterateNodes,
        ),
      )
    })

    return compiledStepValidations
  }

  // When reachability checks are enabled, a step has eager validation when it
  // carries validating field blocks or a domain `validWhen`.
  private resolveValidatingStepIds(plan: CompilationPlan): ReadonlySet<NodeId> {
    const validatingStepIds = new Set<NodeId>()

    plan.stepInputs.forEach((inputs, stepId) => {
      if (inputs.validation.hasValidation) {
        validatingStepIds.add(stepId)
      }
    })

    return validatingStepIds
  }

  private resolveJourneyStepIds(stateTable: ReachabilityStateTable): NodeId[] {
    return stateTable.entries.map(entry => entry.stepId)
  }

  private resolveReachabilityInputs(plan: CompilationPlan, journeyId: NodeId): ReachabilityCompilationInputs {
    const inputs = plan.reachabilityInputs.get(journeyId)

    if (inputs === undefined) {
      throw new ForgeInternalError(`Reachability inputs missing for journey "${journeyId}"`)
    }

    return inputs
  }

  private resolveStepInputs(plan: CompilationPlan, stepId: NodeId): StepCompilationInputs {
    const inputs = plan.stepInputs.get(stepId)

    if (inputs === undefined) {
      throw new ForgeInternalError(`Step inputs missing for step "${stepId}"`)
    }

    return inputs
  }

  private compileStaticData(staticData: Record<string, unknown>): CompiledStaticDataFunction {
    return () => ({ ...staticData })
  }
}
