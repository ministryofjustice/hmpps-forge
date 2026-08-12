const FRAME_PATTERN = /^\s+at /

const MAX_CHAIN_LENGTH = 3

export const isInternalFrame = (frame: string): boolean =>
  frame.includes('node:') ||
  frame.includes('node_modules') ||
  frame.includes('forge-core/src') ||
  frame.includes('forge-core/dist') ||
  frame.includes('forge:compiled/') ||
  frame.includes('(<anonymous>)')

// Bundler module-wiring helpers (esbuild's __init/__require, webpack's require) —
// shared by every definition in a module, so they never distinguish one.
const BUNDLER_HELPER_PATTERN = /^(?:__init|__require|__commonJS|__esm|__toESM|__webpack_require__) /

/**
 * Formats a captured callsite into the chain of author-facing "defined at"
 * frames, innermost first. Frames inside forge-core, node internals, and
 * node_modules are skipped because registry handles are often invoked by
 * forge-internal callers. The chain keeps walking past frames in the capture
 * site's file (wrapper DSL utilities produce several), stops once it has the
 * first frame from a different file, and caps at three entries — enough to
 * read past a wrapper layer to the author's own file without printing the
 * whole capture. Reading `.stack` here triggers V8's lazy trace formatting,
 * so call this only at display time.
 */
export const formatCallsiteChain = (callsite: { readonly stack?: string } | undefined): string[] => {
  const stack = callsite?.stack
  if (!stack) {
    return []
  }

  const frames = stack
    .split('\n')
    .filter(line => FRAME_PATTERN.test(line))
    .map(line => line.replace(FRAME_PATTERN, ''))

  if (frames.length === 0) {
    return []
  }

  const authorFrames = frames.filter(frame => !isInternalFrame(frame) && !BUNDLER_HELPER_PATTERN.test(frame))

  if (authorFrames.length === 0) {
    return [frames[0]]
  }

  const captureSiteFile = frameFile(authorFrames[0])
  const chain: string[] = []

  authorFrames.some(frame => {
    chain.push(collapseModuleNamedFrame(frame))

    return chain.length >= MAX_CHAIN_LENGTH || frameFile(frame) !== captureSiteFile
  })

  return chain
}

// V8 names top-level module frames by module id — `server/forms/index.ts
// (/app/server/forms/index.ts:40:40)` — so the name restates the path. Collapse
// those to the bare location, matching the anonymous-frame grammar.
const collapseModuleNamedFrame = (frame: string): string => {
  const match = /^(.+) \((.+):(\d+:\d+)\)$/.exec(frame)

  if (match === null) {
    return frame
  }

  const [, name, file, position] = match

  return file.endsWith(name) ? `${file}:${position}` : frame
}

/**
 * Formats a captured callsite into the single innermost author-facing frame —
 * the first entry of `formatCallsiteChain`.
 */
export const formatCallsite = (callsite: { readonly stack?: string } | undefined): string | undefined => {
  const chain = formatCallsiteChain(callsite)

  return chain.length > 0 ? chain[0] : undefined
}

const frameFile = (frame: string): string => {
  const location = /\((.+)\)$/.exec(frame)?.[1] ?? frame

  return location.replace(/:\d+:\d+$/, '')
}
