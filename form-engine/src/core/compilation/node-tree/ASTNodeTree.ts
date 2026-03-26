import { NodeId } from '@form-engine/core/types/engine.type'

interface PropertyEdge {
  readonly childIds: NodeId[]
  readonly childTypes: Set<string>
}

export default class ASTNodeTree {
  private readonly parentMap = new Map<NodeId, NodeId>()

  private readonly childrenMap = new Map<NodeId, NodeId[]>()

  private readonly roots: NodeId[] = []

  private readonly nodeTypes = new Map<NodeId, string>()

  private readonly propertyEdges = new Map<NodeId, Map<string, PropertyEdge>>()

  addNode(nodeId: NodeId, parentId?: NodeId, propertyKey?: string, nodeType?: string): void {
    if (!this.childrenMap.has(nodeId)) {
      this.childrenMap.set(nodeId, [])
    }

    if (nodeType !== undefined) {
      this.nodeTypes.set(nodeId, nodeType)
    }

    if (parentId !== undefined) {
      this.parentMap.set(nodeId, parentId)

      const siblings = this.childrenMap.get(parentId)

      if (siblings) {
        siblings.push(nodeId)
      } else {
        this.childrenMap.set(parentId, [nodeId])
      }

      if (propertyKey !== undefined) {
        this.addPropertyEdge(parentId, propertyKey, nodeId, nodeType)
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

  getNodeType(nodeId: NodeId): string | undefined {
    return this.nodeTypes.get(nodeId)
  }

  /** Returns property keys that contain AST node children */
  getActivePropertyKeys(nodeId: NodeId): string[] {
    const edges = this.propertyEdges.get(nodeId)

    return edges ? Array.from(edges.keys()) : []
  }

  /** Checks whether any direct child of the given node has the specified type */
  hasChildOfType(nodeId: NodeId, type: string): boolean {
    const edges = this.propertyEdges.get(nodeId)

    if (!edges) {
      return false
    }

    return Array.from(edges.values()).some(edge => edge.childTypes.has(type))
  }

  /** Checks whether any descendant (direct or transitive) has the specified type */
  hasDescendantOfType(nodeId: NodeId, type: string): boolean {
    if (this.hasChildOfType(nodeId, type)) {
      return true
    }

    return this.getChildren(nodeId).some(childId => {
      return this.hasDescendantOfType(childId, type)
    })
  }

  /** Returns property keys containing children of the specified type */
  getPropertyKeysWithChildType(nodeId: NodeId, type: string): string[] {
    const edges = this.propertyEdges.get(nodeId)

    if (!edges) {
      return []
    }

    const result: string[] = []

    edges.forEach((edge, key) => {
      if (edge.childTypes.has(type)) {
        result.push(key)
      }
    })

    return result
  }

  /** Returns children that live under a specific property of the given node */
  getChildrenInProperty(nodeId: NodeId, propertyKey: string): readonly NodeId[] {
    return this.propertyEdges.get(nodeId)?.get(propertyKey)?.childIds ?? []
  }

  /** Record that a property contains children of a given type without tracking specific child IDs (e.g., from templates) */
  markPropertyContainsType(parentId: NodeId, propertyKey: string, type: string): void {
    let properties = this.propertyEdges.get(parentId)

    if (!properties) {
      properties = new Map()
      this.propertyEdges.set(parentId, properties)
    }

    let edge = properties.get(propertyKey)

    if (!edge) {
      edge = { childIds: [], childTypes: new Set() }
      properties.set(propertyKey, edge)
    }

    edge.childTypes.add(type)
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
    this.nodeTypes.forEach((type, nodeId) => cloned.nodeTypes.set(nodeId, type))
    this.propertyEdges.forEach((properties, parentId) => {
      const clonedProperties = new Map<string, PropertyEdge>()

      properties.forEach((edge, key) => {
        clonedProperties.set(key, {
          childIds: [...edge.childIds],
          childTypes: new Set(edge.childTypes),
        })
      })

      cloned.propertyEdges.set(parentId, clonedProperties)
    })

    return cloned
  }

  private addPropertyEdge(parentId: NodeId, propertyKey: string, childId: NodeId, nodeType?: string): void {
    let properties = this.propertyEdges.get(parentId)

    if (!properties) {
      properties = new Map()
      this.propertyEdges.set(parentId, properties)
    }

    let edge = properties.get(propertyKey)

    if (!edge) {
      edge = { childIds: [], childTypes: new Set() }
      properties.set(propertyKey, edge)
    }

    edge.childIds.push(childId)

    if (nodeType !== undefined) {
      edge.childTypes.add(nodeType)
    }
  }
}
