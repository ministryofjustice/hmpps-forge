import { buildComponent } from '@ministryofjustice/hmpps-forge/core/components'
import { block as blockBuilder } from '@ministryofjustice/hmpps-forge/core/authoring'
import type {
  BasicBlockProps,
  BlockDefinition,
  ConditionalArray,
} from '@ministryofjustice/hmpps-forge/core/components'
import type { HeadingEntry } from '../../../data/guideContentStore'

export interface TableOfContentsProps extends BasicBlockProps {
  headings: ConditionalArray<HeadingEntry>
}

export interface TableOfContents extends BlockDefinition, TableOfContentsProps {
  variant: 'tableOfContents'
}

export const tableOfContentsComponent = buildComponent<TableOfContents>(
  'tableOfContents',
  block => {
    if (!block.headings || block.headings.length === 0) {
      return ''
    }

    const items = block.headings
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
)

export function TableOfContents(props: TableOfContentsProps): TableOfContents {
  return blockBuilder<TableOfContents>({ ...props, variant: 'tableOfContents' })
}
