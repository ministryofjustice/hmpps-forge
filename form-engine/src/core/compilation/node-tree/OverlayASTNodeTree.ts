import { NodeId } from '@form-engine/core/types/engine.type'
import ASTNodeTree from '@form-engine/core/compilation/node-tree/ASTNodeTree'

export default class OverlayASTNodeTree extends ASTNodeTree {
  constructor(private readonly main: ASTNodeTree) {
    super()
  }

  getParent(nodeId: NodeId): NodeId | undefined {
    return super.getParent(nodeId) ?? this.main.getParent(nodeId)
  }

  getChildren(nodeId: NodeId): readonly NodeId[] {
    const pendingChildren = super.getChildren(nodeId)
    const mainChildren = this.main.getChildren(nodeId)

    if (pendingChildren.length === 0) {
      return mainChildren
    }

    if (mainChildren.length === 0) {
      return pendingChildren
    }

    return [...mainChildren, ...pendingChildren]
  }

  isLeaf(nodeId: NodeId): boolean {
    return super.isLeaf(nodeId) && this.main.isLeaf(nodeId)
  }

  clone(): ASTNodeTree {
    throw new Error('Cannot clone an OverlayASTNodeTree - clone the main tree instead')
  }

  flushIntoMain(): void {
    this.postOrder().forEach(nodeId => {
      this.main.addNode(nodeId, super.getParent(nodeId))
    })
  }
}
