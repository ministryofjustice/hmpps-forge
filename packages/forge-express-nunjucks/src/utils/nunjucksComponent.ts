import type nunjucks from 'nunjucks'

import { component } from '@ministryofjustice/hmpps-forge/core/components'
import type { ComponentFactory } from '@ministryofjustice/hmpps-forge/core/components'

/**
 * Defines a Nunjucks component from a single block interface - `component()` with the
 * renderer pinned, so the render callback receives a typed `nunjucks.Environment`.
 *
 * @example
 * ```typescript
 * export interface MyTextInputProps { label: string }
 *
 * export const MyTextInput = nunjucksComponent<MyTextInputProps>('myTextInput', {
 *   field: true,
 *   render: (props, nunjucksEnv) =>
 *     nunjucksEnv.render('components/text-input.njk', { params: { name: props.code } }),
 * })
 * ```
 */
export const nunjucksComponent: ComponentFactory<string, nunjucks.Environment> = component
