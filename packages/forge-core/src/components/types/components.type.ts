import type { BasicBlockProps, RenderedBlockShape } from './structures.type'

type RenderProps<TProps> = {
  [K in keyof TProps]: RenderedBlockShape<TProps[K]>
}

/**
 * What a component's render receives. Plain props pass through unchanged except
 * for nested blocks, which the engine replaces with `RenderedBlock`. Fields also
 * receive their evaluated `code`, `value` and `errors`.
 */
export type ComponentRenderProps<TProps> = RenderProps<TProps> & Pick<BasicBlockProps, 'metadata'> & { value?: unknown }

export type RendererProps<TProps> = RenderProps<TProps>

export type FieldComponentRenderProps<TProps> = ComponentRenderProps<TProps> & {
  code: string
  errors?: { message: string; details?: Record<string, unknown> }[]
}
