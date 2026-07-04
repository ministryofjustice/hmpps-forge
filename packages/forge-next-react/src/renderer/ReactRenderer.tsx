import { Fragment, isValidElement } from 'react'
import type { ReactNode } from 'react'
import type {
  BlockDefinition,
  ComponentRegistryEntry,
  EvaluatedBlock,
} from '@ministryofjustice/hmpps-forge/core/components'
import type { ForgeRenderer, RenderContext } from '@ministryofjustice/hmpps-forge/core/framework'

/**
 * Snapshot state key carrying the per-request form action (a path string or a
 * server action) from the adapter to {@link ReactRenderer.assemblePage}.
 */
export const FORGE_REACT_ACTION = 'forgeReactAction'

export interface ReactRenderedBlock {
  block: BlockDefinition
  node: ReactNode
}

export interface ReactPageRenderContext {
  context: RenderContext
  blocks: ReactNode[]
  action: ReactFormAction
}

export type ReactFormAction = string | ((_formData: FormData) => Promise<void> | void)

export type ReactPageRenderer = (_context: ReactPageRenderContext) => ReactNode

export interface ReactRendererOptions {
  page?: ReactPageRenderer
  rendererContext?: unknown
}

/**
 * The React rendering backend. The engine owns the block walk and drives this
 * renderer through `forge.execute`; this class owns only the React-specific
 * parts: component rendering, nested-block wrapping, and page assembly.
 *
 * Core's built-in components (`html`, `collectionBlock`, `templateWrapper`)
 * read nested output as HTML strings and are not supported by this renderer.
 */
export class ReactRenderer implements ForgeRenderer<ReactNode> {
  private readonly page: ReactPageRenderer

  private readonly rendererContext?: unknown

  constructor(options: ReactRendererOptions = {}) {
    this.page = options.page ?? renderDefaultPage
    this.rendererContext = options.rendererContext
  }

  /** Render a single block to a React node via its component. */
  async renderBlock(
    entry: ComponentRegistryEntry<BlockDefinition, ReactNode>,
    block: EvaluatedBlock<BlockDefinition>,
  ): Promise<ReactNode> {
    const rendered = await entry.render(block, this.rendererContext)

    if (!isReactNodeValue(rendered)) {
      throw new Error(`Component variant "${entry.variant}" must render a React node for the Next React adapter.`)
    }

    return <Fragment key={this.resolveBlockKey(block)}>{rendered}</Fragment>
  }

  /** Wrap a rendered child as ReactRenderedBlock format (block metadata + node) */
  wrapNestedBlock(block: BlockDefinition, output: ReactNode): ReactRenderedBlock {
    return { block, node: output }
  }

  /** Assemble the full page, resolving the form action from the snapshot state */
  assemblePage(
    context: RenderContext,
    renderedBlocks: readonly ReactNode[],
    requestState: Record<string, unknown>,
  ): ReactNode {
    const stateAction = requestState[FORGE_REACT_ACTION]
    const action = isReactFormAction(stateAction) ? stateAction : context.step.path

    return this.page({ context, blocks: [...renderedBlocks], action })
  }

  private resolveBlockKey(block: EvaluatedBlock<BlockDefinition>): string | undefined {
    const keyedBlock = block as { id?: unknown; nodeId?: unknown }
    const key = keyedBlock.id ?? keyedBlock.nodeId

    return typeof key === 'string' ? key : undefined
  }
}

function renderDefaultPage({ context, blocks, action }: ReactPageRenderContext): ReactNode {
  const title = context.step.title ?? 'Forge'

  return <html lang="en">
    <head>
      <title>{title}</title>
    </head>
    <body>
      <main>
        <h1>{title}</h1>
        <form method="post" action={action}>
          {blocks}
        </form>
      </main>
    </body>
  </html>
}

function isReactFormAction(value: unknown): value is ReactFormAction {
  return typeof value === 'string' || typeof value === 'function'
}

export type ReactComponentRenderer<T extends BlockDefinition> = (
  _block: EvaluatedBlock<T>,
) => ReactNode | Promise<ReactNode>

export const buildReactComponent = <T extends BlockDefinition>(
  variant: string,
  render: ReactComponentRenderer<T>,
): ComponentRegistryEntry<T, ReactNode> => ({
  variant,
  render: block => render(block),
})

function isReactNodeValue(value: unknown): value is ReactNode {
  if (value === undefined || value === null) {
    return true
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true
  }

  if (isValidElement(value)) {
    return true
  }

  if (Array.isArray(value)) {
    return value.every(isReactNodeValue)
  }

  return false
}
