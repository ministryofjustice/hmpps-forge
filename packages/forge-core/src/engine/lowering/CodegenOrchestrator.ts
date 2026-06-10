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
import type { CompilationDependencies } from './compilationDependencies.type'
import type {
  CompilationPlan,
  ReachabilityCompilationPlan,
  StepCompilationInputs,
} from '../contracts/plans/compilationPlan.type'
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
   * and hook entries once (hoisted by NodeId), then assembles per-step and
   * per-journey plans by looking them up. Navigation is compiled before steps
   * because it attaches per-step validation functions onto the shared
   * NavigationRuntimePlan that compileStep reuses.
   */
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

  /**
   * Compiles each reachability plan's per-step navigation leaves — entry
   * predicate, forward outcomes, tie-breaker, field codes — onto the shared
   * NavigationRuntimePlan's entries, plus the journey-level resume predicate
   * and the per-step validation functions the graph walk needs. Mutates each
   * reachabilityPlan.navigationPlan in place.
   */
  private compileNavigation(
    plan: CompilationPlan,
    nodeRegistry: ASTNodeIndex,
    validationPlans: Map<NodeId, ValidationPlan | undefined>,
  ): void {
    const reachabilityCompiler = new ReachabilityCompiler(this.dependencies)
    const fieldInventoryCompiler = new StepFieldInventoryCompiler(this.dependencies)

    plan.reachabilityPlans.forEach(reachabilityPlan => {
      const navigationPlan = reachabilityPlan.navigationPlan
      const inventorySources = plan.fieldInventorySources.get(navigationPlan) ?? []

      navigationPlan.compiledStepValidations = this.wrapValidationPlansForReachability(
        reachabilityPlan,
        validationPlans,
      )
      navigationPlan.evaluateResume = reachabilityCompiler.compileResumePredicate(reachabilityPlan, nodeRegistry)

      reachabilityPlan.entries.forEach((compilationEntry, index) => {
        const entry = navigationPlan.entries[index]
        const inventorySource = inventorySources[index]

        entry.evaluateEntry = reachabilityCompiler.compileEntryPredicate(compilationEntry, nodeRegistry)
        entry.evaluateOutcomes = reachabilityCompiler.compileStepOutcomes(compilationEntry, nodeRegistry)
        entry.evaluateTieBreaker = reachabilityCompiler.compileTieBreaker(compilationEntry, nodeRegistry)
        entry.evaluateFieldCodes = inventorySource
          ? fieldInventoryCompiler.compileStepFieldCodes(inventorySource)
          : undefined
      })
    })
  }

  /**
   * Assembles a CompiledJourney per journey-root by looking up the hoisted
   * access-hook and answer-preparation entries. A journey root carries only
   * access and answer-preparation plans (it runs those phases then redirects).
   */
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

  /**
   * Assembles one CompiledStep: reuses the shared navigation plan, compiles the
   * step-specific entry-validation and render plans, and looks up the hoisted
   * access/submit/answer-prep/validation entries. Throws if no navigation plan is
   * registered for the step.
   */
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
   * given ancestors, in ancestor-then-declared order. Returns undefined when no
   * hooks apply so the runtime can skip the access-lifecycle phase entirely.
   */
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

  /**
   * Selects the hoisted submit-hook entries for the step's submit hooks, in
   * declared order. Returns undefined when the step has no submit hooks so the
   * runtime can skip the submit-lifecycle phase.
   */
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

  /**
   * Compiles a ValidationPlan per step from its validating fields, step-level
   * validWhen domain rule and MAP iterator nodes. The result is keyed by stepId
   * for reuse both as the step's validationPlan and by navigation reachability.
   */
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

  /**
   * Builds the per-step validation callbacks navigation needs to decide whether
   * an earlier step is still valid. Only steps flagged hasValidation with an
   * existing ValidationPlan are wrapped; the rest are omitted from the map.
   */
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

  /**
   * Wraps a ValidationPlan as a single async StepValidityResult function for
   * navigation to call. Field validations run in parallel; each iterator group
   * expands its input into per-item scopes and validates every field once per
   * item, flattening the results. The step is valid only when no field or domain
   * failures remain.
   */
  private wrapValidationPlanAsFunction(validationPlan: ValidationPlan): CompiledValidationFunction {
    return async (ctx, isSubmission, groups) => {
      const activeGroups = groups ?? []

      const fieldResults = await Promise.all(
        validationPlan.fields.map(entry => entry.validate(ctx, isSubmission, activeGroups)),
      )

      const iteratorGroupResults = await Promise.all(
        validationPlan.iteratorGroups.map(async group => {
          const items = await group.evaluateInput(ctx)
          const results = await Promise.all(
            items.flatMap(itemScope =>
              group.fields.map(field => field.validate(ctx, isSubmission, activeGroups, itemScope)),
            ),
          )

          return results.flat()
        }),
      )

      const fieldFailures = [...fieldResults.flat(), ...iteratorGroupResults.flat()]
      const domainFailures = validationPlan.domain ? await validationPlan.domain(ctx, isSubmission, activeGroups) : []

      return {
        isValid: fieldFailures.length === 0 && domainFailures.length === 0,
        fieldFailures,
        domainFailures,
      }
    }
  }
}
