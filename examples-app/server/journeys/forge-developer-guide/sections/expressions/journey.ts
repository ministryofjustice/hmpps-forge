import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'

export const expressionsJourney = journey({
  code: 'expressions',
  title: 'Expressions',
  path: '/expressions',
  view: {
    locals: { showBackToTop: true },
  },
  steps: [],
})
