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
  GovUKLinkButton,
  GovUKInsetText,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({ text: 'Blog posts', size: 'l' })

export const postCount = GovUKBody({
  text: Format('%1 posts published', Data('postCount')),
  visibleWhen: Data('postCount').match(Condition.IsRequired()),
})

export const writeButton = GovUKLinkButton({
  text: 'Write a new post',
  href: '/forge-developer-guide/patterns/demos/cms-content/write',
  classes: 'govuk-button--secondary',
})

export const postsList = CollectionBlock({
  collection: Data('posts').each(
    Iterator.Map(
      HtmlBlock({
        tag: 'article',
        classes: 'govuk-!-margin-bottom-8',
        content: [
          GovUKHeading({
            text: Item().path('title'),
            size: 'm',
          }),
          GovUKBody({
            text: Item().path('date'),
            size: 's',
            classes: 'govuk-!-colour-secondary',
          }),
          HtmlBlock({
            content: Item().path('body'),
          }),
          HtmlBlock({
            tag: 'hr',
            classes: 'govuk-section-break govuk-section-break--visible govuk-!-margin-top-6',
          }),
        ],
      }),
    ),
  ),
})

export const emptyState = GovUKInsetText({
  text: 'No posts yet. Write your first post to get started.',
  visibleWhen: Data('postCount').not.match(Condition.IsRequired()),
})
