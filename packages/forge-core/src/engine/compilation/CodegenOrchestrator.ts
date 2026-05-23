import type { NodeId } from '../types/engine.type'
import type { CompiledValidationFunction } from '../types/compiledPhaseResults.type'
import type { CompiledStep } from '../types/compilationArtefacts.type'
import type { ReachabilityCompilationPlan } from '../types/runtimePlans.type'
import type { CompilationDependencies } from './codegen/CompilationDependencies'
import type { CompilationPlan, StepCompilationInputs } from './CompilationPlanner'
import type NodeRegistry from './registries/NodeRegistry'
import StepValidationCompiler from './codegen/phase-compilers/validation/StepValidationCompiler'
import ReachabilityCompiler from './codegen/phase-compilers/reachability/ReachabilityCompiler'
import StepRenderCompiler from './codegen/phase-compilers/rendering/StepRenderCompiler'
import StepAnswerPreparationCompiler from './codegen/phase-compilers/answer-preparation/StepAnswerPreparationCompiler'
import HookLifecycleCompiler from './codegen/phase-compilers/hooks/HookLifecycleCompiler'

export default class CodegenOrchestrator {
  constructor(private readonly dependencies: CompilationDependencies) {}

  compileAll(plan: CompilationPlan, nodeRegistry: NodeRegistry): Map<NodeId, CompiledStep> {
    this.compileNavigation(plan, nodeRegistry)
    this.compileJourneys(plan)

    const compiledSteps = new Map<NodeId, CompiledStep>()

    plan.stepInputs.forEach((inputs, stepId) => {
      compiledSteps.set(stepId, this.compileStep(inputs, plan))
    })

    return compiledSteps
  }

  private compileNavigation(plan: CompilationPlan, nodeRegistry: NodeRegistry): void {
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

  private compileJourneys(plan: CompilationPlan): void {
    const hookCompiler = new HookLifecycleCompiler(this.dependencies)
    const answerPrepCompiler = new StepAnswerPreparationCompiler(this.dependencies)

    plan.journeyInputs.forEach(inputs => {
      inputs.runtimePlan.compiledAccessLifecycle = hookCompiler.compileAccessLifecycle(inputs.accessAncestors)
      inputs.runtimePlan.compiledAnswerPreparation = answerPrepCompiler.compile(
        inputs.stepFieldBlocks,
        inputs.stepMapIterateNodes,
      )
    })
  }

  private compileStep(inputs: StepCompilationInputs, plan: CompilationPlan): CompiledStep {
    const navigationPlan = plan.navigationPlansByStepId.get(inputs.stepNode.id)

    if (!navigationPlan) {
      throw new Error(`Unable to compile step "${inputs.stepNode.id}" - navigation plan not found`)
    }

    const hookCompiler = new HookLifecycleCompiler(this.dependencies)

    inputs.runtimePlan.compiledAccessLifecycle = hookCompiler.compileAccessLifecycle(inputs.accessAncestors)
    inputs.runtimePlan.compiledSubmitHooks = hookCompiler.compileSubmitHooks(inputs.submitHooks)

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
      compiledValidation,
      compiledEntryValidation,
      compiledRender,
      compiledAnswerPreparation,
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
