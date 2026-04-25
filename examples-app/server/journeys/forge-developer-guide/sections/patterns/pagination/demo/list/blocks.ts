import {
  Data,
  Format,
  Item,
  Iterator,
  Loop,
  Condition,
  Transformer,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock, HtmlBlock } from '@ministryofjustice/hmpps-forge/core/components'
import {
  GovUKHeading,
  GovUKBody,
  GovUKPagination,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({ text: 'Stations', size: 'l' })

export const pageInfo = GovUKBody({
  text: Format(
    'Page %1 of %2',
    Data('currentPage'),
    Data('pages').pipe(Transformer.Array.Length()),
  ),
  classes: 'govuk-!-margin-bottom-6',
})

export const stationList = CollectionBlock({
  collection: Data('stations').each(
    Iterator.Map(
      HtmlBlock({
        tag: 'div',
        classes: 'govuk-!-margin-bottom-4',
        content: [
          HtmlBlock({
            tag: 'a',
            classes: 'govuk-link govuk-heading-s govuk-!-margin-bottom-1',
            attributes: { href: Item().path('href') },
            content: Item().path('name'),
          }),
          GovUKBody({
            text: Format('Lines: %1 — Zone %2', Item().path('lines'), Item().path('zone')),
            size: 's',
          }),
        ],
      }),
    ),
  ),
})

// This pagination is achievable and performant in Forge, but that does not
// always mean this is the nicest authoring shape for a real service.
// In practice, `derive____` effect hooks can be a useful way to shape API/DB
// data into component-ready view models before blocks render.
export const pagination = GovUKPagination({
  previous: {
    href: Format('?page=%1', Data('currentPage').pipe(Transformer.Number.Add(-1))),
    visibleWhen: Data('currentPage').match(Condition.Number.GreaterThan(1)),
  },
  next: {
    href: Format('?page=%1', Data('currentPage').pipe(Transformer.Number.Add(1))),
    visibleWhen: Data('currentPage').match(
      Condition.Number.LessThan(Data('pages').pipe(Transformer.Array.Length())),
    ),
  },
  items: Data('pages').each(
    Iterator.Map({
      number: Loop.Index(),
      href: Format('?page=%1', Loop.Index()),
      current: Loop.Index().match(Condition.Equals(Data('currentPage'))),
    }),
  ),
})
