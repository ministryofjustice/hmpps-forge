import { access, submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { patternStep } from '../../../shared/patternStep'
import { PatternEffects } from '../../../effects'
import { heading, searchInput, searchButton, resultsHeading, resultsList } from './blocks'

export const searchStep = patternStep({
  code: 'search',
  path: '/search',
  title: 'Search stations',
  reachability: { entryWhen: true },
  onAccess: [
    access({
      effects: [
        PatternEffects.LoadDraftAnswers('search-and-select'),
        PatternEffects.SearchStations(),
      ],
    }),
  ],
  blocks: [heading, searchInput, searchButton, resultsHeading, resultsList],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [PatternEffects.SaveDraftAnswers('search-and-select')],
        next: [redirect({ goto: 'search' })],
      },
    }),
  ],
  sourceBase: 'search-and-select/demo/search',
  codeFiles: ['step.ts', 'blocks.ts'],
})
