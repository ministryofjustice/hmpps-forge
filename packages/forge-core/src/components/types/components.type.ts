import type { BasicBlockProps, BlockDefinition, RenderedBlock } from './structures.type'

type IsAny<T> = 0 extends 1 & T ? true : false

type RenderValue<T> =
  IsAny<T> extends true
    ? T
    : T extends BlockDefinition
      ? RenderedBlock
      : T extends (...args: never[]) => unknown
        ? T
        : T extends readonly (infer TItem)[]
          ? RenderValue<TItem>[]
          : T extends object
            ? { [K in keyof T]: RenderValue<T[K]> }
            : T

type RenderProps<TProps> = {
  [K in keyof TProps]: RenderValue<TProps[K]>
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
