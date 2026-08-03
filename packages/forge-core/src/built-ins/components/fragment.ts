import { component } from '../../components/component'
import { isRenderedBlock } from '../../authoring/typeguards/structures'
import type { BlockDefinition, ResolvableArray } from '../../components/types/structures.type'

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
export interface Fragment extends BlockDefinition {
  /**
   * The child blocks to render, in order.
   *
   * @example [GovUKHeading({ text: 'Title' }), GovUKBody({ text: 'Body' })]
   */
  blocks: ResolvableArray<BlockDefinition>
}

/**
 * Renders a fragment child to its HTML string:
 * - Rendered blocks contribute their HTML as-is
 * - Arrays are flattened in order
 * - Anything else (e.g. a dynamic expression resolving to non-blocks) is skipped
 */
const renderChild = (child: unknown): string => {
  if (Array.isArray(child)) {
    return child.map(c => renderChild(c)).join('')
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
  render: props => props.blocks.map(child => renderChild(child)).join(''),
})
