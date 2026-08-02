const FRAME_PATTERN = /^\s+at /

const isInternalFrame = (frame: string): boolean =>
  frame.includes('node:') ||
  frame.includes('node_modules') ||
  frame.includes('forge-core/src') ||
  frame.includes('forge-core/dist') ||
  frame.includes('(<anonymous>)')

/**
 * Formats a captured callsite into a single author-facing "defined at" frame.
 * Frames inside forge-core, node internals, and node_modules are skipped
 * because registry handles are often invoked by forge-internal callers — the
 * author cares about the first frame in their own code. Reading `.stack` here
 * triggers V8's lazy trace formatting, so call this only at display time.
 */
export const formatCallsite = (callsite: { readonly stack?: string } | undefined): string | undefined => {
  const stack = callsite?.stack
  if (!stack) {
    return undefined
  }

  const frames = stack
    .split('\n')
    .filter(line => FRAME_PATTERN.test(line))
    .map(line => line.replace(FRAME_PATTERN, ''))

  if (frames.length === 0) {
    return undefined
  }

  return frames.find(frame => !isInternalFrame(frame)) ?? frames[0]
}
