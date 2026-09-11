import { journey, createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { overviewStep } from './overview'
import { listStep } from './list'
import { detailStep } from './detail'

export const paginationDemoJourney = journey({
  code: 'pagination-demo',
  title: 'Pagination',
  path: '/pagination',
  steps: [overviewStep, listStep, detailStep],
})

export default createForgePackage({ journey: paginationDemoJourney })
