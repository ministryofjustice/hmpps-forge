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
import type ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import StepValidationCompiler from './phase-compilers/validation/StepValidationCompiler'
import ReachabilityCompiler from './phase-compilers/reachability/ReachabilityCompiler'
import { evaluateReachabilityState } from './function-construction/reachability/evaluateReachabilityState'
import StepResolveCompiler from './phase-compilers/resolve/StepResolveCompiler'
import StepAnswerPreparationCompiler from './phase-compilers/answer-preparation/StepAnswerPreparationCompiler'
import HookLifecycleCompiler from './phase-compilers/hooks/HookLifecycleCompiler'
import RouteMetadataCompiler from './phase-compilers/route-tree/RouteMetadataCompiler'

export default class CodegenOrchestrator {
  constructor(private readonly dependencies: CompilationDependencies) {}

  compileAll(
    plan: CompilationPlan,
    nodeRegistry: ASTNodeIndex,
  ): { steps: Map<NodeId, CompiledStep>; journeys: Map<NodeId, CompiledJourney> } {
    const packageFunctions = this.compilePackageFunctions(plan.routeMetadataInputs)
    const journeys = new Map<NodeId, CompiledJourney>()
    const steps = new Map<NodeId, CompiledStep>()

    plan.journeyInputs.forEach((journeyInputs, journeyId) => {
      const reachabilityInputs = this.resolveReachabilityInputs(plan, journeyId)
      const journeyFunctions = this.compileJourneyFunctions(plan, nodeRegistry, journeyInputs, reachabilityInputs)
      const journeyStepIds = this.resolveJourneyStepIds(reachabilityInputs.stateTable)

      journeys.set(journeyId, {
        runtimePlan: journeyInputs.runtimePlan,
        ...journeyFunctions,
        ...packageFunctions,
      })

      journeyStepIds.forEach(stepId => {
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
      })
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
      compiledEntryValidation: validationCompiler.compileOnEntryValidation(
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
    nodeRegistry: ASTNodeIndex,
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
        nodeRegistry,
      ),
      compiledReachabilityState: input => evaluateReachabilityState(stateTable, input),
      compiledStaticData: this.compileStaticData(inputs.staticData),
      compiledAccessLifecycle: hookCompiler.compileAccessLifecycle(inputs.accessHooks),
      compiledAnswerPreparation: answerPrepCompiler.compile(inputs.stepFieldBlocks, inputs.stepMapIterateNodes),
      compiledStepValidations: this.compileJourneyValidationIndex(plan, stateTable),
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
      throw new Error(`Reachability inputs missing for journey "${journeyId}"`)
    }

    return inputs
  }

  private resolveStepInputs(plan: CompilationPlan, stepId: NodeId): StepCompilationInputs {
    const inputs = plan.stepInputs.get(stepId)

    if (inputs === undefined) {
      throw new Error(`Step inputs missing for step "${stepId}"`)
    }

    return inputs
  }

  private compileStaticData(staticData: Record<string, unknown>): CompiledStaticDataFunction {
    return () => ({ ...staticData })
  }
}
