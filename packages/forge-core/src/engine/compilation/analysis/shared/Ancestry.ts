import type { ASTNode } from '../../../contracts/ast/ast.type'

/**
 * Provides three ways to walk the `parent` chain of an AST node (the tree
 * of journey/step/block nodes built during parsing). Every ancestor lookup
 * in analysis goes through one of these methods — no analyzer walks the
 * chain manually.
 */
export default class Ancestry {
  /**
   * Walks from the root ancestor down to `node` (inclusive), calling `extract`
   * on each. Returns the non-`undefined` results in root-first order, so a
   * descendant's value appears after (and can override) its ancestors'.
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

  /** Ancestors matching the type-guard predicate, root-first, excluding the node itself. */
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
