import type { NodeId } from '../contracts/ast/engine.type'
import type { IterateASTNode, SubmitHookASTNode } from '../contracts/ast/expressions.type'
import type { JourneyASTNode, StepASTNode } from '../contracts/ast/structures.type'
import type { TemplateNodeId } from '../contracts/ast/ast.type'
import type {
  CompiledAccessHook,
  AccessLifecyclePlan,
  AnswerPreparationPlan,
  CompiledJourney,
  CompiledStep,
  CompiledFieldAnswerPreparation,
  CompiledNestedRenderBlock,
  AnswerPreparationPlanItem,
  FieldAnswerPreparationPlanItem,
  MaterialisationRootAnswerPreparationPlanItem,
  CompiledSubmitHook,
  SubmitLifecyclePlan,
  ValidationPlan,
} from '../contracts/plans/compilationArtefacts.type'
import type {
  CompiledTemplateMaterialisationRoot,
  CompiledTemplatePhaseFunctions,
  TemplateMaterialisationPlan,
} from '../contracts/plans/materialisationArtefacts.type'
import type { CompiledMaterialisedFieldAnswerPreparationFunction } from '../contracts/compiled/compiledFunctions.type'
import TemplateMaterialisationCompiler from './phase-compilers/materialisation/TemplateMaterialisationCompiler'
import type { CompilationDependencies } from './compilationDependencies.type'
import type {
  AnswerPreparationSource,
  CompilationPlan,
  FieldAnswerPreparationSource,
  MaterialisationRootAnswerPreparationSource,
  ReachabilityStepInputs,
  StepCompilationInputs,
} from '../contracts/plans/compilationPlan.type'
import type { CompiledNavigationStep, NavigationRuntimePlan } from '../contracts/plans/runtimePlans.type'
import type ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import StepValidationCompiler from './phase-compilers/validation/StepValidationCompiler'
import ReachabilityCompiler from './phase-compilers/navigation/ReachabilityCompiler'
import StepFieldInventoryCompiler from './phase-compilers/field-inventory/StepFieldInventoryCompiler'
import StepRenderCompiler from './phase-compilers/rendering/StepRenderCompiler'
import StepAnswerPreparationCompiler from './phase-compilers/answer-preparation/StepAnswerPreparationCompiler'
import HookLifecycleCompiler from './phase-compilers/hooks/HookLifecycleCompiler'

/**
 * Hoisted answer preparations keyed by NodeId: every field/block is compiled
 * once and shared across the steps and journeys that reference it.
 * Per-step/per-journey AnswerPreparationPlans are assembled by looking them up.
 */
interface HoistedAnswerPreparation {
  readonly fields: Map<NodeId, CompiledFieldAnswerPreparation>
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
    const { roots: hoistedMaterialisation, materialisedNestedBlocks } = this.compileHoistedMaterialisation(plan)
    const materialisationPlans = this.compileMaterialisationPlans(plan, hoistedMaterialisation)
    const navigationPlans = this.compileNavigationPlans(plan, nodeRegistry, validationPlans, materialisationPlans)

