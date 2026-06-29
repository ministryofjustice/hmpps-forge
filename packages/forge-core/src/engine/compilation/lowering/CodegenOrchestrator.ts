import type { NodeId } from '../../contracts/ast/engine.type'
import type { CompiledJourney, CompiledStep } from '../../contracts/plans/compilationArtefacts.type'
import type { ReachabilityStateTable } from '../../contracts/plans/runtimePlans.type'
import type {
  CompiledReachabilityFactsFunction,
  CompiledReachabilityStateFunction,
  CompiledStaticDataFunction,
  CompiledValidationFunction,
} from '../../contracts/compiled/compiledFunctions.type'
import type { CompilationDependencies } from './compilationDependencies.type'
import type { CompilationPlan, StepCompilationInputs } from '../../contracts/plans/compilationPlan.type'
import type ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import StepValidationCompiler from './phase-compilers/validation/StepValidationCompiler'
import ReachabilityCompiler from './phase-compilers/reachability/ReachabilityCompiler'
import { evaluateReachabilityState } from './function-construction/reachability/evaluateReachabilityState'
import StepResolveCompiler from './phase-compilers/resolve/StepResolveCompiler'
import StepAnswerPreparationCompiler from './phase-compilers/answer-preparation/StepAnswerPreparationCompiler'
import HookLifecycleCompiler from './phase-compilers/hooks/HookLifecycleCompiler'

interface CompiledReachability {
  readonly compiledReachabilityFacts: CompiledReachabilityFactsFunction
  readonly compiledReachabilityState: CompiledReachabilityStateFunction
}

export default class CodegenOrchestrator {
  constructor(private readonly dependencies: CompilationDependencies) {}

  compileAll(
    plan: CompilationPlan,
    nodeRegistry: ASTNodeIndex,
  ): { steps: Map<NodeId, CompiledStep>; journeys: Map<NodeId, CompiledJourney> } {
    const compiledReachabilityByJourney = this.compileNavigation(plan, nodeRegistry)
    const journeys = this.compileJourneys(plan, compiledReachabilityByJourney)

    const steps = new Map<NodeId, CompiledStep>()

    plan.stepInputs.forEach((inputs, stepId) => {
      steps.set(stepId, this.compileStep(inputs, compiledReachabilityByJourney))
    })

    this.resolveStepValidations(plan, steps, journeys, this.resolveValidatingStepIds(plan))

    return { steps, journeys }
  }

  // Compiles, once per journey, the reachability facts function and the state closure. The state
  // closure captures the pure static table privately; the runtime calls it without ever seeing the
  // table. Keyed by navigation id so each step and journey can pick up its journey's pair.
  private compileNavigation(plan: CompilationPlan, nodeRegistry: ASTNodeIndex): Map<NodeId, CompiledReachability> {
    const reachabilityCompiler = new ReachabilityCompiler(this.dependencies)
    const compiledReachabilityByJourney = new Map<NodeId, CompiledReachability>()

    plan.navigationInputs.forEach((navigationInputs, navigationId) => {
      const { stateTable } = navigationInputs

      compiledReachabilityByJourney.set(navigationId, {
        compiledReachabilityFacts: reachabilityCompiler.compileFacts(
          navigationInputs.reachabilityPlan,
          navigationInputs.fieldInventorySources,
          nodeRegistry,
        ),
        compiledReachabilityState: input => evaluateReachabilityState(stateTable, input),
      })
    })

    return compiledReachabilityByJourney
  }

  // Which steps the eager validities phase validates is a validation fact, not a navigation one:
  // a step has validation when it carries validating field blocks or a domain `validWhen`.
  private resolveValidatingStepIds(plan: CompilationPlan): ReadonlySet<NodeId> {
    const validatingStepIds = new Set<NodeId>()

    plan.stepInputs.forEach((inputs, stepId) => {
      if (inputs.validation.hasValidation) {
        validatingStepIds.add(stepId)
      }
    })

    return validatingStepIds
  }

  // Each step/journey carries the compiled validators of every validating step in its journey, so
  // the runtime can check the validity of surrounding steps. This runs once all steps are compiled,
  // since a journey can reference steps compiled later in the pass.
  private resolveStepValidations(
    plan: CompilationPlan,
    steps: Map<NodeId, CompiledStep>,
    journeys: Map<NodeId, CompiledJourney>,
    validatingStepIds: ReadonlySet<NodeId>,
  ): void {
    steps.forEach((step, stepId) => {
      const navigationId = plan.stepInputs.get(stepId)?.core.navigationId
      const stateTable = navigationId !== undefined ? plan.navigationInputs.get(navigationId)?.stateTable : undefined

      step.compiledStepValidations = this.collectStepValidations(stateTable, steps, validatingStepIds)
    })
    journeys.forEach((journey, journeyId) => {
      const stateTable = plan.navigationInputs.get(journeyId)?.stateTable

      journey.compiledStepValidations = this.collectStepValidations(stateTable, steps, validatingStepIds)
    })
  }

