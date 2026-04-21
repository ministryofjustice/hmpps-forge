import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { yourNameStep } from './your-name/step'
import { relationshipStep } from './relationship/step'

// Child journey for the "Your details" section of the task list
export const yourDetailsJourney = journey({
  code: 'your-details',
  title: 'Your details',
  path: '/your-details',
  steps: [yourNameStep, relationshipStep],
})
