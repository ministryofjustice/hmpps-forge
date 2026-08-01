import { block as buildBlock, field as buildField } from '../authoring/builders'
import type {
  BaseComponentOptions,
  ComponentOptions,
  FieldComponentOptions,
  ForgeComponent,
  PropsOf,
} from './types/components.type'
import type { BlockDefinition, EvaluatedBlock, FieldBlockDefinition } from './types/structures.type'

/**
 * Defines a component from a single block interface.
 *
 * The returned value is both the authoring builder and the registry entry, so one
 * declaration covers both roles:
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
  const { render, prepare, field, inputSchema, multiple } = options as BaseComponentOptions<
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

    return field
      ? buildField<TBlock & FieldBlockDefinition>(definition)
      : buildBlock<TBlock & FieldBlockDefinition>(definition)
  }

  return Object.assign(buildDefinition, {
    variant,
    render: (block: EvaluatedBlock<TBlock>, renderer?: unknown) => render(block, renderer as TRenderer),
    ...(inputSchema !== undefined && { inputSchema }),
    ...(multiple !== undefined && { multiple }),
  })
}
