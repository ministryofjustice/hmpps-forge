import {
  Data,
  Format,
  Item,
  Iterator,
  Condition,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock, HtmlBlock } from '@ministryofjustice/hmpps-forge/core/components'
import {
  GovUKHeading,
  GovUKBody,
  GovUKTextInput,
  GovUKButton,
  GovUKInsetText,
  GovukUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({ text: 'Search stations', size: 'l' })

export const searchInput = GovUKTextInput({
  code: 'searchQuery',
  label: { text: 'Station name' },
  hint: { text: 'Try searching for King, Brixton, or Piccadilly' },
  classes: GovukUtilityClasses.Input.Width20,
})

export const searchButton = GovUKButton({ text: 'Search' })

export const resultsHeading = GovUKHeading({
  text: 'Results',
  size: 'm',
  visibleWhen: Data('hasSearched').match(Condition.IsRequired()),
})

export const resultsList = CollectionBlock({
  collection: Data('searchResults').each(
    Iterator.Map(
      HtmlBlock({
        tag: 'div',
        classes: 'govuk-!-margin-bottom-6',
        content: [
          GovUKHeading({
            text: Item().path('name'),
            size: 's',
          }),
          GovUKBody({
            text: Format('Lines: %1 — Zone %2', Item().path('lines'), Item().path('zone')),
            size: 's',
          }),
          HtmlBlock({
            tag: 'a',
            classes: 'govuk-link',
            attributes: { href: Item().path('href') },
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
