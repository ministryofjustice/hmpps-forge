import { Data, Item, Iterator, Transformer } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  CollectionBlock,
  HtmlBlock,
  TemplateWrapper,
} from '@ministryofjustice/hmpps-forge/core/components'
import {
  GovUKBody,
  GovUKButton,
  GovUKHeading,
  GovUKInsetText,
  GovUKTextInput,
  GovukUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Search the guide',
  size: 'l',
})

export const searchForm = TemplateWrapper({
  template: '<form method="get">{{slot:fields}}</form>',
  slots: {
    fields: [
      GovUKTextInput({
        code: 'q',
        label: 'Enter a keyword or concept',
        defaultValue: Data('searchQuery').pipe(Transformer.String.EscapeHtml()),
        classes: 'govuk-!-width-two-thirds',
      }),
      GovUKButton({
        text: 'Search',
      }),
    ],
  },
})

export const searchResults = CollectionBlock({
  collection: Data('searchResults').each(
    Iterator.Map(
      HtmlBlock({
        tag: 'li',
        classes: 'guide-search-results__item',
        content: [
          HtmlBlock({
            tag: 'a',
            classes: `govuk-link govuk-link--no-visited-state ${GovukUtilityClasses.FontSize.Size27}`,
            attributes: { href: Item().path('href') },
            content: Item().path('title'),
          }),
          GovUKBody({
            text: Item().path('excerpt').pipe(Transformer.String.EscapeHtml()),
            size: 's',
            classes: 'govuk-!-margin-top-1',
          }),
          CollectionBlock({
            collection: Item()
              .path('sections')
              .each(
                Iterator.Map(
                  HtmlBlock({
                    tag: 'li',
                    content: HtmlBlock({
                      tag: 'a',
                      classes: 'govuk-link govuk-link--no-visited-state govuk-body-s',
                      attributes: { href: Item().path('href') },
                      content: Item().path('heading'),
                    }),
                  }),
                ),
              ),
            tag: 'ul',
            classes: 'govuk-list govuk-list--bullet govuk-!-margin-top-1',
          }),
        ],
      }),
    ),
  ),
  fallback: [
    GovUKInsetText({
      text: 'No results found.',
      visibleWhen: Data('searchQuery'),
    }),
  ],
  tag: 'ul',
  classes: 'govuk-list guide-search-results',
})
