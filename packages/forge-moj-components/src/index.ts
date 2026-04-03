/**
 * MOJ Frontend Components for Forge
 *
 * This package provides Ministry of Justice Design Pattern components as
 * forge compatible components. Components render HTML directly based
 * on the MOJ Design Patterns specifications.
 *
 * @see https://design-patterns.service.justice.gov.uk/
 *
 * @example
 * ```typescript
 * import { Forge } from '@ministryofjustice/hmpps-forge/core'
 * import { ExpressFrameworkAdapter } from '@ministryofjustice/hmpps-forge/express-nunjucks'
 * import { mojComponents } from '@ministryofjustice/hmpps-forge/moj-components'
 *
 * const forge = new Forge({
 *   logger,
 *   frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
 * })
 *   .registerComponents(mojComponents)
 *   .register(myJourney)
 * ```
 */

export { mojComponents } from './components/index'

// Re-export types
export type {
  MOJCard,
  MOJCardHeading,
  MOJCardDescription,
  MOJCardGroup,
  MOJCardGroupItem,
  MOJCardGroupItemHeading,
  MOJCardGroupItemDescription,
  MOJDatePicker,
  MOJDatePickerLabel,
  MOJDatePickerHint,
  MOJDatePickerFormGroup,
} from './components'
