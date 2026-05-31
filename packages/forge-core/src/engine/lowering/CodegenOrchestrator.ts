import type { NodeId } from '../contracts/ast/engine.type'
import type { CompiledValidationFunction } from '../contracts/compiled/compiledFunctions.type'
import type { CompiledJourney, CompiledStep } from '../contracts/plans/compilationArtefacts.type'
import type { ReachabilityCompilationPlan } from '../contracts/plans/runtimePlans.type'
import type { CompilationDependencies } from './compilationDependencies.type'
import type { CompilationPlan, StepCompilationInputs } from '../contracts/plans/compilationPlan.type'
import type ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import StepValidationCompiler from './phase-compilers/validation/StepValidationCompiler'
import ReachabilityCompiler from './phase-compilers/navigation/ReachabilityCompiler'
import StepRenderCompiler from './phase-compilers/rendering/StepRenderCompiler'
import StepAnswerPreparationCompiler from './phase-compilers/answer-preparation/StepAnswerPreparationCompiler'
import HookLifecycleCompiler from './phase-compilers/hooks/HookLifecycleCompiler'

export default class CodegenOrchestrator {
  constructor(private readonly dependencies: CompilationDependencies) {}

  compileAll(
    plan: CompilationPlan,
    nodeRegistry: ASTNodeIndex,
  ): { steps: Map<NodeId, CompiledStep>; journeys: Map<NodeId, CompiledJourney> } {
    // Navigation must compile before steps: compileStep reuses the per-step
    // validation functions that compileNavigation attaches to each shared
    // NavigationRuntimePlan.
    this.compileNavigation(plan, nodeRegistry)
    const journeys = this.compileJourneys(plan)

    const steps = new Map<NodeId, CompiledStep>()

    plan.stepInputs.forEach((inputs, stepId) => {
      steps.set(stepId, this.compileStep(inputs, plan))
    })

    return { steps, journeys }
  }

  private compileNavigation(plan: CompilationPlan, nodeRegistry: ASTNodeIndex): void {
    const reachabilityCompiler = new ReachabilityCompiler(this.dependencies)

    plan.reachabilityPlans.forEach(reachabilityPlan => {
      reachabilityPlan.navigationPlan.compiledStepValidations = this.compileStepValidationMap(reachabilityPlan, plan)
      reachabilityPlan.navigationPlan.compiledNavigation = reachabilityCompiler.compileNavigation(
        reachabilityPlan,
        plan.fieldInventorySources.get(reachabilityPlan.navigationPlan) ?? [],
        nodeRegistry,
      )
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
        compiledAccessLifecycle: hookCompiler.compileAccessLifecycle(inputs.accessAncestors),
        compiledAnswerPreparation: answerPrepCompiler.compile(inputs.stepFieldBlocks, inputs.stepMapIterateNodes),
      })
    })

    return compiledJourneys
  }

  private compileStep(inputs: StepCompilationInputs, plan: CompilationPlan): CompiledStep {
    const navigationPlan = plan.navigationPlansByStepId.get(inputs.stepNode.id)

    if (!navigationPlan) {
      throw new Error(`Unable to compile step "${inputs.stepNode.id}" - navigation plan not found`)
    }

    const hookCompiler = new HookLifecycleCompiler(this.dependencies)
    const compiledAccessLifecycle = hookCompiler.compileAccessLifecycle(inputs.accessAncestors)
    const compiledSubmitHooks = hookCompiler.compileSubmitHooks(inputs.submitHooks)

    const answerPrepCompiler = new StepAnswerPreparationCompiler(this.dependencies)
    const compiledAnswerPreparation = answerPrepCompiler.compile(inputs.fieldBlocks, inputs.mapIterateNodes)

    const validationCompiler = new StepValidationCompiler(this.dependencies)
    const compiledValidation =
      navigationPlan.compiledStepValidations.get(inputs.stepNode.id) ??
      validationCompiler.compileOnSubmitValidation(
        inputs.stepNode,
        inputs.validatingFieldBlocks,
        inputs.stepNode.properties.validWhen,
        inputs.mapIterateNodes,
      )
    const compiledEntryValidation = validationCompiler.compileOnEntryValidation(
      inputs.stepNode.properties.validateOnEntry,
    )

    const renderCompiler = new StepRenderCompiler(this.dependencies)
    const compiledRender = renderCompiler.compile(inputs.stepNode, inputs.renderAncestors, inputs.allIterateNodes)

    return {
      runtimePlan: inputs.runtimePlan,
      navigationPlan,
      compiledAccessLifecycle,
      compiledSubmitHooks,
      compiledAnswerPreparation,
      compiledValidation,
      compiledEntryValidation,
      compiledRender,
    }
  }

  private compileStepValidationMap(
    reachabilityPlan: ReachabilityCompilationPlan,
    plan: CompilationPlan,
  ): Map<NodeId, CompiledValidationFunction> {
    const compiledValidations = new Map<NodeId, CompiledValidationFunction>()
    const compiler = new StepValidationCompiler(this.dependencies)

    reachabilityPlan.entries
      .filter(entry => entry.hasValidation)
      .forEach(entry => {
        const stepInputs = plan.stepInputs.get(entry.stepId)

        if (!stepInputs) {
          return
        }

        const compiled = compiler.compileOnSubmitValidation(
          stepInputs.stepNode,
          stepInputs.validatingFieldBlocks,
          stepInputs.stepNode.properties.validWhen,
          stepInputs.mapIterateNodes,
        )

        if (compiled) {
          compiledValidations.set(entry.stepId, compiled)
        }
      })

    return compiledValidations
  }
}
