import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { preferredDayStep } from './preferred-day/step'
import { visitTypeStep } from './visit-type/step'

// Child journey for the "Visit preferences" section of the task list
export const visitPreferencesJourney = journey({
  code: 'visit-preferences',
  title: 'Visit preferences',
  path: '/visit-preferences',
  steps: [preferredDayStep, visitTypeStep],
})
