import type { JourneyDefinition } from '../../authoring/types/structures.type'
import type { JourneyASTNode, StepASTNode } from '../types/structures.type'
import { ASTNodeType } from '../types/enums'
import type { NodeId } from '../types/engine.type'
import type { CompiledStep, JourneyIndex, StepIndex } from '../types/compilationArtefacts.type'
import type { JourneyRuntimePlan } from '../types/runtimePlans.type'
import type { CompilationDependencies } from './codegen/CompilationDependencies'
import { CompilationContext } from './CompilationContext'
import { NodeIDCategory } from './id-generators/NodeIDGenerator'
import NodeRegistrationWalker from './traversers/NodeRegistrationWalker'
import CompilationPlanner from './CompilationPlanner'
import CodegenOrchestrator from './CodegenOrchestrator'
import { createDSLSourceMap } from '../diagnostics/sourceMetadata'

export interface JourneyCompilationResult {
  readonly rootNode: JourneyASTNode
  readonly context: CompilationContext
  readonly stepIndex: StepIndex
  readonly journeyIndex: JourneyIndex
  readonly steps: Map<NodeId, CompiledStep>
  readonly journeyPlans: Map<NodeId, JourneyRuntimePlan>
}

export default class JourneyCompiler {
  constructor(private readonly dependencies: CompilationDependencies) {}

  compile(journeyDef: JourneyDefinition): JourneyCompilationResult {
    const context = new CompilationContext()

    context.nodeFactory.setSourceMap(createDSLSourceMap(journeyDef))
    const rootNode = context.nodeFactory.createNode(journeyDef) as JourneyASTNode

    const walker = new NodeRegistrationWalker(
      context.nodeIdGenerator,
      NodeIDCategory.COMPILE_AST,
      context.nodeRegistry,
      context.astNodeTree,
    )

    walker.register(rootNode)

    const stepNodes = context.nodeRegistry.findByType<StepASTNode>(ASTNodeType.STEP)
    const stepIndex: StepIndex = new Map(stepNodes.map(stepNode => [stepNode.id, stepNode]))

    const journeyNodes = context.nodeRegistry.findByType<JourneyASTNode>(ASTNodeType.JOURNEY)
    const journeyIndex: JourneyIndex = new Map(journeyNodes.map(journeyNode => [journeyNode.id, journeyNode]))

    const planner = new CompilationPlanner(context.nodeRegistry, context.astNodeTree)
    const plan = planner.buildPlan(stepIndex, journeyIndex)

    const codegen = new CodegenOrchestrator(this.dependencies)
    const steps = codegen.compileAll(plan, context.nodeRegistry)

    return {
      rootNode,
      context,
      stepIndex,
      journeyIndex,
      steps,
      journeyPlans: plan.journeyRuntimePlans,
    }
  }
}
