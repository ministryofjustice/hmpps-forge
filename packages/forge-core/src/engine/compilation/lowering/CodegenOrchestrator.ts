import type { NodeId } from '../../contracts/ast/engine.type'
import type { CompiledJourney, CompiledStep } from '../../contracts/plans/compilationArtefacts.type'
import type { NavigationRuntimePlan } from '../../contracts/plans/runtimePlans.type'
import type {
  CompiledStaticDataFunction,
  CompiledValidationFunction,
} from '../../contracts/compiled/compiledFunctions.type'
import type { CompilationDependencies } from './compilationDependencies.type'
import type {
  CompilationPlan,
  NavigationCompilationInputs,
  StepCompilationInputs,
  StepCoreInputs,
} from '../../contracts/plans/compilationPlan.type'
import type ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import StepValidationCompiler from './phase-compilers/validation/StepValidationCompiler'
import ReachabilityCompiler from './phase-compilers/reachability/ReachabilityCompiler'
import { evaluateReachabilityState } from './function-construction/reachability/evaluateReachabilityState'
import StepResolveCompiler from './phase-compilers/resolve/StepResolveCompiler'
import StepAnswerPreparationCompiler from './phase-compilers/answer-preparation/StepAnswerPreparationCompiler'
import HookLifecycleCompiler from './phase-compilers/hooks/HookLifecycleCompiler'

export default class CodegenOrchestrator {
  constructor(private readonly dependencies: CompilationDependencies) {}

  compileAll(
    plan: CompilationPlan,
    nodeRegistry: ASTNodeIndex,
  ): { steps: Map<NodeId, CompiledStep>; journeys: Map<NodeId, CompiledJourney> } {
    this.compileNavigation(plan, nodeRegistry)
    const journeys = this.compileJourneys(plan)

    const steps = new Map<NodeId, CompiledStep>()

    plan.stepInputs.forEach((inputs, stepId) => {
      steps.set(stepId, this.compileStep(inputs, plan))
    })

    this.resolveStepValidations(steps, journeys, this.resolveValidatingStepIds(plan))

    return { steps, journeys }
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
    steps: Map<NodeId, CompiledStep>,
    journeys: Map<NodeId, CompiledJourney>,
    validatingStepIds: ReadonlySet<NodeId>,
  ): void {
    steps.forEach(step => {
      step.compiledStepValidations = this.collectStepValidations(step.navigationPlan, steps, validatingStepIds)
    })
    journeys.forEach(journey => {
      journey.compiledStepValidations = this.collectStepValidations(journey.navigationPlan, steps, validatingStepIds)
    })
  }

  private collectStepValidations(
    navigationPlan: NavigationRuntimePlan,
    steps: ReadonlyMap<NodeId, CompiledStep>,
    validatingStepIds: ReadonlySet<NodeId>,
  ): ReadonlyMap<NodeId, CompiledValidationFunction> {
    const compiledStepValidations = new Map<NodeId, CompiledValidationFunction>()

    navigationPlan.entries.forEach(entry => {
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

  private compileNavigation(plan: CompilationPlan, nodeRegistry: ASTNodeIndex): void {
    const reachabilityCompiler = new ReachabilityCompiler(this.dependencies)

    plan.navigationInputs.forEach(navigationInputs => {
      const navigationPlan = navigationInputs.runtimePlan

      navigationPlan.compiledReachabilityFacts = reachabilityCompiler.compileFacts(
        navigationInputs.reachabilityPlan,
        navigationInputs.fieldInventorySources,
        nodeRegistry,
      )
      navigationPlan.compiledReachabilityState = input => evaluateReachabilityState(navigationPlan, input)
    })
  }

  private compileJourneys(plan: CompilationPlan): Map<NodeId, CompiledJourney> {
    const hookCompiler = new HookLifecycleCompiler(this.dependencies)
    const answerPrepCompiler = new StepAnswerPreparationCompiler(this.dependencies)
    const compiledJourneys = new Map<NodeId, CompiledJourney>()

    plan.journeyInputs.forEach((inputs, journeyId) => {
      compiledJourneys.set(journeyId, {
        runtimePlan: inputs.runtimePlan,
        navigationPlan: inputs.navigationPlan,
        compiledStaticData: this.compileStaticData(inputs.staticData),
        compiledAccessLifecycle: hookCompiler.compileAccessLifecycle(inputs.accessHooks),
        compiledAnswerPreparation: answerPrepCompiler.compile(inputs.stepFieldBlocks, inputs.stepMapIterateNodes),
        compiledStepValidations: new Map(),
      })
    })

    return compiledJourneys
  }

  private compileStep(inputs: StepCompilationInputs, plan: CompilationPlan): CompiledStep {
    const navigationInputs = this.resolveNavigationInputs(inputs.core, plan)

    const navigationPlan = navigationInputs.runtimePlan

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
      navigationPlan,
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

  private resolveNavigationInputs(core: StepCoreInputs, plan: CompilationPlan): NavigationCompilationInputs {
    const navigationInputs = plan.navigationInputs.get(core.navigationId)

    if (!navigationInputs) {
      throw new Error(`Unable to compile step "${core.stepNode.id}" - navigation inputs not found`)
    }

    return navigationInputs
  }

  private compileStaticData(staticData: Record<string, unknown>): CompiledStaticDataFunction {
    return () => ({ ...staticData })
  }
}
