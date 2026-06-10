import type { NodeId } from '../contracts/ast/engine.type'
import type { IterateASTNode, SubmitHookASTNode } from '../contracts/ast/expressions.type'
import type { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../contracts/ast/structures.type'
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
import type { CompilationDependencies } from './compilationDependencies.type'
import type {
  CompilationPlan,
  ReachabilityCompilationPlan,
  StepCompilationInputs,
} from '../contracts/plans/compilationPlan.type'
import type { NavigationRuntimePlan } from '../contracts/plans/runtimePlans.type'
import type ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import StepValidationCompiler from './phase-compilers/validation/StepValidationCompiler'
import ReachabilityCompiler from './phase-compilers/navigation/ReachabilityCompiler'
import StepFieldInventoryCompiler from './phase-compilers/field-inventory/StepFieldInventoryCompiler'
import StepRenderCompiler from './phase-compilers/rendering/StepRenderCompiler'
import StepAnswerPreparationCompiler from './phase-compilers/answer-preparation/StepAnswerPreparationCompiler'
import HookLifecycleCompiler from './phase-compilers/hooks/HookLifecycleCompiler'

/**
 * Hoisted answer-preparation entries keyed by NodeId: every field/block and MAP
 * iterator group is compiled once and shared across the steps and journeys that
 * reference it. Per-step/per-journey AnswerPreparationPlans are assembled by
 * looking up these entries.
 */
interface AnswerPreparationEntries {
  readonly fieldEntries: Map<NodeId, FieldAnswerPreparationEntry>
  readonly iteratorGroups: Map<NodeId, IteratorAnswerPreparationGroup>
}

/**
 * Hoisted hook entries keyed by NodeId. Access hooks may be shared by every step
 * under a journey-level onAccess; submit hooks belong to individual steps. Each
 * hook is compiled once and looked up when assembling lifecycle plans.
 */
interface HookEntries {
  readonly accessHookEntries: Map<NodeId, AccessHookEntry>
  readonly submitHookEntries: Map<NodeId, SubmitHookEntry>
}

export default class CodegenOrchestrator {
  constructor(private readonly dependencies: CompilationDependencies) {}

  /**
   * Entry point driving every phase compiler. Compiles validation, answer-prep
   * and hook entries once (hoisted by NodeId), then assembles immutable
   * navigation plans and per-step/per-journey plans by looking them up.
   */
  compileAll(
    plan: CompilationPlan,
    nodeRegistry: ASTNodeIndex,
  ): { steps: Map<NodeId, CompiledStep>; journeys: Map<NodeId, CompiledJourney> } {
    const validationCompiler = new StepValidationCompiler(this.dependencies)
    const validationPlans = this.compileValidationPlans(plan, validationCompiler)
    const answerPrepEntries = this.compileAnswerPreparationEntries(plan)
    const hookEntries = this.compileHookEntries(plan)
    const navigationPlans = this.compileNavigationPlans(plan, nodeRegistry, validationPlans)

    const journeys = this.compileJourneys(plan, navigationPlans, answerPrepEntries, hookEntries)

    const steps = new Map<NodeId, CompiledStep>()

    plan.stepInputs.forEach((inputs, stepId) => {
      steps.set(
        stepId,
        this.compileStep(
          inputs,
          plan,
          navigationPlans,
          validationPlans,
          validationCompiler,
          answerPrepEntries,
          hookEntries,
        ),
      )
    })

    return { steps, journeys }
  }

  /**
   * Builds each immutable NavigationRuntimePlan from pure reachability inputs:
   * static entry data, compiled navigation leaves, field inventory leaves,
   * resume configuration, and the validation plans needed by graph walking.
   */
  private compileNavigationPlans(
    plan: CompilationPlan,
    nodeRegistry: ASTNodeIndex,
    validationPlans: Map<NodeId, ValidationPlan>,
  ): Map<NodeId, NavigationRuntimePlan> {
    const reachabilityCompiler = new ReachabilityCompiler(this.dependencies)
    const fieldInventoryCompiler = new StepFieldInventoryCompiler(this.dependencies)
    const navigationPlans = new Map<NodeId, NavigationRuntimePlan>()

    plan.reachabilityPlans.forEach((reachabilityPlan, planId) => {
      navigationPlans.set(planId, {
        entries: reachabilityPlan.entries.map(entry => ({
          ...reachabilityCompiler.compileEntry(entry, nodeRegistry),
          evaluateFieldCodes: fieldInventoryCompiler.compileStepFieldCodes(entry.fieldInventorySource),
        })),
        resumeConfigured: reachabilityPlan.resumeConfigured,
        resumeAlways: reachabilityPlan.resumeAlways,
        evaluateResume: reachabilityCompiler.compileResumePredicate(reachabilityPlan, nodeRegistry),
        unreachableRedirect: reachabilityPlan.unreachableRedirect,
        reachabilityDisabled: reachabilityPlan.reachabilityDisabled,
        stepValidationPlans: this.selectStepValidationPlans(reachabilityPlan, validationPlans),
      })
    })

    return navigationPlans
  }

  /**
   * Assembles a CompiledJourney per journey-root by looking up the hoisted
   * access-hook and answer-preparation entries. A journey root carries only
   * access and answer-preparation plans (it runs those phases then redirects).
   */
  private compileJourneys(
    plan: CompilationPlan,
    navigationPlans: Map<NodeId, NavigationRuntimePlan>,
    answerPrepEntries: AnswerPreparationEntries,
    hookEntries: HookEntries,
  ): Map<NodeId, CompiledJourney> {
    const compiledJourneys = new Map<NodeId, CompiledJourney>()

    plan.journeyInputs.forEach((inputs, journeyId) => {
      const navigationPlan = navigationPlans.get(inputs.reachabilityPlanId)

      if (!navigationPlan) {
        throw new Error(`Unable to compile journey "${journeyId}" - navigation plan not found`)
      }

      compiledJourneys.set(journeyId, {
        runtimePlan: inputs.runtimePlan,
        navigationPlan,
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

  /**
   * Assembles one CompiledStep: reuses the shared navigation plan, compiles the
   * step-specific entry-validation and render plans, and looks up the hoisted
   * access/submit/answer-prep/validation entries. Throws if no navigation plan is
   * registered for the step.
   */
  private compileStep(
    inputs: StepCompilationInputs,
    plan: CompilationPlan,
    navigationPlans: Map<NodeId, NavigationRuntimePlan>,
    validationPlans: Map<NodeId, ValidationPlan>,
    validationCompiler: StepValidationCompiler,
    answerPrepEntries: AnswerPreparationEntries,
    hookEntries: HookEntries,
  ): CompiledStep {
    const navigationPlanId = plan.navigationPlanIdByStepId.get(inputs.stepNode.id)

    if (!navigationPlanId) {
      throw new Error(`Unable to compile step "${inputs.stepNode.id}" - navigation plan id not found`)
    }

    const navigationPlan = navigationPlans.get(navigationPlanId)

    if (!navigationPlan) {
      throw new Error(`Unable to compile step "${inputs.stepNode.id}" - navigation plan not found`)
    }

    const validationPlan = validationPlans.get(inputs.stepNode.id)

    if (!validationPlan) {
      throw new Error(`Unable to compile step "${inputs.stepNode.id}" - validation plan not found`)
    }

    const entryValidationPlan = validationCompiler.compileEntryValidationPlan(inputs.entryValidations)

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
      validationPlan,
    }
  }

  /**
   * Compiles each distinct field/block and MAP iterator group across all steps
   * exactly once, deduplicating by NodeId so entries shared across steps are not
   * recompiled. An iterator group whose compiler yields undefined is skipped.
   */
  private compileAnswerPreparationEntries(plan: CompilationPlan): AnswerPreparationEntries {
    const compiler = new StepAnswerPreparationCompiler(this.dependencies)
    const fieldEntries = new Map<NodeId, FieldAnswerPreparationEntry>()
    const iteratorGroups = new Map<NodeId, IteratorAnswerPreparationGroup>()
    const visitedIterateNodes = new Set<NodeId>()

    plan.stepInputs.forEach(inputs => {
      inputs.fieldBlocks.forEach(block => {
        if (!fieldEntries.has(block.id)) {
          fieldEntries.set(block.id, compiler.compileFieldPreparation(block))
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

  /**
   * Compiles each distinct access and submit hook once, deduplicating by NodeId.
   * Access hooks are gathered from both step and journey access-ancestors so a
   * journey-level onAccess hook shared by every step is compiled a single time.
   */
  private compileHookEntries(plan: CompilationPlan): HookEntries {
    const compiler = new HookLifecycleCompiler(this.dependencies)
    const accessHookEntries = new Map<NodeId, AccessHookEntry>()
    const submitHookEntries = new Map<NodeId, SubmitHookEntry>()

    plan.stepInputs.forEach(inputs => {
      inputs.accessAncestors.forEach(ancestor => {
        ;(ancestor.properties.onAccess ?? []).forEach(hook => {
          if (!accessHookEntries.has(hook.id)) {
            accessHookEntries.set(hook.id, compiler.compileAccessHook(hook))
          }
        })
      })

      inputs.submitHooks.forEach(hook => {
        if (!submitHookEntries.has(hook.id)) {
          submitHookEntries.set(hook.id, compiler.compileSubmitHook(hook))
        }
      })
    })

    plan.journeyInputs.forEach(inputs => {
      inputs.accessAncestors.forEach(ancestor => {
        ;(ancestor.properties.onAccess ?? []).forEach(hook => {
          if (!accessHookEntries.has(hook.id)) {
            accessHookEntries.set(hook.id, compiler.compileAccessHook(hook))
          }
        })
      })
    })

    return { accessHookEntries, submitHookEntries }
  }

  /**
   * Selects the hoisted prepare entries for the given fields and iterator nodes,
   * preserving their declared order. Iterator nodes that produced no hoisted group
   * (e.g. an iterator with no fields) are skipped, so the plan may hold fewer
   * iterator groups than the input nodes.
   */
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

  /**
   * Collects the hoisted access-hook entries for every onAccess hook on the
   * given ancestors, in ancestor-then-declared order. No applicable hooks
   * yields an empty plan, which the access-lifecycle walk runs through as a
   * no-op.
   */
  private assembleAccessLifecyclePlan(
    accessAncestors: readonly (JourneyASTNode | StepASTNode)[],
    entries: Map<NodeId, AccessHookEntry>,
  ): AccessLifecyclePlan {
    const hooks: AccessHookEntry[] = []

    accessAncestors.forEach(ancestor => {
      ;(ancestor.properties.onAccess ?? []).forEach(hook => {
        const entry = entries.get(hook.id)

        if (entry !== undefined) {
          hooks.push(entry)
        }
      })
    })

    return { hooks }
  }

  /**
   * Selects the hoisted submit-hook entries for the step's submit hooks, in
   * declared order. A step with no submit hooks gets an empty plan, which the
   * submit-lifecycle walk runs through as a no-op.
   */
  private assembleSubmitLifecyclePlan(
    submitHooks: readonly SubmitHookASTNode[],
    entries: Map<NodeId, SubmitHookEntry>,
  ): SubmitLifecyclePlan {
    const hooks = submitHooks
      .map(hook => entries.get(hook.id))
      .filter((entry): entry is SubmitHookEntry => entry !== undefined)

    return { hooks }
  }

  /**
   * Compiles a ValidationPlan per step from its validating fields, step-level
   * validWhen domain rule and MAP iterator nodes. The result is keyed by stepId
   * for reuse both as the step's validationPlan and by navigation reachability.
   */
  private compileValidationPlans(plan: CompilationPlan, compiler: StepValidationCompiler): Map<NodeId, ValidationPlan> {
    const validationPlans = new Map<NodeId, ValidationPlan>()

    plan.stepInputs.forEach((inputs, stepId) => {
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

  /**
   * Picks the per-step ValidationPlans navigation needs to decide whether an
   * earlier step is still valid. Only steps flagged hasValidation are included;
   * a flagged step without a compiled ValidationPlan is a compile invariant
   * failure.
   */
  private selectStepValidationPlans(
    reachabilityPlan: ReachabilityCompilationPlan,
    validationPlans: Map<NodeId, ValidationPlan>,
  ): Map<NodeId, ValidationPlan> {
    const stepValidationPlans = new Map<NodeId, ValidationPlan>()

    reachabilityPlan.entries
      .filter(entry => entry.hasValidation)
      .forEach(entry => {
        const validationPlan = validationPlans.get(entry.stepId)

        if (!validationPlan) {
          throw new Error(
            `Unable to compile navigation plan "${reachabilityPlan.journeyId}" - validation plan not found for step "${entry.stepId}"`,
          )
        }

        stepValidationPlans.set(entry.stepId, validationPlan)
      })

    return stepValidationPlans
  }
}
