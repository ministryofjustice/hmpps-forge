import { NodeId } from '../../contracts/ast/engine.type'

export default class ASTNodeTree {
  private readonly parentMap = new Map<NodeId, NodeId>()

  addNode(nodeId: NodeId, parentId?: NodeId): void {
    if (parentId !== undefined) {
      this.parentMap.set(nodeId, parentId)
    }
  }

  getParent(nodeId: NodeId): NodeId | undefined {
    return this.parentMap.get(nodeId)
  }

  isDescendantOf(nodeId: NodeId, ancestorId: NodeId): boolean {
    let currentId: NodeId | undefined = this.getParent(nodeId)

    while (currentId !== undefined) {
      if (currentId === ancestorId) {
        return true
      }

      currentId = this.getParent(currentId)
    }

    return false
  }
}
