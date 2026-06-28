import type { ValidationResult } from '../../../../contracts/runtime/validationResult.type'
import type { StepValidityResult } from '../../../../contracts/runtime/stepValidityResult.type'
import type { ValidationView } from '../../../../contracts/runtime/validationView.type'

export type { ValidationView } from '../../../../contracts/runtime/validationView.type'

const DEFAULT_GROUPS: readonly string[] = ['default']

/**
 * The mode a reader projects a stored step's full failure set into. `isSubmission`
 * keeps `submissionOnly` failures; `groups` (defaulting to `['default']`) selects which
 * group-tagged failures count. Reachability asks for `{ isSubmission: false }`; a submit
 * hook asks for `{ isSubmission: true, groups: <its validationGroups> }`.
 */
export interface ValidationFilter {
  readonly isSubmission: boolean
  readonly groups?: readonly string[]
}

function toActiveSet(groups: readonly string[] | undefined): Set<string> {
  const active = groups !== undefined && groups.length > 0 ? groups : DEFAULT_GROUPS

  return new Set(active.map(String))
}

// A failure matches when any of its groups is active; an empty or absent group
// list defaults to `['default']`. Group filtering lives only here at read time —
// the generated source stores every failure with its groups untouched.
function groupsActive(failureGroups: readonly string[] | undefined, active: Set<string>): boolean {
  const groups = failureGroups !== undefined && failureGroups.length > 0 ? failureGroups : DEFAULT_GROUPS

  return groups.some(group => active.has(String(group)))
}

function isActive(failure: ValidationResult, isSubmission: boolean, active: Set<string>): boolean {
  if (failure.submissionOnly && !isSubmission) {
    return false
  }

  return groupsActive(failure.groups, active)
}

/**
 * Projects a step's stored full failure set into the view a reader asks for, filtering
 * by submission mode and active groups, and deriving `isValid` from what remains.
 */
export function stepValidity(stored: StepValidityResult | undefined, filter: ValidationFilter): ValidationView {
  if (stored === undefined) {
    return { isValid: true, fieldFailures: [], domainFailures: [] }
  }

  const active = toActiveSet(filter.groups)
  const fieldFailures = stored.fieldFailures.filter(failure => isActive(failure, filter.isSubmission, active))
  const domainFailures = stored.domainFailures.filter(failure => isActive(failure, filter.isSubmission, active))

  return { isValid: fieldFailures.length === 0 && domainFailures.length === 0, fieldFailures, domainFailures }
}

export function isStepValid(stored: StepValidityResult | undefined, filter: ValidationFilter): boolean {
  return stepValidity(stored, filter).isValid
}
