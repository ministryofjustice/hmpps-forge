import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'

export const componentsJourney = journey({
  code: 'components',
  title: 'Components',
  path: '/components',
  view: {
    locals: { showBackToTop: true },
  },
  steps: [],
})
