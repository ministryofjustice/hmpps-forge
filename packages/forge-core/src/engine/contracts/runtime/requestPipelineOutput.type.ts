import type { RenderContext } from '../../../framework/types/rendering.type'

/**
 * Uniform per-phase result. The `request.pipeline` first-match drain halts on the
 * first phase whose `action !== 'continue'`. `render` is terminal: it carries the
 * built `RenderContext` the pipeline surfaces as the run's outcome.
 */
export type PhaseWorkOutput =
  | { readonly action: 'continue' }
  | { readonly action: 'render'; readonly renderContext: RenderContext; readonly output?: unknown }
  | { readonly action: 'halt-redirect'; readonly target: string; readonly reason: string }
  | { readonly action: 'halt-error'; readonly status: number; readonly message: string }

/**
 * Output of the `request.pipeline` work handler — the resolved outcome of the run, also
 * published to the shared state. `RequestPipeline.buildOutcome` turns it into the terminal
 * `ForgeOutcome` (resolving redirect targets to URLs).
 */
export type RequestPipelineResult =
  | { readonly kind: 'render'; readonly context: RenderContext; readonly output?: unknown }
  | { readonly kind: 'redirect'; readonly target: string }
  | { readonly kind: 'error'; readonly status: number; readonly message: string }
