import { ASTNode, NodeId } from '../../../contracts/ast/engine.type'
import { ASTNodeType } from '../../../contracts/ast/enums'
import {
  BlockType,
  ExpressionType,
  FunctionType,
  HookType,
  OutcomeType,
  PredicateType,
} from '../../../../../authoring/types/enums'
import { ExpressionASTNode, OutcomeASTNode } from '../../../contracts/ast/expressions.type'
import { PredicateASTNode } from '../../../contracts/ast/predicates.type'
import { BlockASTNode } from '../../../contracts/ast/structures.type'
import ForgeInternalError from '../../../../errors/ForgeInternalError'

/** Indexes include both structural AST types and authoring sub-types. */
export type IndexableNodeType =
  | ASTNodeType
  | ExpressionType
  | FunctionType
  | PredicateType
  | HookType
  | OutcomeType
  | BlockType

/**
 * Groups the shared compiled AST by node type.
 *
 * The type index is deliberately simple because compilers ask broad questions:
 * "all FIELD blocks", "all ITERATE expressions", "all SUBMIT hooks". Ownership and
 * ancestry live on the nodes themselves via `ASTNode.parent`.
 */
export default class ASTNodeIndex {
  private readonly registeredIds: Set<NodeId> = new Set()

  private readonly typeIndex: Map<string, ASTNode[]> = new Map()

  /**
   * Nodes are frozen on registration so every generated function sees the same
   * shared AST shape for the lifetime of the compiled journey.
   */
  register(id: NodeId, node: ASTNode): void {
    if (this.registeredIds.has(id)) {
      throw new ForgeInternalError(`Node with ID "${id}" is already registered`)
    }

    this.registeredIds.add(id)

    const frozen = Object.freeze(node)

    this.addToTypeIndex(node.type, frozen)

    const subType = this.getNodeSubType(node)

    if (subType) {
      this.addToTypeIndex(subType, frozen)
    }
  }

  private addToTypeIndex(type: string, node: ASTNode): void {
    let nodes = this.typeIndex.get(type)

    if (!nodes) {
      nodes = []
      this.typeIndex.set(type, nodes)
    }

    nodes.push(node)
  }

  /** Sub-type indexing keeps compiler queries independent of AST wrapper type. */
  private getNodeSubType(node: ASTNode): string | undefined {
    if ('expressionType' in node) {
      return (node as ExpressionASTNode).expressionType
    }

    if ('predicateType' in node) {
      return (node as PredicateASTNode).predicateType
    }

    if ('hookType' in node) {
      return (node as { hookType: HookType }).hookType
    }

    if ('outcomeType' in node) {
      return (node as OutcomeASTNode).outcomeType
    }

    if ('blockType' in node) {
      return (node as BlockASTNode).blockType
    }

    return undefined
  }

  findByType<T = ASTNode>(type: IndexableNodeType): T[] {
    return [...(this.typeIndex.get(type) ?? [])] as T[]
  }
}
