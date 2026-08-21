import { block as buildBlock, field as buildField } from '../authoring/builders'
import { stampComponent } from '../authoring/builders/utils/stampEntry'
import type {
  BaseComponentOptions,
  ComponentOptions,
  ComponentRegistryEntry,
  FieldComponentOptions,
  ForgeComponent,
  PropsOf,
} from './types/components.type'
import type { BlockDefinition, EvaluatedBlock, FieldBlockDefinition } from './types/structures.type'

/**
 * Defines a component from a single block interface.
 *
 * The returned value is both the authoring builder and the registry entry, so one
 * declaration covers both roles. Building a block with it in a journey definition
 * also registers the component - a `components` listing is only needed when a
 * journey refers to the variant by name alone (a JSON journey, for example):
 *
 * ```typescript
 * export interface MyCard extends BlockDefinition { title: string }
 * export const MyCard = component<MyCard>('myCard', {
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
export function component<TBlock extends BlockDefinition, TOutput = string, TRenderer = unknown>(
  variant: string,
  options: ComponentOptions<TBlock, TOutput, TRenderer>,
): ForgeComponent<TBlock, TOutput> {
  // TBlock is still generic here, so the conditional options type is unresolved - read it
  // through a shape carrying every member either arm can contribute.
  const { render, prepare, field, inputSchema, multiple, errorAnchor } = options as BaseComponentOptions<
    TBlock,
    TOutput,
    TRenderer
  > &
    Partial<FieldComponentOptions<TBlock, TOutput, TRenderer>>

  const buildDefinition = (props?: PropsOf<TBlock>): TBlock => {
    const authored = props ?? ({} as PropsOf<TBlock>)
    const prepared = prepare ? prepare(authored) : authored

    // The field props are only present on a field component; the cast lets both builders
    // share one definition, and the declared `field` option picks the right one.
    const definition = { ...prepared, variant } as unknown as Omit<TBlock & FieldBlockDefinition, 'type' | 'blockType'>

    const built = field
      ? buildField<TBlock & FieldBlockDefinition>(definition)
      : buildBlock<TBlock & FieldBlockDefinition>(definition)
    stampComponent(built, handle)

    return built
  }

  const handle = Object.assign(buildDefinition, {
    variant,
    render: (block: EvaluatedBlock<TBlock>, renderer?: unknown) => render(block, renderer as TRenderer),
    ...(inputSchema !== undefined && { inputSchema }),
    ...(multiple !== undefined && { multiple }),
    ...(errorAnchor !== undefined && { errorAnchor }),
  })

  return handle
}

/**
 * Whether a value is a component built by {@link component}: a callable block
 * builder carrying the registry entry surface.
 */
export function isForgeComponent(value: unknown): value is ForgeComponent<BlockDefinition, unknown> {
  if (typeof value !== 'function') {
    return false
  }

  const candidate = value as Partial<ComponentRegistryEntry<BlockDefinition, unknown>>

  return typeof candidate.variant === 'string' && typeof candidate.render === 'function'
}
