import createHttpError from 'http-errors'
import type { ForgeRenderer } from '../../../../framework/rendering/types'
import type { ComponentRegistry } from '../../../../framework/types/adapter.type'
import { evaluateRenderOutput } from '../phases/evaluateRenderOutput'
import type { TerminalPhase } from '../types'

/**
 * Builds the terminal render-output phase for a step: it reads the hydrated
 * RenderContext the render-evaluation phase stored on the pipeline state,
 * drives the bound renderer block by block, assembles the page, and produces
 * the render ForgeResult. Without a bound renderer the result is context-only —
 * the test harness path.
 */
export function createRenderOutputTerminal<TOut>(
  componentRegistry: ComponentRegistry,
  renderer: ForgeRenderer<TOut> | undefined,
): TerminalPhase<TOut> {
  return {
    name: 'render-output',
    async execute(state) {
      const context = state.renderContext

      if (!context) {
        throw createHttpError(500, 'No render context on pipeline state: render-evaluation phase did not run')
      }

      if (!renderer) {
        // A Forge without a renderer is Forge<undefined>; the type system
        // cannot express that linkage, hence the cast.
        return { type: 'render', context, output: undefined as TOut, renderedBlocks: [] }
      }

      const renderedBlocks = evaluateRenderOutput(context, componentRegistry, renderer, state.trace)
      const output = renderer.assemblePage(context, renderedBlocks, state.request.getAllState())

      return { type: 'render', context, output, renderedBlocks }
    },
  }
}
