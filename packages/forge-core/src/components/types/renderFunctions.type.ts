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

export type RenderFunctionEvaluator<TArguments extends unknown[]> = (...args: TArguments) => unknown

interface BaseRenderOptions<TDeps, TArguments extends unknown[]> {
  readonly factory: (deps: TDeps) => RenderFunctionEvaluator<TArguments>
}

export interface ComponentOptions<TProps extends object, TDeps> extends BaseRenderOptions<
  TDeps,
  [props: ComponentRenderProps<TProps>]
> {
  readonly prepare?: (props: BasicBlockProps & ResolvableProps<TProps>) => BasicBlockProps & ResolvableProps<TProps>
}

export interface FieldComponentOptions<TProps extends object, TDeps> extends BaseRenderOptions<
  TDeps,
  [props: FieldComponentRenderProps<TProps>]
> {
  readonly field: true
  readonly inputSchema?: ZodType
  readonly multiple?: boolean
  readonly errorAnchor?: (props: FieldComponentRenderProps<TProps>) => string | undefined
  readonly prepare?: (props: FieldBlockProps & ResolvableProps<TProps>) => FieldBlockProps & ResolvableProps<TProps>
}

export interface RendererOptions<
  TProps extends object,
  TBlocks,
  TContext extends RendererFunctionContext,
  TDeps,
> extends BaseRenderOptions<
  TDeps,
  [blocks: RenderedBlockShape<TBlocks>, props: RendererProps<TProps>, context: TContext]
> {
  readonly blocksSchema?: ZodType<TBlocks>
  readonly prepare?: (props: ResolvableProps<TProps>) => ResolvableProps<TProps>
}

interface PresentationDefinition<TDeps, TArguments extends unknown[]> extends FunctionEntry<TDeps> {
  readonly _forge: FunctionEntryType.COMPONENT | FunctionEntryType.RENDERER
  readonly name: string
  readonly variant: string
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

export type ForgeComponent<TProps extends object, TDeps> = PresentationBuilder<
  BasicBlockProps & ResolvableProps<TProps>,
  BasicPresentationDefinition<TProps>
> &
  PresentationDefinition<TDeps, [props: ComponentRenderProps<TProps>]> & {
    readonly _forge: FunctionEntryType.COMPONENT
  }

export type ForgeFieldComponent<TProps extends object, TDeps> = PresentationBuilder<
  FieldBlockProps & ResolvableProps<TProps>,
  FieldComponentDefinition<TProps>
> &
  PresentationDefinition<TDeps, [props: FieldComponentRenderProps<TProps>]> & {
    readonly _forge: FunctionEntryType.COMPONENT
    readonly errorAnchor?: (props: FieldComponentRenderProps<TProps>) => string | undefined
  }

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
    readonly blocksSchema?: ZodType<TBlocks>
  }

export interface RendererInvocation {
  readonly _forge: ComponentCallType.BASIC
  readonly variant: string
}
