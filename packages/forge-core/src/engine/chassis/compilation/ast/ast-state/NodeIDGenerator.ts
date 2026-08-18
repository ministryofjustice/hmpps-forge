import { AstNodeId, TemplateNodeId } from '../../../contracts/ast/engine.type'

/**
 * Separate ID namespaces keep shared AST IDs deterministic while template
 * compilation creates stable runtime instance ID prefixes.
 */
type NodeIDCounterName = 'compile_ast' | 'template'

/**
 * Generates deterministic compile-time IDs for the shared AST and templates.
 */
export class NodeIDGenerator {
  private readonly counters = new Map<NodeIDCounterName, number>([
    ['compile_ast', 0],
    ['template', 0],
  ])

  /**
   * AST IDs are used by registered AST nodes and runtime plans.
   */
  nextAstNodeId(): AstNodeId {
    return this.next('compile_ast') as AstNodeId
  }

  /**
   * Template IDs become the stable prefix for generated collection block IDs.
   */
  nextTemplateNodeId(): TemplateNodeId {
    return this.next('template') as TemplateNodeId
  }

  private next(counterName: NodeIDCounterName): string {
    const current = this.counters.get(counterName)!
    const next = current + 1

    this.counters.set(counterName, next)

    return `${counterName}:${next}`
  }
}
