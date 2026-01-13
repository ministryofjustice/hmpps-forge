import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import { PseudoNode } from '@form-engine/core/types/pseudoNodes.type'
import NodeRegistry, { IndexableNodeType, NodeRegistryEntry } from './NodeRegistry'

/**
 * Overlay node registry that delegates to main and pending registries.
 * - New registrations go to pending
 * - Lookups check pending first, then main
 * - Pseudo iteration returns union (for wiring from existing pseudos to new refs)
 * - AST iteration returns pending only
 */
export default class OverlayNodeRegistry extends NodeRegistry {
  constructor(
    private readonly main: NodeRegistry,
    private readonly pending = new NodeRegistry(),
  ) {
    super()
  }

  register(id: NodeId, node: ASTNode | PseudoNode, path: (string | number)[] = []): void {
    if (this.main.has(id) || this.pending.has(id)) {
      throw new Error(`Node with ID "${id}" is already registered`)
    }

    this.pending.register(id, node, path)
  }

  get(id: NodeId): ASTNode | PseudoNode | undefined {
    return this.pending.get(id) ?? this.main.get(id)
  }

  getEntry(id: NodeId): NodeRegistryEntry | undefined {
    return this.pending.getEntry(id) ?? this.main.getEntry(id)
  }

  has(id: NodeId): boolean {
    return this.pending.has(id) || this.main.has(id)
  }

  getAll(): Map<NodeId, ASTNode | PseudoNode> {
    const merged = new Map<NodeId, ASTNode | PseudoNode>()

    this.main.getAll().forEach((node, id) => merged.set(id, node))
    this.pending.getAll().forEach((node, id) => merged.set(id, node))

    return merged
  }

  getAllEntries(): Map<NodeId, NodeRegistryEntry> {
    const merged = new Map<NodeId, NodeRegistryEntry>()

    this.main.getAllEntries().forEach((entry, id) => merged.set(id, entry))
    this.pending.getAllEntries().forEach((entry, id) => merged.set(id, entry))

    return merged
  }

  getIds(): NodeId[] {
    return [...new Set([...this.main.getIds(), ...this.pending.getIds()])]
  }

  size(): number {
    return this.getIds().length
  }

  findByType<T = ASTNode | PseudoNode>(type: IndexableNodeType): T[] {
    return [...this.main.findByType<T>(type), ...this.pending.findByType<T>(type)]
  }

  findBy(predicate: (node: ASTNode | PseudoNode) => boolean): (ASTNode | PseudoNode)[] {
    const results: (ASTNode | PseudoNode)[] = []

    this.pending.findBy(predicate).forEach(node => results.push(node))
    this.main.findBy(predicate).forEach(node => results.push(node))

    return results
  }

  clear(): void {
    this.clearPending()
  }

  clearPending(): void {
    this.pending.clear()
  }

  clone(): NodeRegistry {
    throw new Error('Cannot clone an OverlayNodeRegistry - clone the main registry instead')
  }

  flushIntoMain(): void {
    this.pending.getAllEntries().forEach((entry, id) => {
      this.main.register(id, entry.node, entry.path)
    })

    this.clearPending()
  }

  getPendingIds(): NodeId[] {
    return this.pending.getIds()
  }
}
