import { AstNodeId, NodeId, TemplateNodeId } from '../../contracts/ast/engine.type'

/**
 * Separate ID namespaces make it obvious whether a node is part of the shared
 * compiled AST or a frozen iterator template.
 */
export enum NodeIDCategory {
  COMPILE_AST = 'compile_ast',
  TEMPLATE = 'template',
}

/**
 * Generates deterministic compile-time IDs for the shared AST and templates.
 */
export class NodeIDGenerator {
  private readonly counters = new Map<NodeIDCategory, number>([
    [NodeIDCategory.COMPILE_AST, 0],
    [NodeIDCategory.TEMPLATE, 0],
  ])

  /**
   * Each category advances independently so template creation cannot perturb the
   * IDs used by registered AST nodes and runtime plans.
   */
  next(category: NodeIDCategory.TEMPLATE): TemplateNodeId

  next(category: NodeIDCategory.COMPILE_AST): AstNodeId

  next(category: NodeIDCategory): NodeId | TemplateNodeId {
    const current = this.counters.get(category)!
    const next = current + 1

    this.counters.set(category, next)

    return `${category}:${next}`
  }

  /**
   * Clones keep branch-local compilation deterministic while allowing each clone
   * to continue assigning IDs independently.
   */
  clone(): NodeIDGenerator {
    const cloned = Object.create(Object.getPrototypeOf(this)) as NodeIDGenerator

    return Object.assign(cloned, {
      counters: new Map(this.counters),
    })
  }
}
