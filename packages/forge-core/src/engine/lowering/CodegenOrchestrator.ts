import type { NodeId } from '../contracts/ast/engine.type'
import type { IterateASTNode, SubmitHookASTNode } from '../contracts/ast/expressions.type'
import type { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../contracts/ast/structures.type'
import type {
  CompiledAccessHook,
  AccessLifecyclePlan,
  AnswerPreparationPlan,
  CompiledJourney,
  CompiledStep,
  CompiledFieldAnswerPreparation,
  IteratorAnswerPreparationGroup,
  CompiledSubmitHook,
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
 * Hoisted answer preparations keyed by NodeId: every field/block and MAP
 * iterator group is compiled once and shared across the steps and journeys that
 * reference it. Per-step/per-journey AnswerPreparationPlans are assembled by
 * looking them up.
 */
interface HoistedAnswerPreparation {
  readonly fields: Map<NodeId, CompiledFieldAnswerPreparation>
  readonly iteratorGroups: Map<NodeId, IteratorAnswerPreparationGroup>
}

/**
 * Hoisted hooks keyed by NodeId. Access hooks may be shared by every step
 * under a journey-level onAccess; submit hooks belong to individual steps. Each
 * hook is compiled once and looked up when assembling lifecycle plans.
 */
interface HoistedHooks {
  readonly accessHooks: Map<NodeId, CompiledAccessHook>
  readonly submitHooks: Map<NodeId, CompiledSubmitHook>
}

export default class CodegenOrchestrator {
  constructor(private readonly dependencies: CompilationDependencies) {}

  /**
   * Entry point driving every phase compiler. Compiles validation, answer-prep
   * and hooks once (hoisted by NodeId), then assembles immutable
   * navigation plans and per-step/per-journey plans by looking them up.
   */
  compileAll(
    plan: CompilationPlan,
    nodeRegistry: ASTNodeIndex,
  ): { steps: Map<NodeId, CompiledStep>; journeys: Map<NodeId, CompiledJourney> } {
    const validationCompiler = new StepValidationCompiler(this.dependencies)
    const validationPlans = this.compileValidationPlans(plan, validationCompiler)
    const hoistedAnswerPrep = this.compileHoistedAnswerPreparation(plan)
    const hoistedHooks = this.compileHoistedHooks(plan)
    const navigationPlans = this.compileNavigationPlans(plan, nodeRegistry, validationPlans)

    const journeys = this.compileJourneys(plan, navigationPlans, hoistedAnswerPrep, hoistedHooks)

    const steps = new Map<NodeId, CompiledStep>()

    plan.stepInputs.forEach((inputs, stepNodeId) => {
      steps.set(
        stepNodeId,
        this.compileStep(
          inputs,
          plan,
          navigationPlans,
          validationPlans,
          validationCompiler,
          hoistedAnswerPrep,
          hoistedHooks,
        ),
      )
    })

    return { steps, journeys }
  }

  /**
   * Builds each immutable NavigationRuntimePlan from pure reachability inputs:
   * static step data, compiled navigation leaves, field inventory leaves,
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
        navigationSteps: reachabilityPlan.reachabilityStepInputs.map(stepInputs => ({
          ...reachabilityCompiler.compileNavigationStep(stepInputs, nodeRegistry),
          evaluateFieldCodes: fieldInventoryCompiler.compileStepFieldCodes(stepInputs.fieldInventorySource),
        })),
        resumeConfigured: reachabilityPlan.resumeConfigured,
        resumeAlways: reachabilityPlan.resumeAlways,
        evaluateResumeWhen: reachabilityCompiler.compileResumePredicate(reachabilityPlan, nodeRegistry),
        unreachableRedirect: reachabilityPlan.unreachableRedirect,
        reachabilityDisabled: reachabilityPlan.reachabilityDisabled,
        stepValidationPlans: this.selectStepValidationPlans(reachabilityPlan, validationPlans),
      })
    })

    return navigationPlans
  }

  /**
   * Assembles a CompiledJourney per journey-root by looking up the hoisted
   * access hooks and answer preparations. A journey root carries only
   * access and answer-preparation plans (it runs those phases then redirects).
   */
  private compileJourneys(
    plan: CompilationPlan,
    navigationPlans: Map<NodeId, NavigationRuntimePlan>,
    hoistedAnswerPrep: HoistedAnswerPreparation,
    hoistedHooks: HoistedHooks,
  ): Map<NodeId, CompiledJourney> {
    const compiledJourneys = new Map<NodeId, CompiledJourney>()

    plan.journeyInputs.forEach((inputs, journeyNodeId) => {
      const navigationPlan = navigationPlans.get(inputs.reachabilityPlanId)

      if (!navigationPlan) {
        throw new Error(`Unable to compile journey "${journeyNodeId}" - navigation plan not found`)
      }

      compiledJourneys.set(journeyNodeId, {
        runtimePlan: inputs.runtimePlan,
        navigationPlan,
        accessLifecyclePlan: this.assembleAccessLifecyclePlan(inputs.accessAncestors, hoistedHooks.accessHooks),
        answerPreparationPlan: this.assembleAnswerPreparationPlan(
          inputs.stepFieldBlocks,
          inputs.stepMapIterateNodes,
          hoistedAnswerPrep,
        ),
      })
    })

    return compiledJourneys
  }

  /**
   * Assembles one CompiledStep: reuses the shared navigation plan, compiles the
   * step-specific entry-validation and render plans, and looks up the hoisted
   * access/submit/answer-prep/validation artefacts. Throws if no navigation plan is
   * registered for the step.
   */
  private compileStep(
    inputs: StepCompilationInputs,
    plan: CompilationPlan,
    navigationPlans: Map<NodeId, NavigationRuntimePlan>,
    validationPlans: Map<NodeId, ValidationPlan>,
    validationCompiler: StepValidationCompiler,
    hoistedAnswerPrep: HoistedAnswerPreparation,
    hoistedHooks: HoistedHooks,
  ): CompiledStep {
    const navigationPlanId = plan.navigationPlanNodeIdByStepNodeId.get(inputs.stepNode.id)

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
      accessLifecyclePlan: this.assembleAccessLifecyclePlan(inputs.accessAncestors, hoistedHooks.accessHooks),
      submitLifecyclePlan: this.assembleSubmitLifecyclePlan(inputs.submitHooks, hoistedHooks.submitHooks),
      answerPreparationPlan: this.assembleAnswerPreparationPlan(
        inputs.fieldBlocks,
        inputs.mapIterateNodes,
        hoistedAnswerPrep,
      ),
      entryValidationPlan,
      renderPlan,
      validationPlan,
    }
  }

  /**
   * Compiles each distinct field/block and MAP iterator group across all steps
   * exactly once, deduplicating by NodeId so fields shared across steps are not
   * recompiled. An iterator group whose compiler yields undefined is skipped.
   */
  private compileHoistedAnswerPreparation(plan: CompilationPlan): HoistedAnswerPreparation {
    const compiler = new StepAnswerPreparationCompiler(this.dependencies)
    const fields = new Map<NodeId, CompiledFieldAnswerPreparation>()
    const iteratorGroups = new Map<NodeId, IteratorAnswerPreparationGroup>()
    const visitedIterateNodes = new Set<NodeId>()

    plan.stepInputs.forEach(inputs => {
      inputs.fieldBlocks.forEach(block => {
        if (!fields.has(block.id)) {
          fields.set(block.id, compiler.compileFieldPreparation(block))
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

    return { fields, iteratorGroups }
  }

  /**
   * Compiles each distinct access and submit hook once, deduplicating by NodeId.
   * Access hooks are gathered from both step and journey access-ancestors so a
   * journey-level onAccess hook shared by every step is compiled a single time.
   */
  private compileHoistedHooks(plan: CompilationPlan): HoistedHooks {
    const compiler = new HookLifecycleCompiler(this.dependencies)
    const accessHooks = new Map<NodeId, CompiledAccessHook>()
    const submitHooks = new Map<NodeId, CompiledSubmitHook>()

    plan.stepInputs.forEach(inputs => {
      inputs.accessAncestors.forEach(ancestor => {
        ;(ancestor.properties.onAccess ?? []).forEach(hook => {
          if (!accessHooks.has(hook.id)) {
            accessHooks.set(hook.id, compiler.compileAccessHook(hook))
          }
        })
      })

      inputs.submitHooks.forEach(hook => {
        if (!submitHooks.has(hook.id)) {
          submitHooks.set(hook.id, compiler.compileSubmitHook(hook))
        }
      })
    })

    plan.journeyInputs.forEach(inputs => {
      inputs.accessAncestors.forEach(ancestor => {
        ;(ancestor.properties.onAccess ?? []).forEach(hook => {
          if (!accessHooks.has(hook.id)) {
            accessHooks.set(hook.id, compiler.compileAccessHook(hook))
          }
        })
      })
    })

    return { accessHooks, submitHooks }
  }

  /**
   * Selects the hoisted field preparations for the given fields and iterator nodes,
   * preserving their declared order. Iterator nodes that produced no hoisted group
   * (e.g. an iterator with no fields) are skipped, so the plan may hold fewer
   * iterator groups than the input nodes.
   */
  private assembleAnswerPreparationPlan(
    fieldBlocks: readonly FieldBlockASTNode[],
    mapIterateNodes: readonly IterateASTNode[],
    hoisted: HoistedAnswerPreparation,
  ): AnswerPreparationPlan {
    const fields = fieldBlocks
      .map(block => hoisted.fields.get(block.id))
      .filter((field): field is CompiledFieldAnswerPreparation => field !== undefined)

    const groups = mapIterateNodes
      .map(node => hoisted.iteratorGroups.get(node.id))
      .filter((group): group is IteratorAnswerPreparationGroup => group !== undefined)

    return { fieldAnswerPreparations: fields, iteratorAnswerPreparationGroups: groups }
  }

  /**
   * Collects the hoisted access hooks for every onAccess hook on the
   * given ancestors, in ancestor-then-declared order. No applicable hooks
   * yields an empty plan, which the access-lifecycle walk runs through as a
   * no-op.
   */
  private assembleAccessLifecyclePlan(
    accessAncestors: readonly (JourneyASTNode | StepASTNode)[],
    hoistedAccessHooks: Map<NodeId, CompiledAccessHook>,
  ): AccessLifecyclePlan {
    const accessHooks: CompiledAccessHook[] = []

    accessAncestors.forEach(ancestor => {
      ;(ancestor.properties.onAccess ?? []).forEach(hook => {
        const compiledHook = hoistedAccessHooks.get(hook.id)

        if (compiledHook !== undefined) {
          accessHooks.push(compiledHook)
        }
      })
    })

    return { accessHooks }
  }

  /**
   * Selects the hoisted submit hooks for the step's submit hooks, in
   * declared order. A step with no submit hooks gets an empty plan, which the
   * submit-lifecycle walk runs through as a no-op.
   */
  private assembleSubmitLifecyclePlan(
    submitHooks: readonly SubmitHookASTNode[],
    hoistedSubmitHooks: Map<NodeId, CompiledSubmitHook>,
  ): SubmitLifecyclePlan {
    const compiledHooks = submitHooks
      .map(hook => hoistedSubmitHooks.get(hook.id))
      .filter((compiledHook): compiledHook is CompiledSubmitHook => compiledHook !== undefined)

    return { submitHooks: compiledHooks }
  }

  /**
   * Compiles a ValidationPlan per step from its validating fields, step-level
   * validWhen domain rule and MAP iterator nodes. The result is keyed by stepNodeId
   * for reuse both as the step's validationPlan and by navigation reachability.
   */
  private compileValidationPlans(plan: CompilationPlan, compiler: StepValidationCompiler): Map<NodeId, ValidationPlan> {
    const validationPlans = new Map<NodeId, ValidationPlan>()

    plan.stepInputs.forEach((inputs, stepNodeId) => {
      validationPlans.set(
        stepNodeId,
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

    reachabilityPlan.reachabilityStepInputs
      .filter(step => step.hasValidation)
      .forEach(step => {
        const validationPlan = validationPlans.get(step.nodeId)

        if (!validationPlan) {
          throw new Error(
            `Unable to compile navigation plan "${reachabilityPlan.journeyNodeId}" - validation plan not found for step "${step.nodeId}"`,
          )
        }

        stepValidationPlans.set(step.nodeId, validationPlan)
      })

    return stepValidationPlans
  }
}
