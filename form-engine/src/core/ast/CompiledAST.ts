import { transformToAst } from '@form-engine/core/ast/transformer/transformToAst'
import { ASTNode } from '@form-engine/core/types/engine.type'

export default class CompiledAST {
  private readonly root: ASTNode

  private constructor(root: ASTNode) {
    this.root = root
  }

  static createFrom(json: any): CompiledAST {
    // 1. Transform JSON to AST
    const root = transformToAst(json)

    // TODO: Add all other compile stages

    return new CompiledAST(root)
  }
}
