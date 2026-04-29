import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { overviewStep } from './overview/step'
import { listStep } from './list/step'
import { detailStep } from './detail/step'

export const paginationDemoJourney = journey({
  code: 'pagination-demo',
  title: 'Pagination',
  path: '/pagination',
  steps: [overviewStep, listStep, detailStep],
})
