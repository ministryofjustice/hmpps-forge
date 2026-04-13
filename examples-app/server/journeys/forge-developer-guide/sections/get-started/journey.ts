import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'

export const getStartedJourney = journey({
  code: 'get-started',
  title: 'Get started',
  path: '/get-started',
  view: {
    locals: { showBackToTop: true },
  },
  steps: [],
})
