import type { NodeId } from '../contracts/ast/engine.type'
import type { IterateASTNode, SubmitHookASTNode } from '../contracts/ast/expressions.type'
import type { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../contracts/ast/structures.type'
import type { CompiledValidationFunction } from '../contracts/compiled/compiledFunctions.type'
import type {
  AccessHookEntry,
  AccessLifecyclePlan,
  AnswerPreparationPlan,
  CompiledJourney,
  CompiledStep,
  FieldAnswerPreparationEntry,
  IteratorAnswerPreparationGroup,
  SubmitHookEntry,
  SubmitLifecyclePlan,
  ValidationPlan,
} from '../contracts/plans/compilationArtefacts.type'
import type { ReachabilityCompilationPlan } from '../contracts/plans/runtimePlans.type'
import type { CompilationDependencies } from './compilationDependencies.type'
import type { CompilationPlan, StepCompilationInputs } from '../contracts/plans/compilationPlan.type'
import type ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import StepValidationCompiler from './phase-compilers/validation/StepValidationCompiler'
import ReachabilityCompiler from './phase-compilers/navigation/ReachabilityCompiler'
import StepRenderCompiler from './phase-compilers/rendering/StepRenderCompiler'
import StepAnswerPreparationCompiler from './phase-compilers/answer-preparation/StepAnswerPreparationCompiler'
import HookLifecycleCompiler from './phase-compilers/hooks/HookLifecycleCompiler'

interface AnswerPreparationEntries {
  readonly fieldEntries: Map<NodeId, FieldAnswerPreparationEntry>
  readonly iteratorGroups: Map<NodeId, IteratorAnswerPreparationGroup>
}

interface HookEntries {
  readonly accessHookEntries: Map<NodeId, AccessHookEntry>
  readonly submitHookEntries: Map<NodeId, SubmitHookEntry>
}

export default class CodegenOrchestrator {
  constructor(private readonly dependencies: CompilationDependencies) {}

  compileAll(
    plan: CompilationPlan,
    nodeRegistry: ASTNodeIndex,
  ): { steps: Map<NodeId, CompiledStep>; journeys: Map<NodeId, CompiledJourney> } {
    const validationPlans = this.compileValidationPlans(plan)
    const answerPrepEntries = this.compileAnswerPreparationEntries(plan)
    const hookEntries = this.compileHookEntries(plan)

    this.compileNavigation(plan, nodeRegistry, validationPlans)
    const journeys = this.compileJourneys(plan, answerPrepEntries, hookEntries)

    const steps = new Map<NodeId, CompiledStep>()

    plan.stepInputs.forEach((inputs, stepId) => {
      steps.set(stepId, this.compileStep(inputs, plan, validationPlans, answerPrepEntries, hookEntries))
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

  private compileJourneys(
    plan: CompilationPlan,
    answerPrepEntries: AnswerPreparationEntries,
    hookEntries: HookEntries,
  ): Map<NodeId, CompiledJourney> {
    const compiledJourneys = new Map<NodeId, CompiledJourney>()

    plan.journeyInputs.forEach((inputs, journeyId) => {
      compiledJourneys.set(journeyId, {
        runtimePlan: inputs.runtimePlan,
        navigationPlan: inputs.navigationPlan,
        accessLifecyclePlan: this.assembleAccessLifecyclePlan(inputs.accessAncestors, hookEntries.accessHookEntries),
        answerPreparationPlan: this.assembleAnswerPreparationPlan(
          inputs.stepFieldBlocks,
          inputs.stepMapIterateNodes,
          answerPrepEntries,
        ),
      })
    })

    return compiledJourneys
  }

  private compileStep(
    inputs: StepCompilationInputs,
    plan: CompilationPlan,
    validationPlans: Map<NodeId, ValidationPlan | undefined>,
    answerPrepEntries: AnswerPreparationEntries,
    hookEntries: HookEntries,
  ): CompiledStep {
    const navigationPlan = plan.navigationPlansByStepId.get(inputs.stepNode.id)

    if (!navigationPlan) {
      throw new Error(`Unable to compile step "${inputs.stepNode.id}" - navigation plan not found`)
    }

    const validationCompiler = new StepValidationCompiler(this.dependencies)
    const entryValidationPlan = validationCompiler.compileEntryValidationPlan(
      inputs.stepNode.properties.validateOnEntry,
    )

    const renderCompiler = new StepRenderCompiler(this.dependencies)
    const renderPlan = renderCompiler.compileRenderPlan(inputs.stepNode, inputs.renderAncestors, inputs.allIterateNodes)

    return {
      runtimePlan: inputs.runtimePlan,
      navigationPlan,
      accessLifecyclePlan: this.assembleAccessLifecyclePlan(inputs.accessAncestors, hookEntries.accessHookEntries),
      submitLifecyclePlan: this.assembleSubmitLifecyclePlan(inputs.submitHooks, hookEntries.submitHookEntries),
      answerPreparationPlan: this.assembleAnswerPreparationPlan(
        inputs.fieldBlocks,
        inputs.mapIterateNodes,
        answerPrepEntries,
      ),
      entryValidationPlan,
      renderPlan,
      validationPlan: validationPlans.get(inputs.stepNode.id),
    }
  }

  private compileAnswerPreparationEntries(plan: CompilationPlan): AnswerPreparationEntries {
    const compiler = new StepAnswerPreparationCompiler(this.dependencies)
    const fieldEntries = new Map<NodeId, FieldAnswerPreparationEntry>()
    const iteratorGroups = new Map<NodeId, IteratorAnswerPreparationGroup>()
    const visitedIterateNodes = new Set<NodeId>()

    plan.stepInputs.forEach(inputs => {
      inputs.fieldBlocks.forEach(block => {
        if (!fieldEntries.has(block.id)) {
          fieldEntries.set(block.id, {
            nodeId: block.id,
            prepare: compiler.compileSingleFieldPreparation(block),
          })
        }
      })

      inputs.mapIterateNodes.forEach(iterateNode => {
        if (!visitedIterateNodes.has(iterateNode.id)) {
          visitedIterateNodes.add(iterateNode.id)
          const group = compiler.compileIteratorGroup(iterateNode)

          if (group !== undefined) {
            iteratorGroups.set(iterateNode.id, group)
          }
        }
      })
    })

    return { fieldEntries, iteratorGroups }
  }

  private compileHookEntries(plan: CompilationPlan): HookEntries {
    const compiler = new HookLifecycleCompiler(this.dependencies)
    const accessHookEntries = new Map<NodeId, AccessHookEntry>()
    const submitHookEntries = new Map<NodeId, SubmitHookEntry>()

    plan.stepInputs.forEach(inputs => {
      inputs.accessAncestors.forEach(ancestor => {
        ;(ancestor.properties.onAccess ?? []).forEach(hook => {
          if (!accessHookEntries.has(hook.id)) {
            accessHookEntries.set(hook.id, {
              nodeId: hook.id,
              evaluate: compiler.compileSingleAccessHook(hook),
            })
          }
        })
      })

      inputs.submitHooks.forEach(hook => {
        if (!submitHookEntries.has(hook.id)) {
          submitHookEntries.set(hook.id, {
            nodeId: hook.id,
            evaluate: compiler.compileSingleSubmitHook(hook),
          })
        }
      })
    })

    plan.journeyInputs.forEach(inputs => {
      inputs.accessAncestors.forEach(ancestor => {
        ;(ancestor.properties.onAccess ?? []).forEach(hook => {
          if (!accessHookEntries.has(hook.id)) {
            accessHookEntries.set(hook.id, {
              nodeId: hook.id,
              evaluate: compiler.compileSingleAccessHook(hook),
            })
          }
        })
      })
    })

    return { accessHookEntries, submitHookEntries }
  }

  private assembleAnswerPreparationPlan(
    fieldBlocks: readonly FieldBlockASTNode[],
    mapIterateNodes: readonly IterateASTNode[],
    entries: AnswerPreparationEntries,
  ): AnswerPreparationPlan {
    const fields = fieldBlocks
      .map(block => entries.fieldEntries.get(block.id))
      .filter((entry): entry is FieldAnswerPreparationEntry => entry !== undefined)

    const groups = mapIterateNodes
      .map(node => entries.iteratorGroups.get(node.id))
      .filter((group): group is IteratorAnswerPreparationGroup => group !== undefined)

    return { fields, iteratorGroups: groups }
  }

  private assembleAccessLifecyclePlan(
    accessAncestors: readonly (JourneyASTNode | StepASTNode)[],
    entries: Map<NodeId, AccessHookEntry>,
  ): AccessLifecyclePlan | undefined {
    const hooks: AccessHookEntry[] = []

    accessAncestors.forEach(ancestor => {
      ;(ancestor.properties.onAccess ?? []).forEach(hook => {
        const entry = entries.get(hook.id)

        if (entry !== undefined) {
          hooks.push(entry)
        }
      })
    })

    if (hooks.length === 0) {
      return undefined
    }

    return { hooks }
  }

  private assembleSubmitLifecyclePlan(
    submitHooks: readonly SubmitHookASTNode[],
    entries: Map<NodeId, SubmitHookEntry>,
  ): SubmitLifecyclePlan | undefined {
    const hooks = submitHooks
      .map(hook => entries.get(hook.id))
      .filter((entry): entry is SubmitHookEntry => entry !== undefined)

    if (hooks.length === 0) {
      return undefined
    }

    return { hooks }
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
