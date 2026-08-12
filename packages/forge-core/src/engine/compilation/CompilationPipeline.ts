import type { JourneyDefinition } from '../../authoring/types/structures.type'
import type { JourneyASTNode, StepASTNode } from '../contracts/ast/structures.type'
import { ASTNodeType } from '../contracts/ast/enums'
import type { NodeId } from '../contracts/ast/engine.type'
import type { CompiledJourney, CompiledStep, CompiledPackage } from '../contracts/plans/compilationArtefacts.type'
import type { CompilationPlan } from '../contracts/plans/compilationPlan.type'
import type { JourneyRouteIndex, StepRouteIndex } from '../concerns/route/contracts/routeDescriptors.type'
import type { CompilationDependencies } from './lowering/compilationDependencies.type'
import { NodeIDGenerator } from './ast/ast-state/NodeIDGenerator'
import { NodeFactory } from './ast/nodes/NodeFactory'
import ASTNodeIndex from './ast/ast-state/ASTNodeIndex'
import NodeRegistrationWalker from './ast/ast-state/NodeRegistrationWalker'
import CompilationPlanBuilder from './dependency-analysis/CompilationPlanBuilder'
import RouteIndexBuilder from '../concerns/route/analysis/RouteIndexBuilder'
import CodegenOrchestrator from './lowering/CodegenOrchestrator'
import ASTSemanticValidator from '../concerns/semantic-analysis/ASTSemanticValidator'
import CompilationTracer from './tracing/CompilationTracer'

type AstContext = {
  rootNode: JourneyASTNode
  nodeRegistry: ASTNodeIndex
}

export default class CompilationPipeline {
  private readonly tracer: CompilationTracer

  constructor(private readonly dependencies: CompilationDependencies) {
    this.tracer = dependencies.tracer ?? CompilationTracer.disabled
  }

  compile(journeyDef: JourneyDefinition): CompiledPackage {
    const ast = this.tracer.span('build-ast-tree', 'compilation.ast', () => this.buildAstTree(journeyDef))

    this.tracer.recordJourneyCode(ast.rootNode.properties.code)

    this.tracer.span('validate-semantics', 'compilation.semantic-analysis', () => this.validateSemantics(ast))

    const plan = this.tracer.span('build-compilation-plan', 'compilation.dependency-analysis', () =>
      this.buildCompilationPlan(ast),
    )
    const compiledArtifacts = this.tracer.span('lower-compilation-plan', 'compilation.lowering', () =>
      this.lowerCompilationPlan(plan),
    )
    const routes = this.tracer.span('build-route-indexes', 'compilation.routes', () => this.buildRouteIndexes(ast))

    return {
      journeyCode: ast.rootNode.properties.code,
      ...routes,
      ...compiledArtifacts,
    }
  }

  private buildAstTree(journeyDef: JourneyDefinition): AstContext {
    const nodeIdGenerator = new NodeIDGenerator()
    const nodeFactory = new NodeFactory(nodeIdGenerator)
    const nodeRegistry = new ASTNodeIndex()

    const rootNode = nodeFactory.createNode(journeyDef) as JourneyASTNode

    const walker = new NodeRegistrationWalker(nodeIdGenerator, nodeRegistry)

    walker.register(rootNode)

    return { rootNode, nodeRegistry }
  }

  private validateSemantics({ nodeRegistry }: AstContext): void {
    const validator = new ASTSemanticValidator(
      nodeRegistry,
      this.dependencies.functionRegistry,
      this.dependencies.componentRegistry,
    )

    validator.validate()
  }

  private buildCompilationPlan({ nodeRegistry }: AstContext): CompilationPlan {
    const stepNodes = nodeRegistry.findByType<StepASTNode>(ASTNodeType.STEP)
    const journeyNodes = nodeRegistry.findByType<JourneyASTNode>(ASTNodeType.JOURNEY)

    const stepIndex = new Map(stepNodes.map(stepNode => [stepNode.id, stepNode]))
    const journeyIndex = new Map(journeyNodes.map(journeyNode => [journeyNode.id, journeyNode]))

    const planBuilder = new CompilationPlanBuilder(nodeRegistry)

    return planBuilder.buildPlan(stepIndex, journeyIndex)
  }

  private lowerCompilationPlan(plan: CompilationPlan): {
    steps: Map<NodeId, CompiledStep>
    journeys: Map<NodeId, CompiledJourney>
  } {
    const codegen = new CodegenOrchestrator(this.dependencies)

    return codegen.compileAll(plan)
  }

  private buildRouteIndexes({ nodeRegistry }: AstContext): {
    stepRouteIndex: StepRouteIndex
    journeyRouteIndex: JourneyRouteIndex
  } {
    const routeIndexBuilder = new RouteIndexBuilder()

    const stepNodes = nodeRegistry.findByType<StepASTNode>(ASTNodeType.STEP)
    const journeyNodes = nodeRegistry.findByType<JourneyASTNode>(ASTNodeType.JOURNEY)

    return {
      stepRouteIndex: routeIndexBuilder.buildStepRouteIndex(stepNodes),
      journeyRouteIndex: routeIndexBuilder.buildJourneyRouteIndex(journeyNodes),
    }
  }
}