  private collectStepValidations(
    stateTable: ReachabilityStateTable | undefined,
    steps: ReadonlyMap<NodeId, CompiledStep>,
    validatingStepIds: ReadonlySet<NodeId>,
  ): ReadonlyMap<NodeId, CompiledValidationFunction> {
    const compiledStepValidations = new Map<NodeId, CompiledValidationFunction>()

    stateTable?.entries.forEach(entry => {
      if (!validatingStepIds.has(entry.stepId)) {
        return
      }

      const compiledValidation = steps.get(entry.stepId)?.compiledValidation

      if (compiledValidation !== undefined) {
        compiledStepValidations.set(entry.stepId, compiledValidation)
      }
    })

    return compiledStepValidations
  }

  private compileJourneys(
    plan: CompilationPlan,
    compiledReachabilityByJourney: ReadonlyMap<NodeId, CompiledReachability>,
  ): Map<NodeId, CompiledJourney> {
    const hookCompiler = new HookLifecycleCompiler(this.dependencies)
    const answerPrepCompiler = new StepAnswerPreparationCompiler(this.dependencies)
    const compiledJourneys = new Map<NodeId, CompiledJourney>()

    plan.journeyInputs.forEach((inputs, journeyId) => {
      const reachability = compiledReachabilityByJourney.get(journeyId)

      compiledJourneys.set(journeyId, {
        runtimePlan: inputs.runtimePlan,
        compiledReachabilityFacts: reachability?.compiledReachabilityFacts,
        compiledReachabilityState: reachability?.compiledReachabilityState,
        compiledStaticData: this.compileStaticData(inputs.staticData),
        compiledAccessLifecycle: hookCompiler.compileAccessLifecycle(inputs.accessHooks),
        compiledAnswerPreparation: answerPrepCompiler.compile(inputs.stepFieldBlocks, inputs.stepMapIterateNodes),
        compiledStepValidations: new Map(),
      })
    })

    return compiledJourneys
  }

  private compileStep(
    inputs: StepCompilationInputs,
    compiledReachabilityByJourney: ReadonlyMap<NodeId, CompiledReachability>,
  ): CompiledStep {
    const reachability = compiledReachabilityByJourney.get(inputs.core.navigationId)

    const hookCompiler = new HookLifecycleCompiler(this.dependencies)
    const compiledAccessLifecycle = hookCompiler.compileAccessLifecycle(inputs.hooks.accessHooks)
    const compiledSubmitHooks = hookCompiler.compileSubmitHooks(inputs.hooks.submitHooks)

    const answerPrepCompiler = new StepAnswerPreparationCompiler(this.dependencies)
    const compiledAnswerPreparation = answerPrepCompiler.compile(
      inputs.answerPreparation.fieldBlocks,
      inputs.answerPreparation.mapIterateNodes,
    )

    const validationCompiler = new StepValidationCompiler(this.dependencies)
    const compiledValidation = validationCompiler.compileOnSubmitValidation(
      inputs.validation.stepNode,
      inputs.validation.validatingFieldBlocks,
      inputs.validation.stepNode.properties.validWhen,
      inputs.validation.mapIterateNodes,
    )
    const compiledEntryValidation = validationCompiler.compileOnEntryValidation(
      inputs.validation.stepNode.properties.validateOnEntry,
    )

    const resolveCompiler = new StepResolveCompiler(this.dependencies)
    const compiledResolve = resolveCompiler.compile(
      inputs.resolve.stepNode,
      inputs.resolve.ancestorJourneys,
      inputs.resolve.allIterateNodes,
    )

    return {
      runtimePlan: inputs.core.runtimePlan,
      compiledReachabilityFacts: reachability?.compiledReachabilityFacts,
      compiledReachabilityState: reachability?.compiledReachabilityState,
      compiledStaticData: this.compileStaticData(inputs.core.staticData),
      compiledAccessLifecycle,
      compiledSubmitHooks,
      compiledAnswerPreparation,
      compiledValidation,
      compiledEntryValidation,
      compiledResolve,
      compiledStepValidations: new Map(),
    }
  }

  private compileStaticData(staticData: Record<string, unknown>): CompiledStaticDataFunction {
    return () => ({ ...staticData })
  }
}
