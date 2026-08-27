import type { MaterialisedASTNode, TemplateASTNode } from '../../../contracts/ast/ast.type'
import type { TemplateValue } from '../../../contracts/ast/template.type'
import { isTemplateASTNode } from '../../../contracts/ast/nodes'
import { ASTNodeFamily, astNodeFamily, type ASTNodeKind } from '../../../contracts/ast/enums'

export interface TemplateNodeEntry {
  readonly node: TemplateASTNode
  readonly owningNode: MaterialisedASTNode
}

/** Groups unmaterialised template nodes by exact semantic kind and taxonomy family. */
export default class TemplateNodeIndex {
  private readonly registeredNodes: WeakSet<TemplateASTNode> = new WeakSet()

  private readonly kindIndex: Map<ASTNodeKind, TemplateNodeEntry[]> = new Map()

  private readonly familyIndex: Map<ASTNodeFamily, TemplateNodeEntry[]> = new Map()

  registerTree(template: TemplateValue, owningNode: MaterialisedASTNode): void {
    this.collect(template, owningNode)
  }

  findByKind(kind: ASTNodeKind): TemplateNodeEntry[] {
    return [...(this.kindIndex.get(kind) ?? [])]
  }

  findByFamily(family: ASTNodeFamily): TemplateNodeEntry[] {
    return [...(this.familyIndex.get(family) ?? [])]
  }

  private collect(value: TemplateValue, owningNode: MaterialisedASTNode): void {
    if (value === null || value === undefined || typeof value !== 'object') {
      return
    }

    if (Array.isArray(value)) {
      value.forEach(item => this.collect(item, owningNode))

      return
    }

    if (isTemplateASTNode(value)) {
      if (this.registeredNodes.has(value)) {
        return
      }

      this.registeredNodes.add(value)
      this.addEntry(value, owningNode)
      this.collectTemplateNodeChildren(value, owningNode)

      return
    }

    Object.values(value).forEach(child => this.collect(child, owningNode))
  }

  private collectTemplateNodeChildren(node: TemplateASTNode, owningNode: MaterialisedASTNode): void {
    Object.entries(node).forEach(([key, child]) => {
      if (key === 'kind' || key === 'isTemplate' || key === 'id' || key === 'diagnostics') {
        return
      }

      this.collect(child as TemplateValue, owningNode)
    })
  }

  private addEntry(node: TemplateASTNode, owningNode: MaterialisedASTNode): void {
    const entry: TemplateNodeEntry = { node, owningNode }

    this.addToIndex(this.kindIndex, node.kind, entry)
    this.addToIndex(this.familyIndex, astNodeFamily(node.kind), entry)
  }

  private addToIndex<TKey>(index: Map<TKey, TemplateNodeEntry[]>, key: TKey, entry: TemplateNodeEntry): void {
    let entries = index.get(key)

    if (!entries) {
      entries = []
      index.set(key, entries)
    }

    entries.push(entry)
  }
}
