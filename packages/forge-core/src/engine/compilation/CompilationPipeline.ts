import type { JourneyDefinition } from '../../authoring/types/structures.type'
import type { JourneyASTNode, StepASTNode } from '../contracts/ast/structures.type'
import { ASTNodeType } from '../contracts/ast/enums'
import type { NodeId } from '../contracts/ast/engine.type'
import type { CompiledJourney, CompiledStep, CompiledPackage } from '../contracts/plans/compilationArtefacts.type'
import type { CompilationPlan } from '../contracts/plans/compilationPlan.type'
import type { JourneyRouteIndex, StepRouteIndex } from '../contracts/routing/routeDescriptors.type'
import type { CompilationDependencies } from './lowering/compilationDependencies.type'
import { NodeIDGenerator } from './ast/ast-state/NodeIDGenerator'
import { NodeFactory } from './ast/nodes/NodeFactory'
import ASTNodeIndex from './ast/ast-state/ASTNodeIndex'
import ASTNodeTree from './ast/ast-state/ASTNodeTree'
import NodeRegistrationWalker from './ast/ast-state/NodeRegistrationWalker'
import CompilationPlanBuilder from './dependency-analysis/CompilationPlanBuilder'
import CodegenOrchestrator from './lowering/CodegenOrchestrator'
import ASTSemanticValidator from './semantic-analysis/ASTSemanticValidator'
import getAncestorChain from './ast/ast-state/getAncestorChain'

type AstContext = {
  rootNode: JourneyASTNode
  nodeRegistry: ASTNodeIndex
  astNodeTree: ASTNodeTree
}

export default class CompilationPipeline {
  constructor(private readonly dependencies: CompilationDependencies) {}

  compile(journeyDef: JourneyDefinition): CompiledPackage {
    const ast = this.buildAstTree(journeyDef)

    this.validateSemantics(ast)

    const plan = this.buildCompilationPlan(ast)
    const compiledArtifacts = this.lowerCompilationPlan(plan, ast.nodeRegistry)
    const routes = this.buildRouteIndexes(ast)

    return {
      journeyCode: ast.rootNode.properties.code,
      ...routes,
      ...compiledArtifacts,
    }
  }

  private buildAstTree(journeyDef: JourneyDefinition): AstContext {
    const nodeIdGenerator = new NodeIDGenerator()
    const nodeFactory = new NodeFactory(nodeIdGenerator, journeyDef)
    const nodeRegistry = new ASTNodeIndex()
    const astNodeTree = new ASTNodeTree()

    const rootNode = nodeFactory.createNode(journeyDef) as JourneyASTNode

    const walker = new NodeRegistrationWalker(nodeIdGenerator, nodeRegistry, astNodeTree)

    walker.register(rootNode)

    return { rootNode, nodeRegistry, astNodeTree }
  }

  private validateSemantics({ nodeRegistry, astNodeTree }: AstContext): void {
    const validator = new ASTSemanticValidator(
      nodeRegistry,
      astNodeTree,
      this.dependencies.functionRegistry,
      this.dependencies.componentRegistry,
    )

    validator.validate()
  }

  private buildCompilationPlan({ nodeRegistry, astNodeTree }: AstContext): CompilationPlan {
    const stepNodes = nodeRegistry.findByType<StepASTNode>(ASTNodeType.STEP)
    const journeyNodes = nodeRegistry.findByType<JourneyASTNode>(ASTNodeType.JOURNEY)

    const stepIndex = new Map(stepNodes.map(stepNode => [stepNode.id, stepNode]))
    const journeyIndex = new Map(journeyNodes.map(journeyNode => [journeyNode.id, journeyNode]))

    const planBuilder = new CompilationPlanBuilder(nodeRegistry, astNodeTree)

    return planBuilder.buildPlan(stepIndex, journeyIndex)
  }

  private lowerCompilationPlan(
    plan: CompilationPlan,
    nodeRegistry: ASTNodeIndex,
  ): {
    steps: Map<NodeId, CompiledStep>
    journeys: Map<NodeId, CompiledJourney>
  } {
    const codegen = new CodegenOrchestrator(this.dependencies)

    return codegen.compileAll(plan, nodeRegistry)
  }

  private buildRouteIndexes({ nodeRegistry, astNodeTree }: AstContext): {
    stepRouteIndex: StepRouteIndex
    journeyRouteIndex: JourneyRouteIndex
  } {
    const stepNodes = nodeRegistry.findByType<StepASTNode>(ASTNodeType.STEP)
    const journeyNodes = nodeRegistry.findByType<JourneyASTNode>(ASTNodeType.JOURNEY)

    return {
      stepRouteIndex: this.buildStepRouteIndex(stepNodes, nodeRegistry, astNodeTree),
      journeyRouteIndex: this.buildJourneyRouteIndex(journeyNodes, nodeRegistry, astNodeTree),
    }
  }

  private buildJourneyRouteIndex(
    journeyNodes: JourneyASTNode[],
    nodeRegistry: ASTNodeIndex,
    astNodeTree: ASTNodeTree,
  ): JourneyRouteIndex {
    return new Map(
      journeyNodes.map(node => {
        const ancestorJourneyIds = getAncestorChain(node.id, astNodeTree).filter(
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
            ancestorJourneyIds,
          },
        ]
      }),
    )
  }

  private buildStepRouteIndex(
    stepNodes: StepASTNode[],
    nodeRegistry: ASTNodeIndex,
    astNodeTree: ASTNodeTree,
  ): StepRouteIndex {
    return new Map(
      stepNodes.map(node => {
        const ancestorJourneyIds = getAncestorChain(node.id, astNodeTree)
          .filter(id => id !== node.id)
          .filter(id => nodeRegistry.get(id)?.type === ASTNodeType.JOURNEY)

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
