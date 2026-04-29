import { Condition, Self, validation } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKTextInput,
  GovUKButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import { RichTextEditor } from '../../../../../components/richTextEditor'

export const heading = GovUKHeading({ text: 'Write a post', size: 'l' })

export const titleInput = GovUKTextInput({
  code: 'postTitle',
  label: { text: 'Title', classes: 'govuk-label--m' },
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a title',
    }),
  ],
})

export const bodyEditor = RichTextEditor({
  code: 'postBody',
  label: { text: 'Content', classes: 'govuk-label--m' },
  hint: 'Use the toolbar to format your post.',
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter some content',
    }),
  ],
})

export const publishButton = GovUKButton({ text: 'Publish post' })
