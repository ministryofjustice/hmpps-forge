import type { ZodType } from 'zod'
import type { ComponentCallType, FunctionEntryType } from '../../shared/taxonomy'
import type { FunctionEntry } from '../../authoring/types/functions.type'
import type { RenderBlock, RenderContext } from '../../framework/types/rendering.type'
import type { ComponentRenderProps, FieldComponentRenderProps, RendererProps } from './components.type'
import type {
  BasicBlockProps,
  BlockDefinition,
  FieldBlockDefinition,
  FieldBlockProps,
  RenderedBlockShape,
  ResolvableProps,
} from './structures.type'

type MaybePromise<T> = T | PromiseLike<T>

export interface ComponentFunctionContext {
  readonly kind: 'block'
  readonly block: RenderBlock
}

export interface RendererFunctionContext {
  readonly kind: 'step'
  readonly step: RenderContext['step']
  readonly ancestors: RenderContext['ancestors']
  readonly routeTree: RenderContext['routeTree']
  readonly showValidationFailures: boolean
  readonly fieldValidationErrors: RenderContext['fieldValidationErrors']
  readonly domainValidationErrors: RenderContext['domainValidationErrors']
  readonly answers: RenderContext['answers']
  readonly data: RenderContext['data']
  readonly requestState: Record<string, unknown>
}

export interface ComponentFunctionInput<TProps extends object> {
  readonly props: ComponentRenderProps<TProps>
  readonly context: ComponentFunctionContext
}

export interface FieldComponentFunctionInput<TProps extends object> {
  readonly props: FieldComponentRenderProps<TProps>
  readonly context: ComponentFunctionContext
}

export interface RendererFunctionInput<TProps extends object, TBlockShape = BlockDefinition[], TOutput = string> {
  readonly props: RendererProps<TProps>
  readonly blocks: RenderedBlockShape<TBlockShape, TOutput>
  readonly context: RendererFunctionContext
}

export type RenderFunctionEvaluator<TInput extends object, TOutput> = (input: TInput) => MaybePromise<TOutput>

interface BaseRenderOptions<TDependencies, TInput extends object, TOutput> {
  readonly factory: (dependencies: TDependencies) => RenderFunctionEvaluator<TInput, TOutput>
}

export interface ComponentOptions<TProps extends object, TDependencies, TOutput = string> extends BaseRenderOptions<
  TDependencies,
  ComponentFunctionInput<TProps>,
  TOutput
> {
  readonly prepare?: (props: BasicBlockProps & ResolvableProps<TProps>) => BasicBlockProps & ResolvableProps<TProps>
}

export interface FieldComponentOptions<
  TProps extends object,
  TDependencies,
  TOutput = string,
> extends BaseRenderOptions<TDependencies, FieldComponentFunctionInput<TProps>, TOutput> {
  readonly field: true
  readonly inputSchema?: ZodType
  readonly multiple?: boolean
  readonly errorAnchor?: (props: FieldComponentRenderProps<TProps>) => string | undefined
  readonly prepare?: (props: FieldBlockProps & ResolvableProps<TProps>) => FieldBlockProps & ResolvableProps<TProps>
}

export interface RendererOptions<
  TProps extends object,
  TBlockShape = BlockDefinition[],
  TDependencies = Record<string, never>,
  TOutput = string,
> extends BaseRenderOptions<TDependencies, RendererFunctionInput<TProps, TBlockShape, TOutput>, TOutput> {
  readonly blocksSchema?: ZodType<TBlockShape>
  readonly prepare?: (props: ResolvableProps<TProps>) => ResolvableProps<TProps>
}

interface PresentationDefinition<
  TDependencies = unknown,
  TInput extends object = object,
  TOutput = unknown,
> extends FunctionEntry<TDependencies> {
  readonly _forge: FunctionEntryType.COMPONENT | FunctionEntryType.RENDERER
  readonly name: string
  readonly variant: string
  readonly factory: (dependencies: TDependencies) => RenderFunctionEvaluator<TInput, TOutput>
}

type PresentationBuilder<TProps, TBlock> =
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- `{} extends X` is the every-prop-optional test
  {} extends TProps ? (props?: TProps) => TBlock : (props: TProps) => TBlock

type BasicPresentationDefinition<TProps> = BlockDefinition & {
  readonly _forge: ComponentCallType.BASIC
} & ResolvableProps<TProps>

type FieldComponentDefinition<TProps> = FieldBlockDefinition & ResolvableProps<TProps>

type RendererDefinition<TProps> = RendererInvocation & ResolvableProps<TProps>

export type ForgeComponent<TProps extends object, TDependencies, TOutput = string> = PresentationBuilder<
  BasicBlockProps & ResolvableProps<TProps>,
  BasicPresentationDefinition<TProps>
> &
  PresentationDefinition<TDependencies, ComponentFunctionInput<TProps>, TOutput> & {
    readonly _forge: FunctionEntryType.COMPONENT
  }

export type ForgeFieldComponent<TProps extends object, TDependencies, TOutput = string> = PresentationBuilder<
  FieldBlockProps & ResolvableProps<TProps>,
  FieldComponentDefinition<TProps>
> &
  PresentationDefinition<TDependencies, FieldComponentFunctionInput<TProps>, TOutput> & {
    readonly _forge: FunctionEntryType.COMPONENT
    readonly errorAnchor?: (props: FieldComponentRenderProps<TProps>) => string | undefined
  }

export type ForgeStepRenderer<
  TProps extends object,
  TBlockShape = BlockDefinition[],
  TDependencies = Record<string, never>,
  TOutput = string,
> = PresentationBuilder<ResolvableProps<TProps>, RendererDefinition<TProps>> &
  PresentationDefinition<TDependencies, RendererFunctionInput<TProps, TBlockShape, TOutput>, TOutput> & {
    readonly _forge: FunctionEntryType.RENDERER
    readonly blocksSchema?: ZodType<TBlockShape>
  }

export interface RendererInvocation {
  readonly _forge: ComponentCallType.BASIC
  readonly variant: string
}
