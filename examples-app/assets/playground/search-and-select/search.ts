import {
  Data,
  Format,
  Loop,
  Iterator,
  Condition,
  access,
  submit,
  redirect,
  step,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock, HtmlBlock } from '@ministryofjustice/hmpps-forge/core/components'
import {
  GovUKHeading,
  GovUKBody,
  GovUKTextInput,
  GovUKButton,
  GovUKInsetText,
  GovUKUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import { searchStations, saveDraftAnswers } from './effects'

const heading = GovUKHeading({ text: 'Search stations', size: 'l' })

const searchInput = GovUKTextInput({
  code: 'searchQuery',
  label: { text: 'Station name' },
  hint: { text: 'Try searching for King, Brixton, or Piccadilly' },
  classes: GovUKUtilityClasses.Input.Width20,
})

const searchButton = GovUKButton({ text: 'Search' })

const resultsHeading = GovUKHeading({
  text: 'Results',
  size: 'm',
  visibleWhen: Data('hasSearched').match(Condition.IsRequired()),
})

const resultsList = CollectionBlock({
  collection: Data('searchResults').each(
    Iterator.Map(
      HtmlBlock({
        tag: 'div',
        classes: 'govuk-!-margin-bottom-6',
        content: [
          GovUKHeading({
            text: Loop.Item().path('name'),
            size: 's',
          }),
          GovUKBody({
            text: Format('Lines: %1 — Zone %2', Loop.Item().path('lines'), Loop.Item().path('zone')),
            size: 's',
          }),
          HtmlBlock({
            tag: 'a',
            classes: 'govuk-link',
            attributes: { href: Loop.Item().path('href') },
            content: 'View station details',
          }),
        ],
      }),
    ),
  ),
  fallback: [
    GovUKInsetText({
      text: 'No matching stations found.',
      visibleWhen: Data('hasSearched').match(Condition.IsRequired()),
    }),
  ],
})

export const searchStep = step({
  code: 'search',
  path: '/search',
  title: 'Search stations',
  reachability: { entryWhen: true },
  onAccess: [
    access({
      effects: [
        searchStations(),
      ],
    }),
  ],
  blocks: [heading, searchInput, searchButton, resultsHeading, resultsList],
  onSubmission: [
    submit({
      validate: false,
      onAlways: {
        effects: [saveDraftAnswers()],
        next: [redirect({ goto: 'search' })],
      },
    }),
  ],
})
