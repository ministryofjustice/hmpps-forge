import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import { JourneyASTNode } from '@form-engine/core/types/structures.type'
import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import { CompileStageDependencies } from '@form-engine/core/container/compileStageContainer'

export default class CompiledAST {
  private constructor(
    private readonly root: JourneyASTNode,
    private readonly nodeRegistry: NodeRegistry,
    private readonly pseudoNodeRegistry: NodeRegistry,
  ) {}

  static createFrom(json: JourneyDefinition, services: CompileStageDependencies): CompiledAST {
    // Phase 1A: Transform JSON to AST
    const root = services.nodeFactory.createNode(json) as JourneyASTNode

    // Phase 1B: Normalize AST
    services.normalizers.addSelfValue.normalize(root)
    services.normalizers.resolveSelfReferences.normalize(root)
    services.normalizers.attachValidationBlockCode.normalize(root)
    services.normalizers.convertFormatters.normalize(root)
    services.normalizers.attachParentNodes.normalize(root)

    // Phase 2A: Register AST nodes with IDs
    services.registers.configurationNodes.register(root)

    // Phase 2B: Discover and register pseudo nodes
    services.registers.pseudoNodes.register(root)

    return new CompiledAST(root as JourneyASTNode, services.astNodeRegistry, services.pseudoNodeRegistry)
  }

  // Getters for accessing internal state
  getRoot(): JourneyASTNode {
    return this.root
  }

  getNodeRegistry(): NodeRegistry {
    return this.nodeRegistry
  }
}
