/**
 * MOJ Frontend Components for Form Engine
 *
 * This package provides Ministry of Justice Design Pattern components as
 * form-engine compatible components. Components render HTML directly based
 * on the MOJ Design Patterns specifications.
 *
 * @see https://design-patterns.service.justice.gov.uk/
 *
 * @example
 * ```typescript
 * import { FormEngine } from '@ministryofjustice/hmpps-forge/core'
 * import { ExpressFrameworkAdapter } from '@ministryofjustice/hmpps-forge/express-nunjucks'
 * import { mojComponents } from '@ministryofjustice/hmpps-forge/moj-components'
 *
 * const formEngine = new FormEngine({
 *   logger,
 *   frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
 * })
 *   .registerComponents(mojComponents)
 *   .registerForm(myJourney)
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
