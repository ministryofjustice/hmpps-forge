import { component } from '../../components/presentation'
import { isRenderedBlock } from '../../components/typeguards'
import type { BlockDefinition } from '../../components/types/structures.type'

/**
 * Fragment component.
 *
 * Groups child blocks without adding a wrapper element - the blocks render
 * back-to-back exactly as they would as siblings.
 *
 * Useful anywhere a single block is expected but you want to output several,
 * such as the template of an `Iterator.Map()`.
 *
 * @example
 * ```typescript
 * Data('tasks').each(Iterator.Map(
 *   Fragment({
 *     blocks: [
 *       GovUKHeading({ text: Item().path('title'), level: 3 }),
 *       GovUKBody({ text: Item().path('description') }),
 *     ],
 *   }),
 * ))
 * ```
 */
export interface Fragment {
  /**
   * The child blocks to render, in order.
   *
   * @example [GovUKHeading({ text: 'Title' }), GovUKBody({ text: 'Body' })]
   */
  blocks: BlockDefinition[]
}

const renderChild = (child: unknown): string => {
  if (Array.isArray(child)) {
    return child.map(renderChild).join('')
  }

  if (isRenderedBlock(child)) {
    return child.html
  }

  return ''
}

/**
 * Fragment component.
 *
 * Groups child blocks without adding a wrapper element - the blocks render
 * back-to-back exactly as they would as siblings.
 *
 * @example
 * ```typescript
 * Fragment({
 *   blocks: [
 *     GovUKHeading({ text: 'Title', level: 3 }),
 *     GovUKBody({ text: 'Body' }),
 *   ],
 * })
 * ```
 */
export const Fragment = component<Fragment>('fragment', {
  factory: () => props => props.blocks.map(renderChild).join(''),
})
