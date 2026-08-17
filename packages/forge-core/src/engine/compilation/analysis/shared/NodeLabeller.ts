/** Anything carrying authored diagnostics — AST and template nodes both conform. */
export interface LabelSource {
  readonly diagnostics?: {
    readonly source: { readonly formattedPath: string }
  }
}

/**
 * Derives the script-URL identity segment stamped on each concern model. The
 * leading journey/step segments of a formatted path such as
 * `"dump > form > blocks[1] (govukInsetText) > hidden"` become `dump.form`.
 * Structural segments (indexed wiring like `onAccess[0]`, parenthesised kinds)
 * end the walk — they describe a position inside the step, not its identity —
 * so nested journeys keep every ancestor segment without needing a depth cap.
 * `maxDepth` truncates deliberately journey-level labels (e.g. field inventory).
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
