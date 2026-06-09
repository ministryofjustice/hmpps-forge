import type { NodeId } from '../contracts/ast/engine.type'
import type { CompiledValidationFunction } from '../contracts/compiled/compiledFunctions.type'
import type { CompiledJourney, CompiledStep, ValidationPlan } from '../contracts/plans/compilationArtefacts.type'
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
    const validationPlans = this.compileValidationPlans(plan)

    this.compileNavigation(plan, nodeRegistry, validationPlans)
    const journeys = this.compileJourneys(plan)

    const steps = new Map<NodeId, CompiledStep>()

    plan.stepInputs.forEach((inputs, stepId) => {
      steps.set(stepId, this.compileStep(inputs, plan, validationPlans))
    })

    return { steps, journeys }
  }

  private compileNavigation(
    plan: CompilationPlan,
    nodeRegistry: ASTNodeIndex,
    validationPlans: Map<NodeId, ValidationPlan | undefined>,
  ): void {
    const reachabilityCompiler = new ReachabilityCompiler(this.dependencies)

    plan.reachabilityPlans.forEach(reachabilityPlan => {
      reachabilityPlan.navigationPlan.compiledStepValidations = this.wrapValidationPlansForReachability(
        reachabilityPlan,
        validationPlans,
      )
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
        accessLifecyclePlan: hookCompiler.compileAccessLifecyclePlan(inputs.accessAncestors),
        answerPreparationPlan: answerPrepCompiler.compileAnswerPreparationPlan(
          inputs.stepFieldBlocks,
          inputs.stepMapIterateNodes,
        ),
      })
    })

    return compiledJourneys
  }

  private compileStep(
    inputs: StepCompilationInputs,
    plan: CompilationPlan,
    validationPlans: Map<NodeId, ValidationPlan | undefined>,
  ): CompiledStep {
    const navigationPlan = plan.navigationPlansByStepId.get(inputs.stepNode.id)

    if (!navigationPlan) {
      throw new Error(`Unable to compile step "${inputs.stepNode.id}" - navigation plan not found`)
    }

    const hookCompiler = new HookLifecycleCompiler(this.dependencies)
    const accessLifecyclePlan = hookCompiler.compileAccessLifecyclePlan(inputs.accessAncestors)
    const submitLifecyclePlan = hookCompiler.compileSubmitLifecyclePlan(inputs.submitHooks)

    const answerPrepCompiler = new StepAnswerPreparationCompiler(this.dependencies)
    const answerPreparationPlan = answerPrepCompiler.compileAnswerPreparationPlan(
      inputs.fieldBlocks,
      inputs.mapIterateNodes,
    )

    const validationCompiler = new StepValidationCompiler(this.dependencies)
    const entryValidationPlan = validationCompiler.compileEntryValidationPlan(
      inputs.stepNode.properties.validateOnEntry,
    )

    const renderCompiler = new StepRenderCompiler(this.dependencies)
    const renderPlan = renderCompiler.compileRenderPlan(inputs.stepNode, inputs.renderAncestors, inputs.allIterateNodes)

    return {
      runtimePlan: inputs.runtimePlan,
      navigationPlan,
      accessLifecyclePlan,
      submitLifecyclePlan,
      answerPreparationPlan,
      entryValidationPlan,
      renderPlan,
      validationPlan: validationPlans.get(inputs.stepNode.id),
    }
  }

  private compileValidationPlans(plan: CompilationPlan): Map<NodeId, ValidationPlan | undefined> {
    const validationPlans = new Map<NodeId, ValidationPlan | undefined>()

    plan.stepInputs.forEach((inputs, stepId) => {
      const compiler = new StepValidationCompiler(this.dependencies)

      validationPlans.set(
        stepId,
        compiler.compileValidationPlan(
          inputs.validatingFieldBlocks,
          inputs.stepNode.properties.validWhen,
          inputs.mapIterateNodes,
        ),
      )
    })

    return validationPlans
  }

  private wrapValidationPlansForReachability(
    reachabilityPlan: ReachabilityCompilationPlan,
    validationPlans: Map<NodeId, ValidationPlan | undefined>,
  ): Map<NodeId, CompiledValidationFunction> {
    const compiledValidations = new Map<NodeId, CompiledValidationFunction>()

    reachabilityPlan.entries
      .filter(entry => entry.hasValidation)
      .forEach(entry => {
        const validationPlan = validationPlans.get(entry.stepId)

        if (!validationPlan) {
          return
        }

        compiledValidations.set(entry.stepId, this.wrapValidationPlanAsFunction(validationPlan))
      })

    return compiledValidations
  }

  private wrapValidationPlanAsFunction(validationPlan: ValidationPlan): CompiledValidationFunction {
    return async (ctx, isSubmission, groups) => {
      const fieldResults = await Promise.all(
        validationPlan.fields.map(entry => entry.validate(ctx, isSubmission, groups)),
      )

      const iteratorGroupResults = await Promise.all(
        validationPlan.iteratorGroups.map(async group => {
          const items = await group.evaluateInput(ctx)
          const results = await Promise.all(
            items.flatMap(itemScope => group.fields.map(field => field.validate(ctx, isSubmission, groups, itemScope))),
          )

          return results.flat()
        }),
      )

      const fieldFailures = [...fieldResults.flat(), ...iteratorGroupResults.flat()]
      const domainFailures = validationPlan.domain ? await validationPlan.domain(ctx, isSubmission, groups) : []

      return {
        isValid: fieldFailures.length === 0 && domainFailures.length === 0,
        fieldFailures,
        domainFailures,
      }
    }
  }
}
