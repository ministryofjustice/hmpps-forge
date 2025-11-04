import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import RegistrationTraverser from '@form-engine/core/ast/registration/RegistrationTraverser'
import { JourneyASTNode } from '@form-engine/core/types/structures.type'
import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import { CompileStageDependencies } from '@form-engine/core/container/compileStageContainer'

export default class CompiledAST {
  private constructor(
    private readonly root: JourneyASTNode,
    private readonly nodeRegistry: NodeRegistry,
  ) {}

  static createFrom(json: JourneyDefinition, dependencies: CompileStageDependencies): CompiledAST {
    // Phase 1A: Transform JSON to AST
    const root = dependencies.nodeFactory.createNode(json)

    // Phase 1B: Normalize AST
    dependencies.normalizers.addSelfValue.normalize(root)
    dependencies.normalizers.resolveSelfReferences.normalize(root)
    dependencies.normalizers.attachValidationBlockCode.normalize(root)
    dependencies.normalizers.convertFormatters.normalize(root)
    dependencies.normalizers.attachParentNodes.normalize(root)

    // Phase 2: Register nodes with IDs
    const nodeRegistry = RegistrationTraverser.buildRegistry(root)

    // TODO: Add all other compile stages

    return new CompiledAST(root as JourneyASTNode, nodeRegistry)
  }

  // Getters for accessing internal state
  getRoot(): JourneyASTNode {
    return this.root
  }

  getNodeRegistry(): NodeRegistry {
    return this.nodeRegistry
  }
}
