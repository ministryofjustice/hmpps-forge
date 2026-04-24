import type { JourneyDefinition } from '../../authoring/types/structures.type'
import { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../types/structures.type'
import { ASTNodeType } from '../types/enums'
import { BlockType, ExpressionType, HookType, IteratorType } from '../../authoring/types/enums'
import { ActionHookASTNode, IterateASTNode, SubmitHookASTNode } from '../types/expressions.type'
import NodeRegistrationWalker from './traversers/NodeRegistrationWalker'
import { AstNodeId, JourneyInstanceDependencies, NodeId } from '../types/engine.type'
import { CompilationDependencies } from './CompilationDependencies'
import { NodeIDCategory } from './id-generators/NodeIDGenerator'
import RuntimePlanBuilder, { JourneyRuntimePlan, StepRuntimePlan, ReachabilityRuntimePlan } from './RuntimePlanBuilder'
import StepValidationCompiler, { CompiledValidationFunction } from './validation/StepValidationCompiler'
import EntryValidationCompiler, { CompiledEntryValidationFunction } from './validation/EntryValidationCompiler'
import ReachabilityCompiler from './reachability/ReachabilityCompiler'
import StepRenderCompiler, { CompiledRenderFunction } from './rendering/StepRenderCompiler'
import StepAnswerPreparationCompiler, {
  CompiledAnswerPreparationFunction,
} from './answer-preparation/StepAnswerPreparationCompiler'
import HookLifecycleCompiler from './hooks/HookLifecycleCompiler'
import StepFieldInventoryCompiler, { FieldInventoryStepSource } from './field-inventory/StepFieldInventoryCompiler'

export type StepIndex = Map<NodeId, StepASTNode>

export type JourneyIndex = Map<NodeId, JourneyASTNode>

export interface SharedCompiledForm {
  rootNode: JourneyASTNode
  sharedDependencies: CompilationDependencies
  stepIndex: StepIndex
  journeyIndex: JourneyIndex
  reachabilityPlans: Map<NodeId, ReachabilityRuntimePlan>
  journeyRuntimePlans: Map<NodeId, JourneyRuntimePlan>
  planBuilder: RuntimePlanBuilder
}

export interface CompiledStep {
  artefact: CompilationDependencies
  currentStepId: AstNodeId
  runtimePlan: StepRuntimePlan
  reachabilityPlan: ReachabilityRuntimePlan
  compiledValidation?: CompiledValidationFunction
  compiledEntryValidation?: CompiledEntryValidationFunction
  compiledRender?: CompiledRenderFunction
  compiledAnswerPreparation: CompiledAnswerPreparationFunction | undefined
}

/**
 * Compiles a journey definition into the shared AST, runtime plans, and generated
 * functions used by request handling.
 *
 * Compilation is split into shared work and lazy per-route work. The shared pass
 * builds the immutable AST/indices and the journey-level reachability plans.
 * Step and journey route handlers then attach the generated functions they need
 * to those plans. No request-time AST expansion or overlay registries are used.
 */
export default class CompilationFactory {
  constructor(private readonly journeyInstanceDependencies: JourneyInstanceDependencies) {}

  /**
   * Build the immutable compilation artefact that every route shares.
   */
  compileShared(journeyDef: JourneyDefinition): SharedCompiledForm {
    const sharedDependencies = new CompilationDependencies()

    // The NodeFactory preserves the authoring structure while assigning AST node
    // shapes. NodeRegistrationWalker then fills in missing IDs, resolves @self
    // references, registers nodes, and records parent/child edges in ASTNodeTree.
    const rootNode = sharedDependencies.nodeFactory.createNode(journeyDef) as JourneyASTNode

    const walker = new NodeRegistrationWalker(
      sharedDependencies.nodeIdGenerator,
      NodeIDCategory.COMPILE_AST,
      sharedDependencies.nodeRegistry,
      sharedDependencies.astNodeTree,
    )

    walker.register(rootNode)

    const stepNodes = sharedDependencies.nodeRegistry.findByType<StepASTNode>(ASTNodeType.STEP)
    const stepIndex: StepIndex = new Map(stepNodes.map(stepNode => [stepNode.id, stepNode]))

    const journeyNodes = sharedDependencies.nodeRegistry.findByType<JourneyASTNode>(ASTNodeType.JOURNEY)
    const journeyIndex: JourneyIndex = new Map(journeyNodes.map(journeyNode => [journeyNode.id, journeyNode]))

    const planBuilder = new RuntimePlanBuilder(sharedDependencies.nodeRegistry, sharedDependencies.astNodeTree)

    const { reachabilityPlansByStepId: reachabilityPlans, journeyRuntimePlans } = planBuilder.buildAllPlans(
      stepIndex,
      journeyIndex,
    )

    // Step-keyed reachability maps intentionally contain duplicate plan objects:
    // every step in the same journey points at the journey's shared plan. Compile
    // each distinct plan once and let all of its steps reuse the generated function.
    const reachabilityCompiler = new ReachabilityCompiler()
    const compiledPlans = new Set<ReachabilityRuntimePlan>()

    reachabilityPlans.forEach(plan => {
      if (compiledPlans.has(plan)) {
        return
      }

      compiledPlans.add(plan)
      plan.compiledReachability = reachabilityCompiler.compile(
        plan,
        sharedDependencies.nodeRegistry,
        this.journeyInstanceDependencies.functionRegistry,
      )
    })

    // Reachability projection needs the full set of possible field codes,
    // including MAP iterator fields. Compile that inventory once per journey so
    // request-time navigation can read field codes without expanding template nodes.
    this.compileFieldInventory(compiledPlans, sharedDependencies)

    // Graph walking only needs validation for journeys that perform navigation
    // checks. Resolve those step validation functions lazily, then cache them on
    // the shared plan so submit handling and reachability use the same compiled code.
    compiledPlans.forEach(plan => {
      plan.resolveStepValidations = this.createLazyStepValidationResolver(plan, sharedDependencies, stepIndex)
    })

    return {
      rootNode,
      sharedDependencies,
      stepIndex,
      journeyIndex,
      reachabilityPlans,
      journeyRuntimePlans,
      planBuilder,
    }
  }

  /**
   * Attach journey-root quick functions to the shared journey plans.
   */
  compileJourney(shared: SharedCompiledForm): CompilationArtefact {
    const compilationDependencies = shared.sharedDependencies

    this.compileJourneyAnswerPreparation(shared, compilationDependencies)
    this.compileJourneyHooks(shared, compilationDependencies)

    return compilationDependencies
  }

  private compileJourneyHooks(shared: SharedCompiledForm, compilationDependencies: CompilationDependencies): void {
    const compiler = new HookLifecycleCompiler()

    shared.journeyRuntimePlans.forEach(plan => {
      const accessAncestors = plan.accessAncestorIds
        .map(nodeId => compilationDependencies.nodeRegistry.get(nodeId))
        .filter(
          (node): node is JourneyASTNode | StepASTNode =>
            node?.type === ASTNodeType.JOURNEY || node?.type === ASTNodeType.STEP,
        )

      plan.compiledAccessLifecycle = compiler.compileAccessLifecycle(
        accessAncestors,
        this.journeyInstanceDependencies.functionRegistry,
      )
    })
  }

  private compileJourneyAnswerPreparation(
    shared: SharedCompiledForm,
    compilationDependencies: CompilationDependencies,
  ): void {
    // Journey-root requests do not have a current step, but resume/reachability
    // still need prepared answers for every direct step in that journey. Build
    // each journey-root answer-prep function from the same step entries used by
    // the navigation plan so both paths see the same step set.
    const compiler = new StepAnswerPreparationCompiler()
    const allFieldBlocks = compilationDependencies.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
    const allMapIterateNodes = compilationDependencies.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
      .filter(node => node.properties.iterator.type === IteratorType.MAP)

    shared.journeyRuntimePlans.forEach(plan => {
      const stepIds = plan.reachabilityPlan.entries.map(entry => entry.stepId)

      // Field blocks and MAP iterators can live under nested blocks/templates.
      // The AST tree is the source of truth for which nodes belong to each step.
      const fieldBlocks = allFieldBlocks
        .filter(block => stepIds.some(stepId => compilationDependencies.astNodeTree.isDescendantOf(block.id, stepId)))
      const iterateNodes = allMapIterateNodes
        .filter(node => stepIds.some(stepId => compilationDependencies.astNodeTree.isDescendantOf(node.id, stepId)))

      plan.compiledAnswerPreparation = compiler.compile(
        fieldBlocks,
        iterateNodes,
        this.journeyInstanceDependencies.functionRegistry,
      )
    })
  }

  private compileFieldInventory(
    compiledPlans: Set<ReachabilityRuntimePlan>,
    sharedDependencies: CompilationDependencies,
  ): void {
    const compiler = new StepFieldInventoryCompiler()
    const allFieldBlocks = sharedDependencies.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
    const allIterateNodes = sharedDependencies.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
      .filter(node => node.properties.iterator.type === IteratorType.MAP)

    compiledPlans.forEach(plan => {
      const steps: FieldInventoryStepSource[] = plan.entries.map(entry => ({
        stepId: entry.stepId,
        cleardownFieldCodes: entry.cleardownFieldCodes,
        fieldBlocks: allFieldBlocks
          .filter(block => sharedDependencies.astNodeTree.isDescendantOf(block.id, entry.stepId)),
        iterateNodes: allIterateNodes
          .filter(node => entry.iterateNodeIds.includes(node.id)),
      }))

      plan.compiledFieldInventory = compiler.compile(steps, this.journeyInstanceDependencies.functionRegistry)
    })
  }

  /**
   * Attach route-specific quick functions for a single step.
   */
  compileStep(shared: SharedCompiledForm, stepId: NodeId) {
    const stepNode = shared.stepIndex.get(stepId)

    if (!stepNode) {
      throw new Error(`Unable to compile step "${stepId}" - step not found in shared step index`)
    }

    return this.compileForStep(shared.planBuilder, stepNode, shared.sharedDependencies)
  }

  private createLazyStepValidationResolver(
    plan: ReachabilityRuntimePlan,
    sharedDependencies: CompilationDependencies,
    stepIndex: StepIndex,
  ): () => Map<NodeId, CompiledValidationFunction> {
    let cached: Map<NodeId, CompiledValidationFunction> | undefined

    return () => {
      if (cached !== undefined) {
        return cached
      }

      cached = new Map()
      const compiler = new StepValidationCompiler()
      const allFieldBlocks = sharedDependencies.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
      const allIterateNodes = sharedDependencies.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
        .filter(node => node.properties.iterator.type === IteratorType.MAP)

      for (const entry of plan.entries) {
        if (!entry.hasValidation) {
          continue
        }

        const stepNode = stepIndex.get(entry.stepId)

        if (!stepNode) {
          continue
        }

        const fieldBlocks = allFieldBlocks
          .filter(block => sharedDependencies.astNodeTree.isDescendantOf(block.id, stepNode.id))
          .filter(block => Array.isArray(block.properties.validWhen) && block.properties.validWhen.length > 0)
        const domainValidationNodes = stepNode.properties.validWhen ?? []
        const iterateNodes = allIterateNodes
          .filter(node => sharedDependencies.astNodeTree.isDescendantOf(node.id, stepNode.id))

        const compiled = compiler.compile(
          stepNode,
          fieldBlocks,
          domainValidationNodes,
          iterateNodes,
          this.journeyInstanceDependencies.functionRegistry,
        )

        if (compiled) {
          cached.set(entry.stepId, compiled)
        }
      }

      return cached
    }
  }

  private compileForStep(
    planBuilder: RuntimePlanBuilder,
    stepNode: StepASTNode,
    compilationDependencies: CompilationDependencies,
  ) {
    const runtimePlan = planBuilder.buildStepRuntimePlan(stepNode)
    const hookCompiler = new HookLifecycleCompiler()
    const accessAncestors = runtimePlan.accessAncestorIds
      .map(nodeId => compilationDependencies.nodeRegistry.get(nodeId))
      .filter(
        (node): node is JourneyASTNode | StepASTNode =>
          node?.type === ASTNodeType.JOURNEY || node?.type === ASTNodeType.STEP,
      )
    const actionHooks = runtimePlan.actionHookIds
      .map(nodeId => compilationDependencies.nodeRegistry.get(nodeId))
      .filter(
        (node): node is ActionHookASTNode =>
          node?.type === ASTNodeType.HOOK && (node as { hookType?: unknown }).hookType === HookType.ACTION,
      )
    const submitHooks = runtimePlan.submitHookIds
      .map(nodeId => compilationDependencies.nodeRegistry.get(nodeId))
      .filter(
        (node): node is SubmitHookASTNode =>
          node?.type === ASTNodeType.HOOK && (node as { hookType?: unknown }).hookType === HookType.SUBMIT,
      )

    runtimePlan.compiledAccessLifecycle = hookCompiler.compileAccessLifecycle(
      accessAncestors,
      this.journeyInstanceDependencies.functionRegistry,
    )
    runtimePlan.compiledActionHooks = hookCompiler.compileActionHooks(
      actionHooks,
      this.journeyInstanceDependencies.functionRegistry,
    )
    runtimePlan.compiledSubmitHooks = hookCompiler.compileSubmitHooks(
      submitHooks,
      this.journeyInstanceDependencies.functionRegistry,
    )

    // Answer preparation owns every field, not just validating fields. It resolves
    // GET defaults and POST bodies, then records answer mutations before hooks,
    // validation, navigation, and render read from the shared request context.
    const answerPrepCompiler = new StepAnswerPreparationCompiler()
    const allFieldBlocks = compilationDependencies.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
      .filter(block => compilationDependencies.astNodeTree.isDescendantOf(block.id, stepNode.id))
    const answerPrepIterateNodes = compilationDependencies.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
      .filter(node => compilationDependencies.astNodeTree.isDescendantOf(node.id, stepNode.id))
      .filter(node => node.properties.iterator.type === IteratorType.MAP)
    const compiledAnswerPreparation = answerPrepCompiler.compile(
      allFieldBlocks,
      answerPrepIterateNodes,
      this.journeyInstanceDependencies.functionRegistry,
    )

    // Validation only needs fields with validWhen plus any step-level domain
    // validations. MAP iterator fields are compiled inline from their templates.
    const validationCompiler = new StepValidationCompiler()
    const fieldBlocks = compilationDependencies.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
      .filter(block => compilationDependencies.astNodeTree.isDescendantOf(block.id, stepNode.id))
      .filter(block => Array.isArray(block.properties.validWhen) && block.properties.validWhen.length > 0)
    const domainValidationNodes = stepNode.properties.validWhen ?? []
    const iterateNodes = compilationDependencies.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
      .filter(node => compilationDependencies.astNodeTree.isDescendantOf(node.id, stepNode.id))
      .filter(node => node.properties.iterator.type === IteratorType.MAP)
    const compiledValidation = validationCompiler.compile(
      stepNode,
      fieldBlocks,
      domainValidationNodes,
      iterateNodes,
      this.journeyInstanceDependencies.functionRegistry,
    )
    const entryValidationCompiler = new EntryValidationCompiler()
    const compiledEntryValidation = entryValidationCompiler.compile(
      stepNode.properties.validateOnEntry,
      this.journeyInstanceDependencies.functionRegistry,
    )

    // Render evaluates step metadata, journey ancestor metadata, block properties,
    // and field values. All iterator types are passed because FILTER/FIND can be
    // used as inline property values even though only MAP can yield blocks.
    const renderCompiler = new StepRenderCompiler()
    const ancestorNodes = runtimePlan.renderAncestorIds
      .map(id => compilationDependencies.nodeRegistry.get(id) as JourneyASTNode)
    const renderIterateNodes = compilationDependencies.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
      .filter(node => compilationDependencies.astNodeTree.isDescendantOf(node.id, stepNode.id))
    const compiledRender = renderCompiler.compile(
      stepNode,
      ancestorNodes,
      renderIterateNodes,
      this.journeyInstanceDependencies.functionRegistry,
    )

    return {
      artefact: compilationDependencies,
      currentStepId: stepNode.id,
      runtimePlan,
      compiledValidation,
      compiledEntryValidation,
      compiledRender,
      compiledAnswerPreparation,
    }
  }
}

export type CompiledForm = CompiledStep[]
export type CompilationArtefact = CompiledStep['artefact']
