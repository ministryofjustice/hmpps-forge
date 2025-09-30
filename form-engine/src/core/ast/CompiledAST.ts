import { transformToAst } from '@form-engine/core/ast/transformer/transformToAst'
import { resolveSelfReferences } from '@form-engine/core/ast/normalizers/ResolveSelfReferences'
import { convertFormattersToPipeline } from '@form-engine/core/ast/normalizers/ConvertFormattersToPipeline'
import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import RegistrationTraverser from '@form-engine/core/ast/registration/RegistrationTraverser'
import { JourneyASTNode } from '@form-engine/core/types/structures.type'

export default class CompiledAST {
  private constructor(
    private readonly root: JourneyASTNode,
    private readonly nodeRegistry: NodeRegistry,
  ) {}

  static createFrom(json: any): CompiledAST {
    // 1A. Transform JSON to AST
    const root = transformToAst(json)

    // 1B. Normalise AST
    resolveSelfReferences(root)
    convertFormattersToPipeline(root)

    // 2. Registration
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
