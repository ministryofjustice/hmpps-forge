import type { ZodType } from 'zod'
import type { ComponentCallType, FunctionEntryType } from '../../shared/taxonomy'
import type { FunctionEntry } from '../../authoring/types/functions.type'
import type { RenderContext } from '../../framework/types/rendering.type'
import type { ComponentRenderProps, FieldComponentRenderProps, RendererProps } from './components.type'
import type {
  BasicBlockProps,
  BlockDefinition,
  FieldBlockDefinition,
  FieldBlockProps,
  RenderedBlockShape,
  ResolvableProps,
} from './structures.type'

/** The request and journey state available while Forge renders a step. */
export interface RendererFunctionContext {
  /** Identifies this as the context for a step renderer. */
  readonly kind: 'step'

  /** The step currently being rendered, including its authored configuration. */
  readonly step: RenderContext['step']

  /** The journey structures containing the current step, nearest ancestor first. */
  readonly ancestors: RenderContext['ancestors']

  /** The compiled route tree for the registered journey. */
  readonly routeTree: RenderContext['routeTree']

  /** Whether the current render should display validation failures. */
  readonly showValidationFailures: boolean

  /** Validation failures associated with individual field blocks. */
  readonly fieldValidationErrors: RenderContext['fieldValidationErrors']

  /** Validation failures associated with the wider journey domain. */
  readonly domainValidationErrors: RenderContext['domainValidationErrors']

  /** Answers available to the current request after parsing and preparation. */
  readonly answers: RenderContext['answers']

  /** Data loaded for the current request. */
  readonly data: RenderContext['data']

  /** Adapter-owned values attached to the current request, such as a CSRF token. */
  readonly requestState: Record<string, unknown>
}

/** A presentation evaluator created from the dependencies resolved for one request. */
export type RenderFunctionEvaluator<TArguments extends unknown[]> = (...args: TArguments) => unknown

/**
 * Options for a presentational component that does not collect an answer.
 *
 * @typeParam TProps - The plain props received by the evaluator after resolution
 * @typeParam TDeps - The package dependencies received by `factory`
 */
export interface ComponentOptions<TProps extends object, TDeps> {
  /**
   * Builds the component evaluator used for the current request.
   *
   * @param deps - The package dependencies resolved for this request
   * @returns An evaluator that receives the resolved component props
   */
  readonly factory: (deps: TDeps) => RenderFunctionEvaluator<[props: ComponentRenderProps<TProps>]>

  /**
   * Adjusts authored props when the component builder is called. This runs while
   * building the journey definition, not while rendering a request.
   *
   * @param props - The authored, expression-aware component props
   * @returns The props Forge should store in the block definition
   */
  readonly prepare?: (props: BasicBlockProps & ResolvableProps<TProps>) => BasicBlockProps & ResolvableProps<TProps>
}

/**
 * Options for a component that collects and renders a field answer.
 *
 * The evaluator receives the resolved component props together with Forge's
 * `code`, current `value`, and validation `errors` field props.
 *
 * @typeParam TProps - The plain visual props received by the evaluator after resolution
 * @typeParam TDeps - The package dependencies received by `factory`
 */
export interface FieldComponentOptions<TProps extends object, TDeps> {
  /**
   * Builds the field component evaluator used for the current request.
   *
   * @param deps - The package dependencies resolved for this request
   * @returns An evaluator that receives resolved props including `code`, `value`, and `errors`
   */
  readonly factory: (deps: TDeps) => RenderFunctionEvaluator<[props: FieldComponentRenderProps<TProps>]>

  /** Marks this declaration as a field component that collects an answer. */
  readonly field: true

  /**
   * Validates the normalised submitted value before Forge records it or runs
   * formatters. Invalid input is replaced with the field's empty value.
   */
  readonly inputSchema?: ZodType

  /** Treats the submitted and stored answer as a list of values. */
  readonly multiple?: boolean

  /**
   * Chooses the element ID that validation summaries link to. Forge uses the
   * field code when this is omitted.
   *
   * @param props - The resolved field render props, including `code`, `value`, and `errors`
   */
  readonly errorAnchor?: (props: FieldComponentRenderProps<TProps>) => string | undefined

  /**
   * Adjusts authored props when the field builder is called. This runs while
   * building the journey definition, not while rendering a request.
   *
   * @param props - The authored field props, including Forge's field configuration
   * @returns The props Forge should store in the field block definition
   */
  readonly prepare?: (props: FieldBlockProps & ResolvableProps<TProps>) => FieldBlockProps & ResolvableProps<TProps>
}

