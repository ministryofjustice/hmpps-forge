import type { BasicBlockProps, RenderedBlockShape } from './structures.type'

type RenderProps<TProps> = {
  [K in keyof TProps]: RenderedBlockShape<TProps[K]>
}

/**
 * What a component's render receives. Plain props pass through unchanged except
 * for nested blocks, which the engine replaces with `RenderedBlock`. Fields also
 * receive their evaluated `code`, `value` and `errors`.
 */
export type ComponentRenderProps<TProps> = RenderProps<TProps> &
  Pick<BasicBlockProps, 'metadata'> & {
    /** The current display value when these props belong to a field component. */
    value?: unknown
  }

/** Renderer props after Forge resolves expressions and replaces any nested blocks. */
export type RendererProps<TProps> = RenderProps<TProps>

/**
 * Resolved field component props, including the answer key, current display
 * value, and any validation failures belonging to this block.
 */
export type FieldComponentRenderProps<TProps> = ComponentRenderProps<TProps> & {
  /** The answer key declared by the field block. */
  code: string

  /** Validation failures currently displayed for this field block. */
  errors?: {
    /** The author-facing validation message to render. */
    message: string

    /** Optional structured details supplied by the validation failure. */
    details?: Record<string, unknown>
  }[]
}
