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

  const frames = extractFrames(stack)

  if (frames.length === 0) {
    return []
  }

  const chainFrames = selectAuthorChainFrames(frames)

  if (chainFrames.length === 0) {
    return [frames[0]]
  }

  return chainFrames.map(collapseModuleNamedFrame)
}

const extractFrames = (stack: string): string[] =>
  stack
    .split('\n')
    .filter(line => FRAME_PATTERN.test(line))
    .map(line => line.replace(FRAME_PATTERN, ''))

/**
 * The author-facing chain frames, innermost first: walks past frames in the
 * capture site's file, stops after the first frame from a different file,
 * caps at `MAX_CHAIN_LENGTH`.
 */
const selectAuthorChainFrames = (frames: string[]): string[] => {
  const authorFrames = frames.filter(frame => !isInternalFrame(frame) && !BUNDLER_HELPER_PATTERN.test(frame))

  if (authorFrames.length === 0) {
    return []
  }

  const captureSiteFile = frameFile(authorFrames[0])
  const chain: string[] = []

  authorFrames.some(frame => {
    chain.push(frame)

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

export interface CallsitePosition {
  readonly file: string
  readonly line: number
  readonly column: number
}

/**
 * Resolves a captured callsite to the structured positions (1-based line and
 * column) of the author chain frames `formatCallsiteChain` renders, innermost
 * first. Every chain frame is a legitimate breakpoint home: a node built
 * inside a shared wiring helper is "defined at" both the helper's line and
 * the line that called the helper. Unlike the display formatters there is no
 * fallback to an internal frame when every frame is filtered — a source-map
 * entry pointing into forge internals is worse than none. Reading `.stack`
 * triggers V8's lazy trace formatting, so call this at codegen time only.
 */
export const resolveCallsitePositionChain = (callsite: { readonly stack?: string } | undefined): CallsitePosition[] => {
  const stack = callsite?.stack
  if (!stack) {
    return []
  }

  return selectAuthorChainFrames(extractFrames(stack))
    .map(parseFramePosition)
    .filter(position => position !== undefined)
}

const parseFramePosition = (frame: string): CallsitePosition | undefined => {
  const location = /\((.+)\)$/.exec(frame)?.[1] ?? frame
  const match = /^(.+):(\d+):(\d+)$/.exec(location)

  if (match === null) {
    return undefined
  }

  return { file: match[1], line: Number(match[2]), column: Number(match[3]) }
}

const frameFile = (frame: string): string => {
  const location = /\((.+)\)$/.exec(frame)?.[1] ?? frame

  return location.replace(/:\d+:\d+$/, '')
}