/**
 * Options for a renderer that composes a step from its rendered block structure.
 *
 * The request evaluator receives `blocks`, `props`, and `context` in that order:
 * the rendered block structure, the resolved renderer props, and the current
 * request's broad renderer context.
 *
 * @typeParam TProps - The plain renderer props received after resolution
 * @typeParam TBlocks - The authored structure of the step's `blocks` property
 * @typeParam TContext - The renderer context exposed to the evaluator
 * @typeParam TDeps - The package dependencies received by `factory`
 */
export interface RendererOptions<TProps extends object, TBlocks, TContext extends RendererFunctionContext, TDeps> {
  /**
   * Builds the renderer evaluator used for the current request.
   *
   * @param deps - The package dependencies resolved for this request
   * @returns An evaluator receiving rendered `blocks`, resolved `props`, and the request `context`
   */
  readonly factory: (
    deps: TDeps,
  ) => RenderFunctionEvaluator<[blocks: RenderedBlockShape<TBlocks>, props: RendererProps<TProps>, context: TContext]>

  /**
   * Declares and validates the `blocks` structure accepted by this renderer.
   * Use `blockSchema` at each position where authored component content begins.
   */
  readonly blocksSchema?: ZodType<TBlocks>

  /**
   * Adjusts authored props when the renderer builder is called. This runs while
   * building the journey definition, not while rendering a request.
   *
   * @param props - The authored, expression-aware renderer props
   * @returns The props Forge should store in the renderer invocation
   */
  readonly prepare?: (props: ResolvableProps<TProps>) => ResolvableProps<TProps>
}

interface PresentationDefinition<TDeps, TArguments extends unknown[]> extends FunctionEntry<TDeps> {
  /** Internal Forge discriminator. Do not set or override this property. */
  readonly _forge: FunctionEntryType.COMPONENT | FunctionEntryType.RENDERER

  /** The registered function name, which matches the presentation variant. */
  readonly name: string

  /** The component or renderer variant referenced by compiled definitions. */
  readonly variant: string

  /** Builds the evaluator used after Forge resolves this request's dependencies. */
  readonly factory: (deps: TDeps) => RenderFunctionEvaluator<TArguments>
}

type PresentationBuilder<TProps, TBlock> =
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- `{} extends X` is the every-prop-optional test
  {} extends TProps ? (props?: TProps) => TBlock : (props: TProps) => TBlock

type BasicPresentationDefinition<TProps> = BlockDefinition & {
  readonly _forge: ComponentCallType.BASIC
} & ResolvableProps<TProps>

type FieldComponentDefinition<TProps> = FieldBlockDefinition & ResolvableProps<TProps>

type RendererDefinition<TProps> = RendererInvocation & ResolvableProps<TProps>

/** A component entry that is also callable as an expression-aware block builder. */
export type ForgeComponent<TProps extends object, TDeps> = PresentationBuilder<
  BasicBlockProps & ResolvableProps<TProps>,
  BasicPresentationDefinition<TProps>
> &
  PresentationDefinition<TDeps, [props: ComponentRenderProps<TProps>]> & {
    readonly _forge: FunctionEntryType.COMPONENT
  }

/** A field component entry that is also callable as an expression-aware field builder. */
export type ForgeFieldComponent<TProps extends object, TDeps> = PresentationBuilder<
  FieldBlockProps & ResolvableProps<TProps>,
  FieldComponentDefinition<TProps>
> &
  PresentationDefinition<TDeps, [props: FieldComponentRenderProps<TProps>]> & {
    readonly _forge: FunctionEntryType.COMPONENT

    /** Chooses the element ID that validation summaries link to. */
    readonly errorAnchor?: (props: FieldComponentRenderProps<TProps>) => string | undefined
  }

/** A renderer entry that is also callable to configure a step's renderer invocation. */
export type ForgeStepRenderer<
  TProps extends object,
  TBlocks,
  TContext extends RendererFunctionContext,
  TDeps,
> = PresentationBuilder<ResolvableProps<TProps>, RendererDefinition<TProps>> &
  PresentationDefinition<
    TDeps,
    [blocks: RenderedBlockShape<TBlocks>, props: RendererProps<TProps>, context: TContext]
  > & {
    readonly _forge: FunctionEntryType.RENDERER

    /** The authored block structure accepted by this renderer. */
    readonly blocksSchema?: ZodType<TBlocks>
  }

export interface RendererInvocation {
  /** Internal Forge discriminator. Do not set or override this property. */
  readonly _forge: ComponentCallType.BASIC

  /** The registered renderer variant Forge should use for the step. */
  readonly variant: string
}
