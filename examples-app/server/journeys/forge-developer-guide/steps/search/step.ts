import { step, access } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GuideEffects } from '../../effects'
import { heading, searchForm, searchResults } from './blocks'

export const searchStep = step({
  path: '/search',
  title: 'Search',
  isEntryPoint: true,
  metadata: { hiddenFromNav: true },
  view: {
    locals: { showBackToTop: true },
  },
  onAccess: [
    access({
      effects: [GuideEffects.SearchContent()],
    }),
  ],
  blocks: [heading, searchForm, searchResults],
})
