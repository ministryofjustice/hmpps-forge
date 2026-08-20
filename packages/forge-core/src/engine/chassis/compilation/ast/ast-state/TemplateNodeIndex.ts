import type { ASTNode } from '../../../contracts/ast/engine.type'
import type { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import { isTemplateNode } from '../../../contracts/ast/nodes'
import type { IndexableNodeType } from './ASTNodeIndex'

export interface TemplateNodeEntry {
  readonly node: TemplateNode
  /** The registered node whose property carries the template — the iterate expression node today. */
  readonly owningNode: ASTNode
}

/**
 * Groups template node contents by original type and sub-type — `ASTNodeIndex`'s
 * sibling for the unmaterialised side of the tree.
 *
 * Template contents never enter `ASTNodeIndex`: analysis and lowering must not
 * treat them as materialised nodes. Semantic analysis still has to check them,
 * so this index answers the same broad by-type questions over template contents
 * without each rule re-walking every iterator template.
 */
export default class TemplateNodeIndex {
  private readonly typeIndex: Map<string, TemplateNodeEntry[]> = new Map()

  /**
   * Register every template node reachable from a template value, including
   * the contents of nested iterator templates, against the registered node
   * that owns the outermost template.
   */
  registerTree(template: TemplateValue, owningNode: ASTNode): void {
    this.collect(template, owningNode)
  }

  findByType(type: IndexableNodeType): TemplateNodeEntry[] {
    return [...(this.typeIndex.get(type) ?? [])]
  }

  private collect(value: TemplateValue, owningNode: ASTNode): void {
    if (value === null || value === undefined || typeof value !== 'object') {
      return
    }

    if (Array.isArray(value)) {
      value.forEach(item => this.collect(item, owningNode))

      return
    }

    if (isTemplateNode(value)) {
      this.addEntry(value, owningNode)
      this.collectTemplateNodeChildren(value, owningNode)

      return
    }

    Object.values(value).forEach(child => this.collect(child, owningNode))
  }

  private collectTemplateNodeChildren(node: TemplateNode, owningNode: ASTNode): void {
    Object.entries(node).forEach(([key, child]) => {
      if (key === 'type' || key === 'originalType' || key === 'id' || key === 'diagnostics') {
        return
      }

      this.collect(child as TemplateValue, owningNode)
    })
  }

  private addEntry(node: TemplateNode, owningNode: ASTNode): void {
    const entry: TemplateNodeEntry = { node, owningNode }

    this.addToTypeIndex(node.originalType, entry)

    const subType = this.templateNodeSubType(node)

    if (subType !== undefined) {
      this.addToTypeIndex(subType, entry)
    }
  }

  private addToTypeIndex(type: string, entry: TemplateNodeEntry): void {
    let entries = this.typeIndex.get(type)

    if (!entries) {
      entries = []
      this.typeIndex.set(type, entries)
    }

    entries.push(entry)
  }

  /** Template nodes keep their family sub-type fields, so the same sub-type indexing as `ASTNodeIndex` applies. */
  private templateNodeSubType(node: TemplateNode): string | undefined {
    const subType = node.expressionType ?? node.predicateType ?? node.hookType ?? node.outcomeType ?? node.blockType

    return typeof subType === 'string' ? subType : undefined
  }
}
