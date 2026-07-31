import type { ZodType } from 'zod'
import type { BlockDefinition, EvaluatedBlock, FieldBlockDefinition } from './structures.type'

type MaybePromise<T> = T | Promise<T>

/**
 * Component render function
 *
 * Components are functions that take an evaluated block and an optional renderer,
 * returning framework-specific output. The optional `renderer` parameter allows
 * framework adapters to inject rendering dependencies at render time.
 *
 * @param block - The evaluated block with resolved properties
 * @param renderer - Optional renderer provided by the framework adapter
 * @returns Rendered component output
 *
 * @example
 * ```typescript
 * // Simple component (no renderer needed)
 * const htmlComponent: ComponentRenderer<HtmlBlock, string> = block => block.content
 *
 * // Template-based component (uses renderer)
 * const textInput: ComponentRenderer<TextInputBlock, string> = (block, renderer) => {
 *   const nunjucksEnv = renderer as nunjucks.Environment
 *   return nunjucksEnv.render('govuk/components/input/template.njk', { params })
 * }
 * ```
 */
export type ComponentRenderer<T extends BlockDefinition, TRenderOutput = unknown> = (
  block: EvaluatedBlock<T>,
  renderer?: unknown,
) => MaybePromise<TRenderOutput>

/**
 * Component registry entry
 *
 * All components have the same simple interface - a variant name and a render function.
 * The render output is intentionally adapter-specific: Nunjucks components return
 * strings, React components may return React nodes, and test components can return
 * whichever value the test needs.
 */
export interface ComponentRegistryEntry<T extends BlockDefinition, TRenderOutput = unknown> {
  variant: string
  render(block: EvaluatedBlock<T>, renderer?: unknown): MaybePromise<TRenderOutput>

  /**
   * Type-inference marker only - never set at runtime. Gives generic consumers a bare
   * `T` position to infer from (`EvaluatedBlock<T>` is a conditional type TS cannot invert).
   */
  readonly __block?: T

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
}

/**
 * The keys `component()` stamps onto every block it builds. Authors never supply
 * them, so they are stripped from the props a component accepts.
 */
type ComponentDiscriminatorKey = 'type' | 'variant' | 'blockType'

/**
 * The props an author writes for a block - everything on the block definition except
 * the `type`, `variant` and `blockType` keys that `component()` stamps automatically.
 * Optionality and JSDoc carry through from the block interface.
 */
export type PropsOf<TBlock> = {
  [K in keyof TBlock as K extends ComponentDiscriminatorKey ? never : K]: TBlock[K]
}

/**
 * The framework-declared keys render props keep. Everything else on the base
 * block definitions is consumed by the engine before render.
 */
type RenderKeptKey = 'code' | 'metadata'

/**
 * What a component's render receives - the evaluated block minus the keys the
 * engine has already consumed. `code`, `metadata`, `value` and `errors` come through.
 */
export type ResolvedPropsOf<TBlock> = {
  [K in keyof EvaluatedBlock<TBlock> as K extends Exclude<keyof FieldBlockDefinition, RenderKeptKey>
    ? never
    : K]: EvaluatedBlock<TBlock>[K]
}

/**
 * The options every component supplies.
 *
 * @typeParam TBlock - The component's block definition interface
 * @typeParam TOutput - What the component's render produces
 * @typeParam TRenderer - The renderer the framework adapter supplies at render time
 */
export interface BaseComponentOptions<TBlock extends BlockDefinition, TOutput, TRenderer> {
  /**
   * Turns the block's render props into rendered output.
   *
   * The framework adapter supplies its renderer as the second argument - the
   * Express/Nunjucks adapter passes a `nunjucks.Environment`.
   *
   * @example
   * ```typescript
   * render: (props, nunjucksEnv) =>
   *   nunjucksEnv.render('components/card.njk', { params: { text: props.title } })
   * ```
   */
  render: (props: ResolvedPropsOf<TBlock>, renderer: TRenderer) => TOutput

  /**
   * Adjusts the props an author wrote before the block is built from them. Runs each time
   * the builder is called. Use it for props the component supplies itself - a date input
   * prepending its ISO `formatters`, for instance.
   *
   * @example
   * ```typescript
   * prepare: props => ({
   *   ...props,
   *   formatters: [Transformer.Object.ToISO(datePaths), ...(props.formatters ?? [])],
   * })
   * ```
   */
  prepare?: (props: PropsOf<TBlock>) => PropsOf<TBlock>
}

/**
 * The extra options a field component supplies - a block that captures user input.
 *
 * @typeParam TBlock - The component's block definition interface
 * @typeParam TOutput - What the component's render produces
 * @typeParam TRenderer - The renderer the framework adapter supplies at render time
 */
export interface FieldComponentOptions<TBlock extends BlockDefinition, TOutput, TRenderer> extends BaseComponentOptions<
  TBlock,
  TOutput,
  TRenderer
> {
  /**
   * Marks this as a field component, so the block it builds is stamped
   * `blockType: BlockType.FIELD` and takes part in answer capture and validation.
   *
   * Required when the block interface extends {@link FieldBlockDefinition} and rejected
   * when it does not - interfaces are erased at runtime, so field-ness has to be declared
   * somewhere the runtime can see it.
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
}

/**
 * The options `component()` accepts: the field options when the block interface is a
 * field block, the base options otherwise.
 *
 * @typeParam TBlock - The component's block definition interface
 * @typeParam TOutput - What the component's render produces
 * @typeParam TRenderer - The renderer the framework adapter supplies at render time
 */
export type ComponentOptions<
  TBlock extends BlockDefinition,
  TOutput = string,
  TRenderer = unknown,
> = TBlock extends FieldBlockDefinition
  ? FieldComponentOptions<TBlock, TOutput, TRenderer>
  : BaseComponentOptions<TBlock, TOutput, TRenderer>

// A type alias intersection rather than an interface with a call signature: JetBrains IDEs
// only render JSDoc tags on a const whose type resolves to something function-shaped.
/**
 * What `component()` returns: a builder an author calls with props to create a block,
 * which is simultaneously the registry entry the framework renders with.
 *
 * @typeParam TBlock - The component's block definition interface
 * @typeParam TOutput - What the component's render produces
 */
export type ForgeComponent<TBlock extends BlockDefinition, TOutput = string> = ((props: PropsOf<TBlock>) => TBlock) &
  ComponentRegistryEntry<TBlock, TOutput>
