import { z } from 'zod'
import { block as buildBlock, field as buildField } from '../authoring/builders'
import { stampEntry } from '../authoring/builders/utils/stampEntry'
import { ComponentCallType, FunctionEntryType } from '../shared/taxonomy'
import type {
  BasicBlockProps,
  BlockDefinition,
  FieldBlockDefinition,
  FieldBlockProps,
  ResolvableProps,
} from './types/structures.type'
import type {
  ComponentOptions,
  FieldComponentOptions,
  ForgeComponent,
  ForgeFieldComponent,
  ForgeStepRenderer,
  RendererFunctionContext,
  RendererInvocation,
  RendererOptions,
} from './types/renderFunctions.type'

type AuthorProps<TProps> = BasicBlockProps & ResolvableProps<TProps>

type FieldAuthorProps<TProps> = FieldBlockProps & ResolvableProps<TProps>

type RendererAuthorProps<TProps> = ResolvableProps<TProps>

type BasicPresentationDefinition<TProps> = BlockDefinition & {
  readonly _forge: ComponentCallType.BASIC
} & ResolvableProps<TProps>

type FieldComponentDefinition<TProps> = FieldBlockDefinition & ResolvableProps<TProps>

type RendererDefinition<TProps> = RendererInvocation & ResolvableProps<TProps>

/**
 * Defines a component entry and returns its expression-aware block builder.
 * The factory receives package dependencies for the current request, then its
 * evaluator receives the component's resolved props.
 *
 * Set `field: true` to define a field component. Its evaluator also receives
 * the field `code`, current `value`, and validation `errors` in its props.
 *
 * @typeParam TProps - The component's plain render props
 * @typeParam TDeps - The package dependencies received by `factory`
 * @param variant - The unique component variant used in compiled block definitions
 * @param options - The component's authoring preparation, field metadata, and evaluator factory
 * @returns A self-registering component entry that authors blocks when called
 */
export function component<TProps extends object, TDeps = Record<string, never>>(
  variant: string,
  options: FieldComponentOptions<TProps, TDeps>,
): ForgeFieldComponent<TProps, TDeps>
export function component<TProps extends object, TDeps = Record<string, never>>(
  variant: string,
  options: ComponentOptions<TProps, TDeps>,
): ForgeComponent<TProps, TDeps>
export function component<TProps extends object, TDeps>(
  variant: string,
  options: ComponentOptions<TProps, TDeps> | FieldComponentOptions<TProps, TDeps>,
): ForgeComponent<TProps, TDeps> | ForgeFieldComponent<TProps, TDeps> {
  if ('field' in options) {
    return createFieldComponent(variant, options)
  }

  return createComponent(variant, options)
}

/**
 * Defines a step renderer and returns its expression-aware renderer builder.
 * The factory receives package dependencies for the current request. Its
 * evaluator receives the rendered block structure, resolved renderer props,
 * and renderer context in that order.
 *
 * @typeParam TProps - The renderer's plain props
 * @typeParam TBlocks - The authored structure of the step's `blocks` property
 * @typeParam TContext - The request and journey context received by the evaluator
 * @typeParam TDeps - The package dependencies received by `factory`
 * @param variant - The unique renderer variant used in compiled step definitions
 * @param options - The block schema, authoring preparation, and evaluator factory
 * @returns A self-registering renderer entry that authors renderer invocations when called
 */
export function renderer<
  TProps extends object,
  TBlocks,
  TContext extends RendererFunctionContext,
  TDeps = Record<string, never>,
>(
  variant: string,
  options: RendererOptions<TProps, TBlocks, TContext, TDeps>,
): ForgeStepRenderer<TProps, TBlocks, TContext, TDeps> {
  const buildDefinition = (props?: RendererAuthorProps<TProps>): RendererDefinition<TProps> => {
    const authored = props ?? ({} as RendererAuthorProps<TProps>)
    const prepared = options.prepare?.(authored) ?? authored
    const definition = { ...prepared, variant } as Omit<RendererDefinition<TProps>, '_forge'>
    const built = buildBlock<RendererDefinition<TProps>>(definition)

    stampEntry(built, handle)

    return built
  }

  Object.defineProperty(buildDefinition, 'name', { value: variant, configurable: true })

  const handle = Object.assign(buildDefinition, {
    _forge: FunctionEntryType.RENDERER as const,
    variant,
    blocksSchema: options.blocksSchema,
    factory: options.factory,
  })

  return handle
}

function createComponent<TProps extends object, TDeps>(
  variant: string,
  options: ComponentOptions<TProps, TDeps>,
): ForgeComponent<TProps, TDeps> {
  const buildDefinition = (props?: AuthorProps<TProps>): BasicPresentationDefinition<TProps> => {
    const authored = props ?? ({} as AuthorProps<TProps>)
    const prepared = options.prepare?.(authored) ?? authored
    const definition = { ...prepared, variant } as Omit<BasicPresentationDefinition<TProps>, '_forge'>
    const built = buildBlock<BasicPresentationDefinition<TProps>>(definition)

    stampEntry(built, handle)

    return built
  }

  Object.defineProperty(buildDefinition, 'name', { value: variant, configurable: true })

  const handle = Object.assign(buildDefinition, {
    _forge: FunctionEntryType.COMPONENT as const,
    variant,
    factory: options.factory,
  })

  return handle
}

function createFieldComponent<TProps extends object, TDeps>(
  variant: string,
  options: FieldComponentOptions<TProps, TDeps>,
): ForgeFieldComponent<TProps, TDeps> {
  const buildDefinition = (props?: FieldAuthorProps<TProps>): FieldComponentDefinition<TProps> => {
    const authored = props ?? ({} as FieldAuthorProps<TProps>)
    const prepared = options.prepare?.(authored) ?? authored
    const definition = { ...prepared, variant } as Omit<FieldComponentDefinition<TProps>, '_forge'>
    const built = buildField<FieldComponentDefinition<TProps>>(definition)

    stampEntry(built, handle)

    return built
  }

  Object.defineProperty(buildDefinition, 'name', { value: variant, configurable: true })

  const handle = Object.assign(buildDefinition, {
    _forge: FunctionEntryType.COMPONENT as const,
    variant,
    factory: options.factory,
    ...(options.inputSchema !== undefined && { inputSchema: z.compile(z.input(options.inputSchema)) }),
    ...(options.multiple !== undefined && { multiple: options.multiple }),
    ...(options.errorAnchor !== undefined && { errorAnchor: options.errorAnchor }),
  })

  return handle
}
