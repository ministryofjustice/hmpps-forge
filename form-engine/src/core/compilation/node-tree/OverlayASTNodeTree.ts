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

  getNodeType(nodeId: NodeId): string | undefined {
    return super.getNodeType(nodeId) ?? this.main.getNodeType(nodeId)
  }

  getActivePropertyKeys(nodeId: NodeId): string[] {
    const overlayKeys = super.getActivePropertyKeys(nodeId)
    const mainKeys = this.main.getActivePropertyKeys(nodeId)

    if (overlayKeys.length === 0) {
      return mainKeys
    }

    if (mainKeys.length === 0) {
      return overlayKeys
    }

    return [...new Set([...mainKeys, ...overlayKeys])]
  }

  hasChildOfType(nodeId: NodeId, type: string): boolean {
    return super.hasChildOfType(nodeId, type) || this.main.hasChildOfType(nodeId, type)
  }

  getPropertyKeysWithChildType(nodeId: NodeId, type: string): string[] {
    const overlayKeys = super.getPropertyKeysWithChildType(nodeId, type)
    const mainKeys = this.main.getPropertyKeysWithChildType(nodeId, type)

    if (overlayKeys.length === 0) {
      return mainKeys
    }

    if (mainKeys.length === 0) {
      return overlayKeys
    }

    return [...new Set([...mainKeys, ...overlayKeys])]
  }

  getChildrenInProperty(nodeId: NodeId, propertyKey: string): readonly NodeId[] {
    const overlayChildren = super.getChildrenInProperty(nodeId, propertyKey)
    const mainChildren = this.main.getChildrenInProperty(nodeId, propertyKey)

    if (overlayChildren.length === 0) {
      return mainChildren
    }

    if (mainChildren.length === 0) {
      return overlayChildren
    }

    return [...mainChildren, ...overlayChildren]
  }

  clone(): ASTNodeTree {
    throw new Error('Cannot clone an OverlayASTNodeTree - clone the main tree instead')
  }

  flushIntoMain(): void {
    this.postOrder().forEach(nodeId => {
      const parentId = super.getParent(nodeId)
      const nodeType = super.getNodeType(nodeId)
      const propertyKey = this.findOverlayPropertyKey(nodeId, parentId)

      this.main.addNode(nodeId, parentId, propertyKey, nodeType)
    })
  }

  private findOverlayPropertyKey(nodeId: NodeId, parentId: NodeId | undefined): string | undefined {
    if (parentId === undefined) {
      return undefined
    }

    const keys = super.getActivePropertyKeys(parentId)

    return keys.find(key => super.getChildrenInProperty(parentId, key).includes(nodeId))
  }
}
