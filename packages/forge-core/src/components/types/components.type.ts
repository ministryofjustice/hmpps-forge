import type { ZodType } from 'zod'
import type {
  BasicBlockProps,
  BlockDefinition,
  FieldBlockDefinition,
  FieldBlockProps,
  RenderedBlock,
  ResolvableProps,
} from './structures.type'

type MaybePromise<T> = T | Promise<T>

/**
 * Component registry entry
 *
 * All components have the same simple interface - a variant name and a render function.
 * The render output is intentionally adapter-specific: Nunjucks components return
 * strings, React components may return React nodes, and test components can return
 * whichever value the test needs.
 */
export interface ComponentRegistryEntry<TProps extends object = object, TRenderOutput = unknown> {
  variant: string
  render(props: TProps, renderer?: unknown): MaybePromise<TRenderOutput>

  /**
   * The shape of the submitted (post-normalise) value this component can legitimately
   * produce - a rendered text input can only ever submit a string. Anything failing the
   * schema did not come from the rendered form.
   */
  inputSchema?: ZodType

  /**
   * Whether the component keeps every submitted value rather than the first non-empty one.
   * Fixed-shape components such as checkboxes declare it here, so it is a component
   * property rather than an author decision.
   */
  multiple?: boolean

  /**
   * Derives the document anchor an error summary link should target when this
   * component's block fails validation. The component owns the ids it renders,
   * so only it can say where focus should land. Returning `undefined` (or not
   * declaring this) falls back to the field code.
   */
  errorAnchor?(props: TProps): string | undefined
}

type AuthorProps<TProps> = BasicBlockProps & ResolvableProps<TProps>

type FieldAuthorProps<TProps> = FieldBlockProps & ResolvableProps<TProps>

type ComponentBlock<TProps> = BlockDefinition & ResolvableProps<TProps>

type FieldComponentBlock<TProps> = FieldBlockDefinition & ResolvableProps<TProps>

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

export type FieldComponentRenderProps<TProps> = ComponentRenderProps<TProps> & {
  code: string
  errors?: { message: string; details?: Record<string, any> }[]
}

export interface ComponentOptions<TProps extends object, TOutput = string, TRenderer = unknown> {
  /** Turns the component's runtime props into rendered output. */
  render: (props: ComponentRenderProps<TProps>, renderer: TRenderer) => TOutput

  /** Adjusts authored props before Forge builds the block. */
  prepare?: (props: AuthorProps<TProps>) => AuthorProps<TProps>
}

/**
 * The extra options a field component supplies - a block that captures user input.
 *
 * @typeParam TProps - The plain props the component implementation consumes
 * @typeParam TOutput - What the component's render produces
 * @typeParam TRenderer - The renderer the framework adapter supplies at render time
 */
export interface FieldComponentOptions<TProps extends object, TOutput = string, TRenderer = unknown> {
  /** Turns the field's runtime props into rendered output. */
  render: (props: FieldComponentRenderProps<TProps>, renderer: TRenderer) => TOutput

  /** Adjusts authored props before Forge builds the field. */
  prepare?: (props: FieldAuthorProps<TProps>) => FieldAuthorProps<TProps>

  /**
   * Marks this as a field component, so the block it builds is stamped
   * `_forge: ComponentCallType.FIELD` and takes part in answer capture and validation.
   *
   * The literal selects the field overload, so callers receive field authoring props
   * while `render()` receives evaluated field runtime props.
   */
  field: true

  /**
   * The shape of the submitted (post-normalise) value this component can legitimately
   * produce - a rendered text input can only ever submit a string. Anything failing the
   * schema did not come from the rendered form.
   */
  inputSchema?: ZodType

  /**
   * Whether the component keeps every submitted value rather than the first non-empty
   * one. Declare it when the component's shape fixes it - checkboxes, for instance.
   */
  multiple?: boolean

  /**
   * Derives the document anchor an error summary link should target when this
   * component's block fails validation - the id of the control focus should land
   * on. Declare it whenever the component renders ids that can differ from the
   * field code (an `id` or `idPrefix` prop, a suffixed first input). Without it
   * the error summary links to the field code.
   *
   * @example
   * ```typescript
   * errorAnchor: props => props.idPrefix ?? props.code
   * ```
   */
  errorAnchor?: (props: FieldComponentRenderProps<TProps>) => string | undefined
}

// A type alias intersection rather than an interface with a call signature: JetBrains IDEs
// only render JSDoc tags on a const whose type resolves to something function-shaped.
type ComponentBuilder<TProps, TBlock> =
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- `{} extends X` is the every-prop-optional test
  {} extends TProps ? (props?: TProps) => TBlock : (props: TProps) => TBlock

/**
 * What `component()` returns: a builder an author calls with props to create a block,
 * which is simultaneously the registry entry the framework renders with.
 *
 * When every prop is optional the props argument is too, so an all-defaults component
 * can be built with a bare call - `GovUKSectionBreak()`.
 *
 * @typeParam TProps - The plain props the component implementation consumes
 * @typeParam TOutput - What the component's render produces
 */
export type ForgeComponent<TProps extends object, TOutput = string> = ComponentBuilder<
  AuthorProps<TProps>,
  ComponentBlock<TProps>
> &
  ComponentRegistryEntry<ComponentRenderProps<TProps>, TOutput>

export type ForgeFieldComponent<TProps extends object, TOutput = string> = ComponentBuilder<
  FieldAuthorProps<TProps>,
  FieldComponentBlock<TProps>
> &
  ComponentRegistryEntry<FieldComponentRenderProps<TProps>, TOutput>

/** A renderer-pinned form of {@link component}. */
export interface ComponentFactory<TOutput, TRenderer> {
  <TProps extends object>(
    variant: string,
    options: FieldComponentOptions<TProps, TOutput, TRenderer>,
  ): ForgeFieldComponent<TProps, TOutput>

  <TProps extends object>(
    variant: string,
    options: ComponentOptions<TProps, TOutput, TRenderer>,
  ): ForgeComponent<TProps, TOutput>
}
