import { block as buildBlock, field as buildField } from '../authoring/builders'
import { ComponentEntryType } from '../shared/taxonomy'
import { stampComponent } from '../authoring/builders/utils/stampEntry'
import type {
  ComponentRenderProps,
  ComponentOptions,
  ComponentRegistryEntry,
  FieldComponentRenderProps,
  FieldComponentOptions,
  ForgeComponent,
  ForgeFieldComponent,
} from './types/components.type'
import type {
  BasicBlockProps,
  BlockDefinition,
  FieldBlockDefinition,
  FieldBlockProps,
  ResolvableProps,
} from './types/structures.type'

type AuthorProps<TProps> = BasicBlockProps & ResolvableProps<TProps>

type FieldAuthorProps<TProps> = FieldBlockProps & ResolvableProps<TProps>

type ComponentBlock<TProps> = BlockDefinition & ResolvableProps<TProps>

type FieldComponentBlock<TProps> = FieldBlockDefinition & ResolvableProps<TProps>

/**
 * Defines a component from the plain props its implementation consumes.
 *
 * The returned value is both the authoring builder and the registry entry, so one
 * declaration covers both roles. Building a block with it in a journey definition
 * also registers the component - a `components` listing is only needed when a
 * journey refers to the variant by name alone (a JSON journey, for example):
 *
 * ```typescript
 * export interface MyCardProps { title: string }
 * export const MyCard = component<MyCardProps>('myCard', {
 *   render: (props, renderer) => {
 *     const nunjucksEnv = renderer as nunjucks.Environment
 *
 *     return nunjucksEnv.render('components/card.njk', { params: { text: props.title } })
 *   },
 * })
 * ```
 *
 * A component that captures user input declares `field: true` - see
 * {@link FieldComponentOptions.field}.
 *
 * @param variant - The component's variant identifier
 * @param options - How the component renders, plus the field options where it is one
 * @returns A callable block builder that doubles as the component registry entry
 */
export function component<TProps extends object, TOutput = string, TRenderer = unknown>(
  variant: string,
  options: FieldComponentOptions<TProps, TOutput, TRenderer>,
): ForgeFieldComponent<TProps, TOutput>
export function component<TProps extends object, TOutput = string, TRenderer = unknown>(
  variant: string,
  options: ComponentOptions<TProps, TOutput, TRenderer>,
): ForgeComponent<TProps, TOutput>
export function component<TProps extends object, TOutput = string, TRenderer = unknown>(
  variant: string,
  options: ComponentOptions<TProps, TOutput, TRenderer> | FieldComponentOptions<TProps, TOutput, TRenderer>,
): ForgeComponent<TProps, TOutput> | ForgeFieldComponent<TProps, TOutput> {
  if ('field' in options) {
    return createFieldComponent(variant, options)
  }

  return createComponent(variant, options)
}

/**
 * Whether a value is a component built by {@link component}: a callable block
 * builder carrying the registry entry surface.
 */
export function isForgeComponent(
  value: unknown,
): value is ComponentRegistryEntry<object, unknown> & { _forge: ComponentEntryType } {
  if (typeof value !== 'function') {
    return false
  }

  const candidate = value as Partial<ComponentRegistryEntry<object, unknown>> & { _forge?: unknown }

  return typeof candidate._forge === 'string' && candidate._forge.startsWith('component.entry.')
}

function createComponent<TProps extends object, TOutput, TRenderer>(
  variant: string,
  options: ComponentOptions<TProps, TOutput, TRenderer>,
): ForgeComponent<TProps, TOutput> {
  const buildDefinition = (props?: AuthorProps<TProps>): ComponentBlock<TProps> => {
    const authored = props ?? ({} as AuthorProps<TProps>)
    const prepared = options.prepare?.(authored) ?? authored
    const definition = { ...prepared, variant } as Omit<ComponentBlock<TProps>, '_forge'>
    const built = buildBlock<ComponentBlock<TProps>>(definition)
    stampComponent(built, handle)

    return built
  }

  const handle = Object.assign(buildDefinition, {
    _forge: ComponentEntryType.BASIC,
    variant,
    render: (props: ComponentRenderProps<TProps>, renderer?: unknown) => options.render(props, renderer as TRenderer),
  })

  return handle
}

function createFieldComponent<TProps extends object, TOutput, TRenderer>(
  variant: string,
  options: FieldComponentOptions<TProps, TOutput, TRenderer>,
): ForgeFieldComponent<TProps, TOutput> {
  const buildDefinition = (props?: FieldAuthorProps<TProps>): FieldComponentBlock<TProps> => {
    const authored = props ?? ({} as FieldAuthorProps<TProps>)
    const prepared = options.prepare?.(authored) ?? authored
    const definition = { ...prepared, variant } as Omit<FieldComponentBlock<TProps>, '_forge'>
    const built = buildField<FieldComponentBlock<TProps>>(definition)
    stampComponent(built, handle)

    return built
  }

  const handle = Object.assign(buildDefinition, {
    _forge: ComponentEntryType.FIELD,
    variant,
    render: (props: FieldComponentRenderProps<TProps>, renderer?: unknown) =>
      options.render(props, renderer as TRenderer),
    ...(options.inputSchema !== undefined && { inputSchema: options.inputSchema }),
    ...(options.multiple !== undefined && { multiple: options.multiple }),
    ...(options.errorAnchor !== undefined && { errorAnchor: options.errorAnchor }),
  })

  return handle
}
