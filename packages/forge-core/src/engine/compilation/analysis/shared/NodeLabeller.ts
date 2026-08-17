/** Any node that carries diagnostic info (both AST nodes and template nodes qualify). */
export interface LabelSource {
  readonly diagnostics?: {
    readonly source: { readonly formattedPath: string }
  }
}

/**
 * Turns a node's diagnostic path into a short dot-separated label used to
 * identify compiled output (e.g. in generated script URLs). Takes the leading
 * journey/step name segments from a formatted path like
 * `"dump > form > blocks[1] (govukInsetText) > hidden"` and produces
 * `dump.form`. Segments containing `[` or `(` (like `blocks[1]` or
 * `(govukInsetText)`) mark positions inside a step rather than its identity,
 * so they stop the walk. Nested journeys keep every ancestor name segment.
 * `maxDepth` caps the segment count for labels that only need journey-level
 * granularity (e.g. the field inventory).
 */
export default class NodeLabeller {
  labelFrom(nodes: readonly (LabelSource | undefined)[], options: { maxDepth?: number } = {}): string | undefined {
    const formattedPath = nodes.find(node => node?.diagnostics !== undefined)?.diagnostics?.source.formattedPath

    if (formattedPath === undefined) {
      return undefined
    }

    const identitySegments: string[] = []

    formattedPath
      .split(' > ')
      .slice(0, options.maxDepth ?? Number.POSITIVE_INFINITY)
      .some(segment => {
        if (segment.includes('[') || segment.includes('(')) {
          return true
        }

        identitySegments.push(segment.replace(/[^\w.-]+/g, '-'))

        return false
      })

    return identitySegments.length > 0 ? identitySegments.join('.') : undefined
  }
}
