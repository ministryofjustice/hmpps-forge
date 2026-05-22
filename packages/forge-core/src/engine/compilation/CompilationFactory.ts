import type { JourneyDefinition } from '../../authoring/types/structures.type'
import { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../types/structures.type'
import { ASTNodeType } from '../types/enums'
import type { ASTNode } from '../types/ast.type'
import { BlockType, ExpressionType, IteratorType } from '../../authoring/types/enums'
import { IterateASTNode } from '../types/expressions.type'
import NodeRegistrationWalker from './traversers/NodeRegistrationWalker'
import { JourneyInstanceDependencies, NodeId } from '../types/engine.type'
import { CompilationContext } from './CompilationContext'
import { NodeIDCategory } from './id-generators/NodeIDGenerator'
import RuntimePlanBuilder from './RuntimePlanBuilder'
import type { ReachabilityCompilationPlan, StepRuntimePlan } from '../types/runtimePlans.type'
import type { CompiledValidationFunction } from '../types/compiledPhaseResults.type'
import type {
  CompilationArtefact,
  JourneyIndex,
  SharedCompiledForm,
  StepIndex,
} from '../types/compilationArtefacts.type'
import StepValidationCompiler from './codegen/phase-compilers/validation/StepValidationCompiler'
import ReachabilityCompiler from './codegen/phase-compilers/reachability/ReachabilityCompiler'
import StepRenderCompiler from './codegen/phase-compilers/rendering/StepRenderCompiler'
import StepAnswerPreparationCompiler from './codegen/phase-compilers/answer-preparation/StepAnswerPreparationCompiler'
import HookLifecycleCompiler from './codegen/phase-compilers/hooks/HookLifecycleCompiler'
import { FieldInventoryStepSource } from './codegen/phase-compilers/field-inventory/StepFieldInventoryCompiler'
import { createDSLSourceMap } from '../diagnostics/sourceMetadata'
import getAncestorChain from '../utils/getAncestorChain'

/**
 * Compiles a journey definition into the shared AST, runtime plans, and generated
 * functions used by request handling.
 */
export default class CompilationFactory {
  constructor(private readonly journeyInstanceDependencies: JourneyInstanceDependencies) {}

  /**
   * Build the immutable compilation artefact that every route shares.
   */
  compileShared(journeyDef: JourneyDefinition): SharedCompiledForm {
    const sharedContext = new CompilationContext()

    // The NodeFactory preserves the authoring structure while assigning AST node
    // shapes. NodeRegistrationWalker then fills in missing IDs, resolves @self
    // references, registers nodes, and records parent edges in ASTNodeTree.
    sharedContext.nodeFactory.setSourceMap(createDSLSourceMap(journeyDef))
    const rootNode = sharedContext.nodeFactory.createNode(journeyDef) as JourneyASTNode

    const walker = new NodeRegistrationWalker(
      sharedContext.nodeIdGenerator,
      NodeIDCategory.COMPILE_AST,
      sharedContext.nodeRegistry,
      sharedContext.astNodeTree,
    )

    walker.register(rootNode)

    const stepNodes = sharedContext.nodeRegistry.findByType<StepASTNode>(ASTNodeType.STEP)
    const stepIndex: StepIndex = new Map(stepNodes.map(stepNode => [stepNode.id, stepNode]))

    const journeyNodes = sharedContext.nodeRegistry.findByType<JourneyASTNode>(ASTNodeType.JOURNEY)
    const journeyIndex: JourneyIndex = new Map(journeyNodes.map(journeyNode => [journeyNode.id, journeyNode]))

    const planBuilder = new RuntimePlanBuilder(sharedContext.nodeRegistry, sharedContext.astNodeTree)

    const {
      stepRuntimePlans,
      navigationPlansByStepId: navigationPlans,
      reachabilityCompilationPlans,
      journeyRuntimePlans,
    } = planBuilder.buildAllPlans(stepIndex, journeyIndex)

    // Step-keyed navigation maps intentionally contain duplicate plan objects:
    // every step in the same journey points at the journey's shared plan. Compile
    // each distinct plan once and let all of its steps reuse the generated function.
    const reachabilityCompiler = new ReachabilityCompiler()

    reachabilityCompilationPlans.forEach(plan => {
      plan.navigationPlan.compiledStepValidations = this.compileStepValidationMap(plan, sharedContext, stepIndex)
      plan.navigationPlan.compiledNavigation = reachabilityCompiler.compileNavigation(
        plan,
        this.buildFieldInventorySources(plan, sharedContext),
        sharedContext.nodeRegistry,
        this.journeyInstanceDependencies.functionRegistry,
      )
    })

    return {
      rootNode,
      sharedContext,
      stepIndex,
      journeyIndex,
      stepRuntimePlans,
      navigationPlans,
      reachabilityCompilationPlans,
      journeyRuntimePlans,
    }
  }

  /**
   * Attach journey-root generated functions to the shared journey runtime plans.
   */
  compileJourney(shared: SharedCompiledForm): CompilationArtefact {
    const compilationContext = shared.sharedContext

    this.compileJourneyAnswerPreparation(shared, compilationContext)
    this.compileJourneyHooks(shared, compilationContext)

    return compilationContext
  }

  /**
   * Compiles journey-root access lifecycles from journey ancestor nodes.
   */
  private compileJourneyHooks(shared: SharedCompiledForm, compilationContext: CompilationContext): void {
    const compiler = new HookLifecycleCompiler()

    shared.journeyRuntimePlans.forEach((plan, journeyId) => {
      const accessAncestors = this.resolveAccessAncestors(journeyId, compilationContext)

      plan.compiledAccessLifecycle = compiler.compileAccessLifecycle(
        accessAncestors,
        this.journeyInstanceDependencies.functionRegistry,
      )
    })
  }

  private compileJourneyAnswerPreparation(shared: SharedCompiledForm, compilationContext: CompilationContext): void {
    // Journey-root requests do not have a current step, but resume/reachability
    // still need prepared answers for every direct step in that journey. Build
    // each journey-root answer-prep function from the same step entries used by
    // the navigation plan so both paths see the same step set.
    const compiler = new StepAnswerPreparationCompiler()
    const allFieldBlocks = compilationContext.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
    const allMapIterateNodes = compilationContext.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
      .filter(node => node.properties.iterator.type === IteratorType.MAP)

    shared.journeyRuntimePlans.forEach(plan => {
      const stepIds = plan.navigationPlan.entries.map(entry => entry.stepId)

      // Field blocks and MAP iterators can live under nested blocks/templates.
      // The AST tree is the source of truth for which nodes belong to each step.
      const fieldBlocks = allFieldBlocks
        .filter(block => stepIds.some(stepId => compilationContext.astNodeTree.isDescendantOf(block.id, stepId)))
      const iterateNodes = allMapIterateNodes
        .filter(node => stepIds.some(stepId => compilationContext.astNodeTree.isDescendantOf(node.id, stepId)))

      plan.compiledAnswerPreparation = compiler.compile(
        fieldBlocks,
        iterateNodes,
        this.journeyInstanceDependencies.functionRegistry,
      )
    })
  }

  /**
   * Collects field inventory inputs for every step in a reachability plan.
   */
  private buildFieldInventorySources(
    plan: ReachabilityCompilationPlan,
    sharedContext: CompilationContext,
  ): FieldInventoryStepSource[] {
    const allFieldBlocks = sharedContext.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
    const allIterateNodes = sharedContext.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
      .filter(node => node.properties.iterator.type === IteratorType.MAP)

    return plan.entries.map(entry => ({
      stepId: entry.stepId,
      cleardownFieldCodes: entry.cleardownFieldCodes,
      fieldBlocks: allFieldBlocks
        .filter(block => sharedContext.astNodeTree.isDescendantOf(block.id, entry.stepId)),
      iterateNodes: allIterateNodes
        .filter(node => sharedContext.astNodeTree.isDescendantOf(node.id, entry.stepId)),
    }))
  }

  /**
   * Attach route-specific generated functions for a single step.
   */
  compileStep(shared: SharedCompiledForm, stepId: NodeId) {
    const stepNode = shared.stepIndex.get(stepId)
    const runtimePlan = shared.stepRuntimePlans.get(stepId)

    if (!stepNode) {
      throw new Error(`Unable to compile step "${stepId}" - step not found in shared step index`)
    }

    if (!runtimePlan) {
      throw new Error(`Unable to compile step "${stepId}" - runtime plan not found`)
    }

    return this.compileForStep(shared, stepNode, runtimePlan, shared.sharedContext)
  }

  /**
   * Compiles validation functions used during navigation evaluation.
   *
   * The returned map is keyed by step ID.
   */
  private compileStepValidationMap(
    plan: ReachabilityCompilationPlan,
    sharedContext: CompilationContext,
    stepIndex: StepIndex,
  ): Map<NodeId, CompiledValidationFunction> {
    const compiledValidations = new Map<NodeId, CompiledValidationFunction>()
    const compiler = new StepValidationCompiler()
    const allFieldBlocks = sharedContext.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
    const allIterateNodes = sharedContext.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
      .filter(node => node.properties.iterator.type === IteratorType.MAP)

    plan.entries
      .filter(entry => entry.hasValidation)
      .forEach(entry => {
        const stepNode = stepIndex.get(entry.stepId)

        if (!stepNode) {
          return
        }

        const fieldBlocks = allFieldBlocks
          .filter(block => sharedContext.astNodeTree.isDescendantOf(block.id, stepNode.id))
          .filter(block => hasConfiguredValue(block.properties.validWhen))
        const iterateNodes = allIterateNodes
          .filter(node => sharedContext.astNodeTree.isDescendantOf(node.id, stepNode.id))

        const compiled = compiler.compileOnSubmitValidation(
          stepNode,
          fieldBlocks,
          stepNode.properties.validWhen,
          iterateNodes,
          this.journeyInstanceDependencies.functionRegistry,
        )

        if (compiled) {
          compiledValidations.set(entry.stepId, compiled)
        }
      })

    return compiledValidations
  }

  /**
   * Compiles the functions used by a single step route.
   */
  private compileForStep(
    shared: SharedCompiledForm,
    stepNode: StepASTNode,
    runtimePlan: StepRuntimePlan,
    compilationContext: CompilationContext,
  ) {
    const navigationPlan = shared.navigationPlans.get(stepNode.id)

    if (!navigationPlan) {
      throw new Error(`Unable to compile step "${stepNode.id}" - navigation plan not found`)
    }

    const hookCompiler = new HookLifecycleCompiler()
    const accessAncestors = this.resolveAccessAncestors(stepNode.id, compilationContext)
    const submitHooks = stepNode.properties.onSubmission ?? []

    runtimePlan.compiledAccessLifecycle = hookCompiler.compileAccessLifecycle(
      accessAncestors,
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
    const allFieldBlocks = compilationContext.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
      .filter(block => compilationContext.astNodeTree.isDescendantOf(block.id, stepNode.id))
    const answerPrepIterateNodes = compilationContext.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
      .filter(node => compilationContext.astNodeTree.isDescendantOf(node.id, stepNode.id))
      .filter(node => node.properties.iterator.type === IteratorType.MAP)
    const compiledAnswerPreparation = answerPrepCompiler.compile(
      allFieldBlocks,
      answerPrepIterateNodes,
      this.journeyInstanceDependencies.functionRegistry,
    )

    // Validation only needs fields with validWhen plus any step-level domain
    // validations. MAP iterator fields are compiled inline from their templates.
    const validationCompiler = new StepValidationCompiler()
    const fieldBlocks = compilationContext.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
      .filter(block => compilationContext.astNodeTree.isDescendantOf(block.id, stepNode.id))
      .filter(block => hasConfiguredValue(block.properties.validWhen))
    const iterateNodes = compilationContext.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
      .filter(node => compilationContext.astNodeTree.isDescendantOf(node.id, stepNode.id))
      .filter(node => node.properties.iterator.type === IteratorType.MAP)
    const compiledValidation =
      navigationPlan.compiledStepValidations.get(stepNode.id) ??
      validationCompiler.compileOnSubmitValidation(
        stepNode,
        fieldBlocks,
        stepNode.properties.validWhen,
        iterateNodes,
        this.journeyInstanceDependencies.functionRegistry,
      )
    const compiledEntryValidation = validationCompiler.compileOnEntryValidation(
      stepNode.properties.validateOnEntry,
      this.journeyInstanceDependencies.functionRegistry,
    )

    // Render evaluates step metadata, journey ancestor metadata, block properties,
    // and field values. All iterator types are passed because FILTER/FIND can be
    // used as inline property values even though only MAP can yield blocks.
    const renderCompiler = new StepRenderCompiler()
    const ancestorNodes = this.resolveRenderAncestors(stepNode.id, compilationContext)
    const renderIterateNodes = compilationContext.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
      .filter(node => compilationContext.astNodeTree.isDescendantOf(node.id, stepNode.id))
    const compiledRender = renderCompiler.compile(
      stepNode,
      ancestorNodes,
      renderIterateNodes,
      this.journeyInstanceDependencies.functionRegistry,
    )

    return {
      runtimePlan,
      navigationPlan,
      compiledValidation,
      compiledEntryValidation,
      compiledRender,
      compiledAnswerPreparation,
    }
  }

  /**
   * Resolves journey/step ancestors for access hook codegen.
   */
  private resolveAccessAncestors(
    nodeId: NodeId,
    compilationContext: CompilationContext,
  ): Array<JourneyASTNode | StepASTNode> {
    return getAncestorChain(nodeId, compilationContext.astNodeTree)
      .map(ancestorId => compilationContext.nodeRegistry.get(ancestorId))
      .filter(this.isAccessAncestor)
  }

  /**
   * Resolves journey ancestors passed to render codegen.
   *
   * The current step is intentionally excluded because render receives it as the
   * primary node.
   */
  private resolveRenderAncestors(stepId: NodeId, compilationContext: CompilationContext): JourneyASTNode[] {
    return getAncestorChain(stepId, compilationContext.astNodeTree)
      .slice(0, -1)
      .map(ancestorId => compilationContext.nodeRegistry.get(ancestorId))
      .filter(this.isJourneyNode)
  }

  private isAccessAncestor(node: ASTNode | undefined): node is JourneyASTNode | StepASTNode {
    return node?.type === ASTNodeType.JOURNEY || node?.type === ASTNodeType.STEP
  }

  private isJourneyNode(node: ASTNode | undefined): node is JourneyASTNode {
    return node?.type === ASTNodeType.JOURNEY
  }
}

function hasConfiguredValue(value: unknown): boolean {
  if (value === undefined) {
    return false
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  return true
}
