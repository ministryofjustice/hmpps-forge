import { component } from '../../components/component'
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
  render: props => props.blocks.map(child => child.html).join(''),
})
