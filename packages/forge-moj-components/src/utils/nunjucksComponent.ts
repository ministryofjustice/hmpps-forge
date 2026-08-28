import type nunjucks from 'nunjucks'

import { component } from '@ministryofjustice/hmpps-forge/core/components'
import type { ComponentFactory } from '@ministryofjustice/hmpps-forge/core/components'

/**
 * Defines a Nunjucks component from plain props - `component()` with the
 * renderer pinned, so the render callback receives a typed `nunjucks.Environment`.
 *
 * A local copy of the express-nunjucks helper: importing it from that package would
 * pull the express adapter (and express itself) into every browser bundle that uses
 * these components.
 */
export const nunjucksComponent: ComponentFactory<string, nunjucks.Environment> = component