    const journeys = this.compileJourneys(
      plan,
      navigationPlans,
      hoistedAnswerPrep,
      hoistedHooks,
      hoistedMaterialisation,
    )

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
          hoistedMaterialisation,
          materialisedNestedBlocks,
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
    materialisationPlans: Map<NodeId, TemplateMaterialisationPlan>,
  ): Map<NodeId, NavigationRuntimePlan> {
    const reachabilityCompiler = new ReachabilityCompiler(this.dependencies)
    const fieldInventoryCompiler = new StepFieldInventoryCompiler(this.dependencies)
    const navigationPlans = new Map<NodeId, NavigationRuntimePlan>()

    plan.reachabilityPlans.forEach((reachabilityPlan, planId) => {
      navigationPlans.set(planId, {
        navigationSteps: reachabilityPlan.reachabilityStepInputs.map(stepInputs =>
          this.compileNavigationStep(
            stepInputs,
            reachabilityPlan.journeyNodeId,
            nodeRegistry,
            validationPlans,
            materialisationPlans,
            reachabilityCompiler,
            fieldInventoryCompiler,
          ),
        ),
        resumeConfigured: reachabilityPlan.resumeConfigured,
        resumeAlways: reachabilityPlan.resumeAlways,
        evaluateResumeWhen: reachabilityCompiler.compileResumePredicate(reachabilityPlan, nodeRegistry),
        unreachableRedirect: reachabilityPlan.unreachableRedirect,
        reachabilityDisabled: reachabilityPlan.reachabilityDisabled,
      })
    })

    return navigationPlans
  }

  /**
   * Assembles one CompiledNavigationStep: static reachability data, the step's
   * validation plan, and the compiled leaves from the reachability and
   * field-inventory compilers. The single place the record is born.
   */
  private compileNavigationStep(
    stepInputs: ReachabilityStepInputs,
    journeyNodeId: NodeId,
    nodeRegistry: ASTNodeIndex,
    validationPlans: Map<NodeId, ValidationPlan>,
    materialisationPlans: Map<NodeId, TemplateMaterialisationPlan>,
    reachabilityCompiler: ReachabilityCompiler,
    fieldInventoryCompiler: StepFieldInventoryCompiler,
  ): CompiledNavigationStep {
    return {
      nodeId: stepInputs.nodeId,
      code: stepInputs.code,
      isEntryPoint: stepInputs.isEntryPoint,
      validationPlan: this.selectStepValidationPlan(journeyNodeId, stepInputs.nodeId, validationPlans),
      materialisationPlan: materialisationPlans.get(stepInputs.nodeId) ?? { roots: [] },
      cleardownFieldCodes: stepInputs.cleardownFieldCodes,
      declaredOutcomes: stepInputs.declaredOutcomes,
      evaluateEntryWhen: reachabilityCompiler.compileEntryPredicate(stepInputs, nodeRegistry),
      evaluateOutcomes: reachabilityCompiler.compileStepOutcomes(stepInputs, nodeRegistry),
      evaluateTieBreaker: reachabilityCompiler.compileTieBreaker(stepInputs, nodeRegistry),
      evaluateFieldCodes: fieldInventoryCompiler.compileStepFieldCodes(stepInputs.fieldInventorySource),
    }
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
    hoistedMaterialisation: Map<NodeId, CompiledTemplateMaterialisationRoot>,
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
          inputs.answerPreparationSources,
          hoistedAnswerPrep,
          hoistedMaterialisation,
        ),
        materialisationPlan: this.assembleMaterialisationPlan(
          inputs.stepMaterialisationRootNodes,
          hoistedMaterialisation,
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
    hoistedMaterialisation: Map<NodeId, CompiledTemplateMaterialisationRoot>,
    materialisedNestedBlocks: ReadonlyMap<string, CompiledNestedRenderBlock>,
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
    const renderPlan = renderCompiler.compileRenderPlan(
      inputs.stepNode,
      inputs.renderAncestors,
      materialisedNestedBlocks,
    )

    return {
      runtimePlan: inputs.runtimePlan,
      navigationPlan,
      accessLifecyclePlan: this.assembleAccessLifecyclePlan(inputs.accessAncestors, hoistedHooks.accessHooks),
      submitLifecyclePlan: this.assembleSubmitLifecyclePlan(inputs.submitHooks, hoistedHooks.submitHooks),
      answerPreparationPlan: this.assembleAnswerPreparationPlan(
        inputs.answerPreparationSources,
        hoistedAnswerPrep,
        hoistedMaterialisation,
      ),
      entryValidationPlan,
      renderPlan,
      validationPlan,
      materialisationPlan: this.assembleMaterialisationPlan(inputs.materialisationRootNodes, hoistedMaterialisation),
    }
  }

  /**
   * Compiles each distinct field/block across all steps exactly once,
   * deduplicating by NodeId so fields shared across steps are not recompiled.
   */
  private compileHoistedAnswerPreparation(plan: CompilationPlan): HoistedAnswerPreparation {
    const compiler = new StepAnswerPreparationCompiler(this.dependencies)
    const fields = new Map<NodeId, CompiledFieldAnswerPreparation>()

    plan.stepInputs.forEach(inputs => {
      inputs.fieldBlocks.forEach(block => {
        if (!fields.has(block.id)) {
          fields.set(block.id, compiler.compileFieldPreparation(block))
        }
      })
    })

    return { fields }
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

  private assembleAnswerPreparationPlan(
    sources: readonly AnswerPreparationSource[],
    hoisted: HoistedAnswerPreparation,
    hoistedMaterialisation: Map<NodeId, CompiledTemplateMaterialisationRoot>,
  ): AnswerPreparationPlan {
    const items = sources
      .map(source => this.resolveAnswerPreparationPlanItem(source, hoisted, hoistedMaterialisation))
      .filter((item): item is AnswerPreparationPlanItem => item !== undefined)

    return { items }
  }

  private resolveAnswerPreparationPlanItem(
    source: AnswerPreparationSource,
    hoisted: HoistedAnswerPreparation,
    hoistedMaterialisation: Map<NodeId, CompiledTemplateMaterialisationRoot>,
  ): AnswerPreparationPlanItem | undefined {
    switch (source.kind) {
      case 'field':
        return this.resolveFieldAnswerPreparationPlanItem(source, hoisted)

      case 'materialisation-root':
        return this.resolveMaterialisationRootAnswerPreparationPlanItem(source, hoistedMaterialisation)

      default: {
        const exhaustiveSource: never = source

        return exhaustiveSource
      }
    }
  }

  private resolveFieldAnswerPreparationPlanItem(
    source: FieldAnswerPreparationSource,
    hoisted: HoistedAnswerPreparation,
  ): FieldAnswerPreparationPlanItem | undefined {
    const entry = hoisted.fields.get(source.node.id)

    if (entry === undefined) {
      return undefined
    }

    return { kind: 'field', entry }
  }

  private resolveMaterialisationRootAnswerPreparationPlanItem(
    source: MaterialisationRootAnswerPreparationSource,
    hoistedMaterialisation: Map<NodeId, CompiledTemplateMaterialisationRoot>,
  ): MaterialisationRootAnswerPreparationPlanItem | undefined {
    const root = hoistedMaterialisation.get(source.node.id)

    if (root === undefined) {
      return undefined
    }

    return { kind: 'materialisation-root', root }
  }

  private compileHoistedMaterialisation(plan: CompilationPlan): {
    roots: Map<NodeId, CompiledTemplateMaterialisationRoot>
    materialisedNestedBlocks: ReadonlyMap<string, CompiledNestedRenderBlock>
  } {
    const materialisationCompiler = new TemplateMaterialisationCompiler(this.dependencies)
    const { functions: templateFunctions, materialisedNestedBlocks } = this.compileHoistedTemplateFunctions(plan)
    const roots = new Map<NodeId, CompiledTemplateMaterialisationRoot>()

    plan.stepInputs.forEach(inputs => {
      inputs.materialisationRootNodes.forEach(iterateNode => {
        if (!roots.has(iterateNode.id)) {
          const intermediate = materialisationCompiler.compileMaterialisationRoot(iterateNode)

          if (intermediate !== undefined) {
            roots.set(iterateNode.id, {
              nodeId: intermediate.nodeId,
              materialise: intermediate.materialise,
              templateFunctions,
            })
          }
        }
      })
    })

    return { roots, materialisedNestedBlocks }
  }

  /**
   * Compiles materialised phase functions (render, validate, prepare) for all
   * MAP iterate nodes across all steps, deduplicating by iterate node id.
   * Returns a map keyed by TemplateNodeId containing functions from all three
   * phase compilers merged together, plus nested blocks from materialised render
   * compilation that must be merged into each step's render plan.
   */
  private compileHoistedTemplateFunctions(plan: CompilationPlan): {
    functions: Map<TemplateNodeId, CompiledTemplatePhaseFunctions>
    materialisedNestedBlocks: ReadonlyMap<string, CompiledNestedRenderBlock>
  } {
    const renderCompiler = new StepRenderCompiler(this.dependencies)
    const validationCompiler = new StepValidationCompiler(this.dependencies)
    const answerPrepCompiler = new StepAnswerPreparationCompiler(this.dependencies)

    const allIterateNodes: IterateASTNode[] = []
    const visitedIterateNodeIds = new Set<NodeId>()

    plan.stepInputs.forEach(inputs => {
      inputs.mapIterateNodes.forEach(iterateNode => {
        if (!visitedIterateNodeIds.has(iterateNode.id)) {
          visitedIterateNodeIds.add(iterateNode.id)
          allIterateNodes.push(iterateNode)
        }
      })
    })

    const { entries: renderFunctions, nestedBlocks: materialisedNestedBlocks } =
      renderCompiler.compileMaterialisedRenderFunctions(allIterateNodes)
    const validationFunctions = validationCompiler.compileMaterialisedValidationFunctions(allIterateNodes)

    const prepareFunctions = new Map<
      TemplateNodeId,
      { nodeId: TemplateNodeId; prepare: CompiledMaterialisedFieldAnswerPreparationFunction }
    >()

    for (const iterateNode of allIterateNodes) {
      const materialised = answerPrepCompiler.compileMaterialisedPreparations(iterateNode)

      materialised.forEach((entry, nodeId) => {
        if (!prepareFunctions.has(nodeId)) {
          prepareFunctions.set(nodeId, entry)
        }
      })
    }

    const merged = new Map<TemplateNodeId, CompiledTemplatePhaseFunctions>()
    const allNodeIds = new Set<TemplateNodeId>([
      ...renderFunctions.keys(),
      ...validationFunctions.keys(),
      ...prepareFunctions.keys(),
    ])

    allNodeIds.forEach(nodeId => {
      const renderEntry = renderFunctions.get(nodeId)
      const validationEntry = validationFunctions.get(nodeId)
      const prepareEntry = prepareFunctions.get(nodeId)

      merged.set(nodeId, {
        render: renderEntry?.render,
        renderVariant: renderEntry?.variant,
        validate: validationEntry?.validate,
        prepare: prepareEntry?.prepare,
      })
    })

    return { functions: merged, materialisedNestedBlocks }
  }

  private compileMaterialisationPlans(
    plan: CompilationPlan,
    hoistedMaterialisation: Map<NodeId, CompiledTemplateMaterialisationRoot>,
  ): Map<NodeId, TemplateMaterialisationPlan> {
    const materialisationPlans = new Map<NodeId, TemplateMaterialisationPlan>()

    plan.stepInputs.forEach((inputs, stepNodeId) => {
      materialisationPlans.set(
        stepNodeId,
        this.assembleMaterialisationPlan(inputs.materialisationRootNodes, hoistedMaterialisation),
      )
    })

    return materialisationPlans
  }

  private assembleMaterialisationPlan(
    materialisationRootNodes: readonly IterateASTNode[],
    hoisted: Map<NodeId, CompiledTemplateMaterialisationRoot>,
  ): TemplateMaterialisationPlan {
    const roots = materialisationRootNodes
      .map(node => hoisted.get(node.id))
      .filter((root): root is CompiledTemplateMaterialisationRoot => root !== undefined)

    return { roots }
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
        compiler.compileValidationPlan(inputs.validatingFieldBlocks, inputs.stepNode.properties.validWhen),
      )
    })

    return validationPlans
  }

  /**
   * Picks the ValidationPlan navigation evaluates to decide whether a step is
   * still valid. Every step compiles one (empty when it declares no validation);
   * a navigation step without a compiled ValidationPlan is a compile invariant
   * failure.
   */
  private selectStepValidationPlan(
    journeyNodeId: NodeId,
    stepNodeId: NodeId,
    validationPlans: Map<NodeId, ValidationPlan>,
  ): ValidationPlan {
    const validationPlan = validationPlans.get(stepNodeId)

    if (!validationPlan) {
      throw new Error(
        `Unable to compile navigation plan "${journeyNodeId}" - validation plan not found for step "${stepNodeId}"`,
      )
    }

    return validationPlan
  }
}
