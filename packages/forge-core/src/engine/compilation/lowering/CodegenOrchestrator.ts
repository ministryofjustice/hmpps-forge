import type { NodeId } from '../../contracts/ast/engine.type'
import type {
  CompiledJourney,
  CompiledJourneyFunctions,
  CompiledPackageFunctions,
  CompiledStep,
  CompiledStepFunctions,
} from '../../contracts/plans/compilationArtefacts.type'
import type {
  CompiledStaticDataFunction,
  CompiledValidationFunction,
} from '../../contracts/compiled/compiledFunctions.type'
import type { CompilationDependencies } from './compilationDependencies.type'
import type { CompilationModel, JourneyModel, StepModel } from '../../contracts/models/compilationModel.type'
import type { RouteMetadataModel } from '../../concerns/route/contracts/routeMetadataModel.type'
import StepValidationCompiler from '../../concerns/validation/lowering/StepValidationCompiler'
import EntryValidationCompiler from '../../concerns/validation/lowering/EntryValidationCompiler'
import ReachabilityCompiler from '../../concerns/reachability/lowering/ReachabilityCompiler'
import { evaluateReachabilityState } from '../../concerns/reachability/lowering/graph/evaluateReachabilityState'
import StepFieldInventoryCompiler from '../../concerns/answer-cleardown/lowering/StepFieldInventoryCompiler'
import StepResolveCompiler from '../../concerns/resolve/lowering/StepResolveCompiler'
import StepAnswerPreparationCompiler from '../../concerns/answer-preparation/lowering/StepAnswerPreparationCompiler'
import HookLifecycleCompiler from '../../concerns/hooks/lowering/HookLifecycleCompiler'
import RouteMetadataCompiler from '../../concerns/route/lowering/RouteMetadataCompiler'
import CompilationTracer from '../tracing/CompilationTracer'

export default class CodegenOrchestrator {
  private readonly tracer: CompilationTracer

  constructor(private readonly dependencies: CompilationDependencies) {
    this.tracer = dependencies.tracer ?? CompilationTracer.disabled
  }

  compileAll(model: CompilationModel): { steps: Map<NodeId, CompiledStep>; journeys: Map<NodeId, CompiledJourney> } {
    const packageFunctions = this.tracer.span('package-functions', 'codegen.package-functions', () =>
      this.compilePackageFunctions(model.routeMetadata),
    )
    const journeys = new Map<NodeId, CompiledJourney>()
    const steps = new Map<NodeId, CompiledStep>()

    model.journeys.forEach((journey, journeyId) => {
      // A container journey owns no steps and has never produced a compiled
      // journey; emitting one would change the compiled package surface.
      if (journey.steps.size === 0) {
        return
      }

      this.tracer.span(
        `journey:${journeyId}`,
        'codegen.journey',
        () => {
          const journeyFunctions = this.compileJourneyFunctions(journey)

          journeys.set(journeyId, {
            runtimePlan: journey.runtimePlan,
            ...journeyFunctions,
            ...packageFunctions,
          })

          journey.steps.forEach((step, stepId) => {
            this.tracer.span(
              `step:${stepId}`,
              'codegen.step',
              () => {
                const stepFunctions = this.compileStepFunctions(
                  step,
                  journeyFunctions.compiledStepValidations.get(stepId),
                )

                steps.set(stepId, {
                  runtimePlan: step.runtimePlan,
                  compiledReachabilityFacts: journeyFunctions.compiledReachabilityFacts,
                  compiledReachabilityState: journeyFunctions.compiledReachabilityState,
                  compiledFieldInventory: journeyFunctions.compiledFieldInventory,
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

  private compilePackageFunctions(routeMetadata: ReadonlyMap<NodeId, RouteMetadataModel>): CompiledPackageFunctions {
    const routeMetadataCompiler = new RouteMetadataCompiler(this.dependencies)

    return {
      compiledRouteMetadata: routeMetadataCompiler.compile(routeMetadata.values()),
    }
  }

  private compileStepFunctions(
    step: StepModel,
    journeyValidation: CompiledValidationFunction | undefined,
  ): CompiledStepFunctions {
    const hookCompiler = new HookLifecycleCompiler(this.dependencies)
    const answerPrepCompiler = new StepAnswerPreparationCompiler(this.dependencies)
    const validationCompiler = new StepValidationCompiler(this.dependencies)
    const entryValidationCompiler = new EntryValidationCompiler(this.dependencies)
    const resolveCompiler = new StepResolveCompiler(this.dependencies)

    return {
      compiledStaticData: this.compileStaticData(step.staticData),
      compiledAccessLifecycle: hookCompiler.compileAccessLifecycle(step.hooks.access),
      compiledSubmitHooks: hookCompiler.compileSubmitHooks(step.hooks.submit),
      compiledAnswerPreparation: answerPrepCompiler.compile(step.answerPreparation),
      compiledValidation: journeyValidation ?? validationCompiler.compileStepValidation(step.validation),
      compiledEntryValidation: entryValidationCompiler.compileOnEntryValidation(step.validation),
      compiledResolve: resolveCompiler.compile(step.resolve),
    }
  }

  private compileJourneyFunctions(journey: JourneyModel): CompiledJourneyFunctions {
    const { stateTable } = journey.reachability
    const reachabilityCompiler = new ReachabilityCompiler(this.dependencies)
    const fieldInventoryCompiler = new StepFieldInventoryCompiler(this.dependencies)
    const hookCompiler = new HookLifecycleCompiler(this.dependencies)
    const answerPrepCompiler = new StepAnswerPreparationCompiler(this.dependencies)

    return {
      compiledReachabilityFacts: reachabilityCompiler.compileFacts(journey.reachability),
      compiledReachabilityState: input => evaluateReachabilityState(stateTable, input),
      compiledFieldInventory: fieldInventoryCompiler.compile(journey.cleardown),
      compiledStaticData: this.compileStaticData(journey.staticData),
      compiledAccessLifecycle: hookCompiler.compileAccessLifecycle(journey.hooks.access),
      compiledAnswerPreparation: answerPrepCompiler.compile(journey.answerPreparation),
      compiledStepValidations: this.tracer.span('validation-index', 'codegen.validation-index', () =>
        this.compileJourneyValidationIndex(journey),
      ),
    }
  }

  // When reachability checks are enabled, a step has eager validation when it
  // carries validating field blocks or a domain `validWhen`.
  private compileJourneyValidationIndex(journey: JourneyModel): ReadonlyMap<NodeId, CompiledValidationFunction> {
    if (journey.reachability.stateTable.reachabilityDisabled) {
      return new Map()
    }

    const validationCompiler = new StepValidationCompiler(this.dependencies)
    const compiledStepValidations = new Map<NodeId, CompiledValidationFunction>()

    journey.steps.forEach((step, stepId) => {
      if (!step.validation.hasValidation) {
        return
      }

      compiledStepValidations.set(stepId, validationCompiler.compileStepValidation(step.validation))
    })

    return compiledStepValidations
  }

  private compileStaticData(staticData: Record<string, unknown>): CompiledStaticDataFunction {
    return () => ({ ...staticData })
  }
}
