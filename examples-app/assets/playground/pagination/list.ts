import {
  Data,
  Format,
  Iterator,
  Loop,
  Condition,
  Transformer,
  access,
  step,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { CollectionBlock, HtmlBlock } from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKHeading, GovUKBody, GovUKPagination } from '@ministryofjustice/hmpps-forge/govuk-components'
import { loadStationPage } from './effects'

const heading = GovUKHeading({ text: 'Stations', size: 'l' })

const pageInfo = GovUKBody({
  text: Format(
    'Page %1 of %2',
    Data('currentPage'),
    Data('pages').pipe(Transformer.Array.Length()),
  ),
  classes: 'govuk-!-margin-bottom-6',
})

const stationList = CollectionBlock({
  collection: Data('stations').each(
    Iterator.Map(
      HtmlBlock({
        tag: 'div',
        classes: 'govuk-!-margin-bottom-4',
        content: [
          HtmlBlock({
            tag: 'a',
            classes: 'govuk-link govuk-heading-s govuk-!-margin-bottom-1',
            attributes: { href: Loop.Item().path('href') },
            content: Loop.Item().path('name'),
          }),
          GovUKBody({
            text: Format('Lines: %1 — Zone %2', Loop.Item().path('lines'), Loop.Item().path('zone')),
            size: 's',
          }),
        ],
      }),
    ),
  ),
})

const pagination = GovUKPagination({
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

export const listStep = step({
  code: 'list',
  path: '/list',
  title: 'Stations',
  reachability: { entryWhen: true },
  onAccess: [
    access({
      effects: [loadStationPage()],
    }),
  ],
  blocks: [heading, pageInfo, stationList, pagination],
})
