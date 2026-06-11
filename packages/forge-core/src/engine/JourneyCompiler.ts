import type { JourneyDefinition } from '../authoring/types/structures.type'
import type { JourneyASTNode, StepASTNode } from './contracts/ast/structures.type'
import { ASTNodeType } from './contracts/ast/enums'
import type { NodeId } from './contracts/ast/engine.type'
import type {
  CompiledJourney,
  CompiledStep,
  JourneyCompilationResult,
} from './contracts/plans/compilationArtefacts.type'
import type { RouteDescriptor } from './contracts/routing/routeDescriptors.type'
import type { CompilationDependencies } from './lowering/compilationDependencies.type'
import { NodeIDCategory, NodeIDGenerator } from './ast/ast-state/NodeIDGenerator'
import { NodeFactory } from './ast/nodes/NodeFactory'
import ASTNodeIndex from './ast/ast-state/ASTNodeIndex'
import ASTNodeTree from './ast/ast-state/ASTNodeTree'
import NodeRegistrationWalker from './ast/ast-state/NodeRegistrationWalker'
import CompilationPlanner from './lowering/CompilationPlanner'
import CodegenOrchestrator from './lowering/CodegenOrchestrator'
import ASTSemanticValidator from './ast/validation/ASTSemanticValidator'
import { createDSLSourceMap } from './diagnostics/sourceMetadata'
import getAncestorChain from './ast/ast-state/getAncestorChain'

export default class JourneyCompiler {
  constructor(private readonly dependencies: CompilationDependencies) {}

  compile(journeyDef: JourneyDefinition): JourneyCompilationResult {
    const { rootNode, nodeRegistry, astNodeTree } = this.buildAstTree(journeyDef)

    const validator = new ASTSemanticValidator(
      nodeRegistry,
      astNodeTree,
      this.dependencies.functionRegistry,
      this.dependencies.componentRegistry,
    )

    validator.validate()

    const stepNodes = nodeRegistry.findByType<StepASTNode>(ASTNodeType.STEP)
    const journeyNodes = nodeRegistry.findByType<JourneyASTNode>(ASTNodeType.JOURNEY)

    const { steps, journeys } = this.compilePlans(stepNodes, journeyNodes, nodeRegistry, astNodeTree)

    return {
      journeyCode: rootNode.properties.code,
      stepRouteIndex: this.buildRouteIndex(stepNodes, nodeRegistry, astNodeTree),
      journeyRouteIndex: this.buildRouteIndex(journeyNodes, nodeRegistry, astNodeTree),
      steps,
      journeys,
    }
  }

  private buildAstTree(journeyDef: JourneyDefinition): {
    rootNode: JourneyASTNode
    nodeRegistry: ASTNodeIndex
    astNodeTree: ASTNodeTree
  } {
    const nodeIdGenerator = new NodeIDGenerator()
    const nodeFactory = new NodeFactory(nodeIdGenerator, NodeIDCategory.COMPILE_AST)
    const nodeRegistry = new ASTNodeIndex()
    const astNodeTree = new ASTNodeTree()

    nodeFactory.setSourceMap(createDSLSourceMap(journeyDef))
    const rootNode = nodeFactory.createNode(journeyDef) as JourneyASTNode

    const walker = new NodeRegistrationWalker(nodeIdGenerator, NodeIDCategory.COMPILE_AST, nodeRegistry, astNodeTree)

    walker.register(rootNode)

    return { rootNode, nodeRegistry, astNodeTree }
  }

  private compilePlans(
    stepNodes: StepASTNode[],
    journeyNodes: JourneyASTNode[],
    nodeRegistry: ASTNodeIndex,
    astNodeTree: ASTNodeTree,
  ): { steps: Map<NodeId, CompiledStep>; journeys: Map<NodeId, CompiledJourney> } {
    const stepIndex = new Map(stepNodes.map(stepNode => [stepNode.id, stepNode]))
    const journeyIndex = new Map(journeyNodes.map(journeyNode => [journeyNode.id, journeyNode]))

    const planner = new CompilationPlanner(nodeRegistry, astNodeTree)
    const plan = planner.buildPlan(stepIndex, journeyIndex)

    const codegen = new CodegenOrchestrator(this.dependencies)

    return codegen.compileAll(plan, nodeRegistry)
  }

  /**
   * The JOURNEY type filter keeps a journey node's own id in its ancestor list
   * (getAncestorChain includes the start node) while dropping a step node's.
   * RouteTreeBuilder.buildJourneyContexts relies on that self-inclusion to
   * build each journey's own context.
   */
  private buildRouteIndex(
    nodes: (StepASTNode | JourneyASTNode)[],
    nodeRegistry: ASTNodeIndex,
    astNodeTree: ASTNodeTree,
  ): Map<NodeId, RouteDescriptor> {
    return new Map(
      nodes.map(node => {
        const ancestorJourneyNodeIds = getAncestorChain(node.id, astNodeTree).filter(
          id => nodeRegistry.get(id)?.type === ASTNodeType.JOURNEY,
        )

        return [
          node.id,
          {
            nodeId: node.id,
            path: node.properties.path,
            title: node.properties.title,
            description: node.properties.description,
            metadata: node.properties.metadata,
            ancestorJourneyNodeIds,
          },
        ]
      }),
    )
  }
}
