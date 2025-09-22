import { transformToAst } from '@form-engine/core/ast/transformer/transformToAst'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { resolveSelfReferences } from '@form-engine/core/ast/normalizers/ResolveSelfReferences'
import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import RegistrationTraverser from '@form-engine/core/ast/registration/RegistrationTraverser'

export default class CompiledAST {
  private constructor(
    private readonly root: ASTNode,
    private readonly nodeRegistry: NodeRegistry,
  ) {}

  static createFrom(json: any): CompiledAST {
    // 1A. Transform JSON to AST
    const root = transformToAst(json)

    // 1B. Normalise AST
    resolveSelfReferences(root)

    // 2. Registration
    const nodeRegistry = RegistrationTraverser.buildRegistry(root)

    // TODO: Add all other compile stages

    return new CompiledAST(root, nodeRegistry)
  }
}
