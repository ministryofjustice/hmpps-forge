import type { JourneyDefinition } from '../../authoring/types/structures.type'
import type { JourneyASTNode, StepASTNode } from '../types/structures.type'
import { ASTNodeType } from '../types/enums'
import type { JourneyCompilationResult } from '../types/compilationArtefacts.type'
import type { JourneyRouteIndex, StepRouteIndex } from '../types/routeDescriptors.type'
import type { CompilationDependencies } from './codegen/compilationDependencies.type'
import { CompilationContext } from './CompilationContext'
import { NodeIDCategory } from './id-generators/NodeIDGenerator'
import NodeRegistrationWalker from './traversers/NodeRegistrationWalker'
import CompilationPlanner from './CompilationPlanner'
import CodegenOrchestrator from './CodegenOrchestrator'
import { createDSLSourceMap } from '../diagnostics/sourceMetadata'
import getAncestorChain from '../utils/getAncestorChain'

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
    const stepIndex = new Map(stepNodes.map(stepNode => [stepNode.id, stepNode]))

    const journeyNodes = context.nodeRegistry.findByType<JourneyASTNode>(ASTNodeType.JOURNEY)
    const journeyIndex = new Map(journeyNodes.map(journeyNode => [journeyNode.id, journeyNode]))

    const planner = new CompilationPlanner(context.nodeRegistry, context.astNodeTree)
    const plan = planner.buildPlan(stepIndex, journeyIndex)

    const codegen = new CodegenOrchestrator(this.dependencies)
    const steps = codegen.compileAll(plan, context.nodeRegistry)

    const journeyRouteIndex = this.buildJourneyRouteIndex(journeyNodes, context)
    const stepRouteIndex = this.buildStepRouteIndex(stepNodes, context)

    return {
      journeyCode: rootNode.properties.code,
      stepRouteIndex,
      journeyRouteIndex,
      steps,
      journeyPlans: plan.journeyRuntimePlans,
    }
  }

  private buildJourneyRouteIndex(journeyNodes: JourneyASTNode[], context: CompilationContext): JourneyRouteIndex {
    return new Map(
      journeyNodes.map(node => {
        const ancestorJourneyIds = getAncestorChain(node.id, context.astNodeTree).filter(
          id => context.nodeRegistry.get(id)?.type === ASTNodeType.JOURNEY,
        )

        return [
          node.id,
          {
            nodeId: node.id,
            path: node.properties.path,
            title: node.properties.title,
            description: node.properties.description,
            metadata: node.properties.metadata,
            ancestorJourneyIds,
          },
        ]
      }),
    )
  }

  private buildStepRouteIndex(stepNodes: StepASTNode[], context: CompilationContext): StepRouteIndex {
    return new Map(
      stepNodes.map(node => {
        const ancestorJourneyIds = getAncestorChain(node.id, context.astNodeTree)
          .filter(id => id !== node.id)
          .filter(id => context.nodeRegistry.get(id)?.type === ASTNodeType.JOURNEY)

        return [
          node.id,
          {
            nodeId: node.id,
            path: node.properties.path,
            title: node.properties.title,
            description: node.properties.description,
            metadata: node.properties.metadata,
            ancestorJourneyIds,
          },
        ]
      }),
    )
  }
}
