import type { ForgeRenderer } from '@ministryofjustice/hmpps-forge/core/framework'

/** Supplies page rendering and the dependencies needed by component renderers. */
export interface BrowserRenderingEngine extends ForgeRenderer<string> {
  getAdapterDependencies(): object
}
