import type { NodeId } from '../../contracts/ast/engine.type'
import type {
  CompiledJourneyFunctions,
  CompiledPackageFunctions,
  CompiledStepFunctions,
} from '../../contracts/plans/compilationArtefacts.type'
import type {
  CompiledStaticDataFunction,
  CompiledValidationFunction,
} from '../../contracts/compiled/compiledFunctions.type'
import type { CompilationDependencies } from './compilationDependencies.type'
import type { JourneyModel, StepModel } from '../../contracts/models/compilationModel.type'
import type { RouteMetadataModel } from '../../../concerns/route/contracts/routeMetadataModel.type'
import StepValidationCompiler from '../../../concerns/validation/lowering/StepValidationCompiler'
import EntryValidationCompiler from '../../../concerns/validation/lowering/EntryValidationCompiler'
import ReachabilityCompiler from '../../../concerns/reachability/lowering/ReachabilityCompiler'
import { evaluateReachabilityState } from '../../../concerns/reachability/lowering/graph/evaluateReachabilityState'
import StepFieldInventoryCompiler from '../../../concerns/answer-cleardown/lowering/StepFieldInventoryCompiler'
import StepResolveCompiler from '../../../concerns/resolve/lowering/StepResolveCompiler'
import StepAnswerPreparationCompiler from '../../../concerns/answer-preparation/lowering/StepAnswerPreparationCompiler'
import HookLifecycleCompiler from '../../../concerns/hooks/lowering/HookLifecycleCompiler'
import RouteMetadataCompiler from '../../../concerns/route/lowering/RouteMetadataCompiler'

export default class CodegenOrchestrator {
  constructor(private readonly dependencies: CompilationDependencies) {}

  compilePackageFunctions(routeMetadata: ReadonlyMap<NodeId, RouteMetadataModel>): CompiledPackageFunctions {
    const routeMetadataCompiler = new RouteMetadataCompiler(this.dependencies)

    return {
      compiledRouteMetadata: routeMetadataCompiler.compile(routeMetadata.values()),
    }
  }

  compileStepFunctions(
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

  compileJourneyFunctions(journey: JourneyModel): CompiledJourneyFunctions {
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
      compiledStepValidations: this.compileJourneyValidationIndex(journey),
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
