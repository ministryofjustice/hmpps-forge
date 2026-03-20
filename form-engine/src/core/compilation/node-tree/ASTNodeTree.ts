import { NodeId } from '@form-engine/core/types/engine.type'

export default class ASTNodeTree {
  private readonly parentMap = new Map<NodeId, NodeId>()

  private readonly childrenMap = new Map<NodeId, NodeId[]>()

  private readonly roots: NodeId[] = []

  addNode(nodeId: NodeId, parentId?: NodeId): void {
    if (!this.childrenMap.has(nodeId)) {
      this.childrenMap.set(nodeId, [])
    }

    if (parentId !== undefined) {
      this.parentMap.set(nodeId, parentId)

      const siblings = this.childrenMap.get(parentId)

      if (siblings) {
        siblings.push(nodeId)
      } else {
        this.childrenMap.set(parentId, [nodeId])
      }
    } else {
      this.roots.push(nodeId)
    }
  }

  getParent(nodeId: NodeId): NodeId | undefined {
    return this.parentMap.get(nodeId)
  }

  getChildren(nodeId: NodeId): readonly NodeId[] {
    return this.childrenMap.get(nodeId) ?? []
  }

  isLeaf(nodeId: NodeId): boolean {
    const children = this.childrenMap.get(nodeId)

    return children === undefined || children.length === 0
  }

  postOrder(): NodeId[] {
    const result: NodeId[] = []

    const visit = (nodeId: NodeId): void => {
      const children = this.childrenMap.get(nodeId)

      if (children) {
        children.forEach(childId => visit(childId))
      }

      result.push(nodeId)
    }

    this.roots.forEach(rootId => visit(rootId))

    return result
  }

  clone(): ASTNodeTree {
    const cloned = new ASTNodeTree()

    this.parentMap.forEach((parentId, nodeId) => cloned.parentMap.set(nodeId, parentId))
    this.childrenMap.forEach((children, nodeId) => cloned.childrenMap.set(nodeId, [...children]))
    cloned.roots.push(...this.roots)

    return cloned
  }
}
