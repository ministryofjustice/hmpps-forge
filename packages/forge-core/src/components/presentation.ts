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

/** Declares a presentational block or field component. */
export function component<TProps extends object, TDependencies = Record<string, never>, TOutput = string>(
  variant: string,
  options: FieldComponentOptions<TProps, TDependencies, TOutput>,
): ForgeFieldComponent<TProps, TDependencies, TOutput>
export function component<TProps extends object, TDependencies = Record<string, never>, TOutput = string>(
  variant: string,
  options: ComponentOptions<TProps, TDependencies, TOutput>,
): ForgeComponent<TProps, TDependencies, TOutput>
export function component<TProps extends object, TDependencies, TOutput>(
  variant: string,
  options: ComponentOptions<TProps, TDependencies, TOutput> | FieldComponentOptions<TProps, TDependencies, TOutput>,
): ForgeComponent<TProps, TDependencies, TOutput> | ForgeFieldComponent<TProps, TDependencies, TOutput> {
  if ('field' in options) {
    return createFieldComponent(variant, options)
  }

  return createComponent(variant, options)
}

/** Declares a step renderer that composes a step and its rendered children. */
export function renderer<TProps extends object, TDependencies = Record<string, never>, TOutput = string>(
  variant: string,
  options: RendererOptions<TProps, TDependencies, TOutput>,
): ForgeStepRenderer<TProps, TDependencies, TOutput> {
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
    factory: options.factory,
  })

  return handle
}

function createComponent<TProps extends object, TDependencies, TOutput>(
  variant: string,
  options: ComponentOptions<TProps, TDependencies, TOutput>,
): ForgeComponent<TProps, TDependencies, TOutput> {
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

function createFieldComponent<TProps extends object, TDependencies, TOutput>(
  variant: string,
  options: FieldComponentOptions<TProps, TDependencies, TOutput>,
): ForgeFieldComponent<TProps, TDependencies, TOutput> {
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
