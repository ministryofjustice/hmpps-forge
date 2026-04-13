import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'

export const functionsAndEffectsJourney = journey({
  code: 'functions-and-effects',
  title: 'Functions and effects',
  path: '/functions-and-effects',
  view: {
    locals: { showBackToTop: true },
  },
  steps: [],
})
