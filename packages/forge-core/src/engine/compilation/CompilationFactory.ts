import type { JourneyDefinition } from '../../authoring/types/structures.type'
import { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../types/structures.type'
import { ASTNodeType } from '../types/enums'
import type { ASTNode } from '../types/ast.type'
import { BlockType, ExpressionType, IteratorType } from '../../authoring/types/enums'
import { IterateASTNode } from '../types/expressions.type'
import NodeRegistrationWalker from './traversers/NodeRegistrationWalker'
import { JourneyInstanceDependencies, NodeId } from '../types/engine.type'
import { CompilationDependencies } from './CompilationDependencies'
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
    const sharedDependencies = new CompilationDependencies()

    // The NodeFactory preserves the authoring structure while assigning AST node
    // shapes. NodeRegistrationWalker then fills in missing IDs, resolves @self
    // references, registers nodes, and records parent edges in ASTNodeTree.
    sharedDependencies.nodeFactory.setSourceMap(createDSLSourceMap(journeyDef))
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
      plan.navigationPlan.compiledStepValidations = this.compileStepValidationMap(plan, sharedDependencies, stepIndex)
      plan.navigationPlan.compiledNavigation = reachabilityCompiler.compileNavigation(
        plan,
        this.buildFieldInventorySources(plan, sharedDependencies),
        sharedDependencies.nodeRegistry,
        this.journeyInstanceDependencies.functionRegistry,
      )
    })

    return {
      rootNode,
      sharedDependencies,
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
    const compilationDependencies = shared.sharedDependencies

    this.compileJourneyAnswerPreparation(shared, compilationDependencies)
    this.compileJourneyHooks(shared, compilationDependencies)

    return compilationDependencies
  }

  /**
   * Compiles journey-root access lifecycles from journey ancestor nodes.
   */
  private compileJourneyHooks(shared: SharedCompiledForm, compilationDependencies: CompilationDependencies): void {
    const compiler = new HookLifecycleCompiler()

    shared.journeyRuntimePlans.forEach((plan, journeyId) => {
      const accessAncestors = this.resolveAccessAncestors(journeyId, compilationDependencies)

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
      const stepIds = plan.navigationPlan.entries.map(entry => entry.stepId)

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

  /**
   * Collects field inventory inputs for every step in a reachability plan.
   */
  private buildFieldInventorySources(
    plan: ReachabilityCompilationPlan,
    sharedDependencies: CompilationDependencies,
  ): FieldInventoryStepSource[] {
    const allFieldBlocks = sharedDependencies.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
    const allIterateNodes = sharedDependencies.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
      .filter(node => node.properties.iterator.type === IteratorType.MAP)

    return plan.entries.map(entry => ({
      stepId: entry.stepId,
      cleardownFieldCodes: entry.cleardownFieldCodes,
      fieldBlocks: allFieldBlocks
        .filter(block => sharedDependencies.astNodeTree.isDescendantOf(block.id, entry.stepId)),
      iterateNodes: allIterateNodes
        .filter(node => sharedDependencies.astNodeTree.isDescendantOf(node.id, entry.stepId)),
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

    return this.compileForStep(shared, stepNode, runtimePlan, shared.sharedDependencies)
  }

  /**
   * Compiles validation functions used during navigation evaluation.
   *
   * The returned map is keyed by step ID.
   */
  private compileStepValidationMap(
    plan: ReachabilityCompilationPlan,
    sharedDependencies: CompilationDependencies,
    stepIndex: StepIndex,
  ): Map<NodeId, CompiledValidationFunction> {
    const compiledValidations = new Map<NodeId, CompiledValidationFunction>()
    const compiler = new StepValidationCompiler()
    const allFieldBlocks = sharedDependencies.nodeRegistry.findByType<FieldBlockASTNode>(BlockType.FIELD)
    const allIterateNodes = sharedDependencies.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
      .filter(node => node.properties.iterator.type === IteratorType.MAP)

    plan.entries
      .filter(entry => entry.hasValidation)
      .forEach(entry => {
        const stepNode = stepIndex.get(entry.stepId)

        if (!stepNode) {
          return
        }

        const fieldBlocks = allFieldBlocks
          .filter(block => sharedDependencies.astNodeTree.isDescendantOf(block.id, stepNode.id))
          .filter(block => hasConfiguredValue(block.properties.validWhen))
        const iterateNodes = allIterateNodes
          .filter(node => sharedDependencies.astNodeTree.isDescendantOf(node.id, stepNode.id))

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
    compilationDependencies: CompilationDependencies,
  ) {
    const navigationPlan = shared.navigationPlans.get(stepNode.id)

    if (!navigationPlan) {
      throw new Error(`Unable to compile step "${stepNode.id}" - navigation plan not found`)
    }

    const hookCompiler = new HookLifecycleCompiler()
    const accessAncestors = this.resolveAccessAncestors(stepNode.id, compilationDependencies)
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
      .filter(block => hasConfiguredValue(block.properties.validWhen))
    const iterateNodes = compilationDependencies.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
      .filter(node => compilationDependencies.astNodeTree.isDescendantOf(node.id, stepNode.id))
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
    const ancestorNodes = this.resolveRenderAncestors(stepNode.id, compilationDependencies)
    const renderIterateNodes = compilationDependencies.nodeRegistry.findByType<IterateASTNode>(ExpressionType.ITERATE)
      .filter(node => compilationDependencies.astNodeTree.isDescendantOf(node.id, stepNode.id))
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
    compilationDependencies: CompilationDependencies,
  ): Array<JourneyASTNode | StepASTNode> {
    return getAncestorChain(nodeId, compilationDependencies.astNodeTree)
      .map(ancestorId => compilationDependencies.nodeRegistry.get(ancestorId))
      .filter(this.isAccessAncestor)
  }

  /**
   * Resolves journey ancestors passed to render codegen.
   *
   * The current step is intentionally excluded because render receives it as the
   * primary node.
   */
  private resolveRenderAncestors(stepId: NodeId, compilationDependencies: CompilationDependencies): JourneyASTNode[] {
    return getAncestorChain(stepId, compilationDependencies.astNodeTree)
      .slice(0, -1)
      .map(ancestorId => compilationDependencies.nodeRegistry.get(ancestorId))
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
