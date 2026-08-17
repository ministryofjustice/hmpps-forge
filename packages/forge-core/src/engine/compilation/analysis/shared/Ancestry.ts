import type { ASTNode } from '../../../contracts/ast/ast.type'

/**
 * Names the three inheritance patterns the analyzers ask of the registered
 * AST's `parent` chain. Every ancestor question in analysis goes
 * through one of these — no analyzer hand-rolls its own chain walk.
 */
export default class Ancestry {
  /**
   * Values extracted along the node's chain, root-first and including the node
   * itself, so a descendant's value lands after (and can override) its
   * ancestors'. Extractions returning `undefined` are skipped.
   */
  valuesRootFirst<TValue>(node: ASTNode, extract: (ancestor: ASTNode) => TValue | undefined): TValue[] {
    return this.chainRootFirst(node).flatMap(ancestor => {
      const value = extract(ancestor)

      return value === undefined ? [] : [value]
    })
  }

  /**
   * The nearest configured setting, starting at the node itself and walking
   * outward. `undefined` when nothing along the chain sets one.
   */
  nearestAncestorSetting<TValue>(
    node: ASTNode,
    extract: (ancestor: ASTNode) => TValue | undefined,
  ): TValue | undefined {
    let current: ASTNode | undefined = node

    while (current !== undefined) {
      const value = extract(current)

      if (value !== undefined) {
        return value
      }

      current = current.parent
    }

    return undefined
  }

  /** Ancestors matching the guard, root-first, excluding the node itself. */
  ancestorsOfType<TNode extends ASTNode>(node: ASTNode, predicate: (ancestor: ASTNode) => ancestor is TNode): TNode[] {
    return this.chainRootFirst(node).slice(0, -1).filter(predicate)
  }

  private chainRootFirst(node: ASTNode): ASTNode[] {
    const chain: ASTNode[] = []
    let current: ASTNode | undefined = node

    while (current !== undefined) {
      chain.unshift(current)
      current = current.parent
    }

    return chain
  }
}
