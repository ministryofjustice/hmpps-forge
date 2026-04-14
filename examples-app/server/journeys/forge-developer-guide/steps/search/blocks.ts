import { Data, Item, Iterator, Transformer } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  CollectionBlock,
  HtmlBlock,
  TemplateWrapper,
} from '@ministryofjustice/hmpps-forge/core/components'
import {
  GovUKBody,
  GovUKHeading,
  GovUKInsetText,
  GovukUtilityClasses,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Search the guide',
  size: 'l',
})

export const searchForm = TemplateWrapper({
  template: `<form method="get" role="search">
    <label class="govuk-label" for="guide-page-search-input">Enter a keyword or concept</label>
    <div class="guide-search-panel__form">
      <input class="govuk-input guide-search-panel__input" id="guide-page-search-input" type="search" name="q" value="{{query}}">
      <button class="guide-search-panel__submit" type="submit">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span class="govuk-visually-hidden">Search</span>
      </button>
    </div>
  </form>`,
  values: {
    query: Data('searchQuery').pipe(Transformer.String.EscapeHtml()),
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
