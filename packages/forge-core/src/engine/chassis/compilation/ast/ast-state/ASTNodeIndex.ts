import type { AstNodeId, MaterialisedASTNode } from '../../../contracts/ast/ast.type'
import { ASTNodeFamily, astNodeFamily, type ASTNodeKind } from '../../../contracts/ast/enums'
import ForgeInternalError from '../../../../errors/ForgeInternalError'

/** Groups the shared materialised AST by exact semantic kind and taxonomy family. */
export default class ASTNodeIndex {
  private readonly registeredIds: Set<AstNodeId> = new Set()

  private readonly kindIndex: Map<ASTNodeKind, MaterialisedASTNode[]> = new Map()

  private readonly familyIndex: Map<ASTNodeFamily, MaterialisedASTNode[]> = new Map()

  register(id: AstNodeId, node: MaterialisedASTNode): void {
    if (this.registeredIds.has(id)) {
      throw new ForgeInternalError(`Node with ID "${id}" is already registered`)
    }

    this.registeredIds.add(id)

    const frozen = Object.freeze(node)

    this.addToIndex(this.kindIndex, node.kind, frozen)
    this.addToIndex(this.familyIndex, astNodeFamily(node.kind), frozen)
  }

  findByKind<TNode extends MaterialisedASTNode = MaterialisedASTNode>(kind: ASTNodeKind): TNode[] {
    return [...(this.kindIndex.get(kind) ?? [])] as TNode[]
  }

  findByFamily<TNode extends MaterialisedASTNode = MaterialisedASTNode>(family: ASTNodeFamily): TNode[] {
    return [...(this.familyIndex.get(family) ?? [])] as TNode[]
  }

  private addToIndex<TKey>(index: Map<TKey, MaterialisedASTNode[]>, key: TKey, node: MaterialisedASTNode): void {
    let nodes = index.get(key)

    if (!nodes) {
      nodes = []
      index.set(key, nodes)
    }

    nodes.push(node)
  }
}
