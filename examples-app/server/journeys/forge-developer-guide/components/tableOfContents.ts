import { component } from '@ministryofjustice/hmpps-forge/core/components'
import type { HeadingEntry } from '../../../data/guideContentStore'

export interface TableOfContents {
  headings: HeadingEntry[]
}

export const TableOfContents = component<TableOfContents>('tableOfContents', {
  factory: () => props => {
    if (!props.headings || props.headings.length === 0) {
      return ''
    }

    const items = props.headings
      .map(
        (h: HeadingEntry) => `
          <li class="guide-contents__item">
            <a class="govuk-link govuk-link--no-visited-state" href="#${h.slug}">${h.text}</a>
          </li>`,
      )
      .join('')

    return `
      <nav class="guide-contents" aria-label="Contents">
        <h2 class="govuk-body-s govuk-!-margin-bottom-1">Contents</h2>
        <ol class="govuk-list guide-contents__list">${items}
        </ol>
      </nav>`
  },
})
