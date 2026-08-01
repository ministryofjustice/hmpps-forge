import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'CMS content',
  size: 'l',
  caption: 'Pattern',
})

export const intro = GovUKBody({
  text: `A simple blog-style CMS where users write posts using a rich text
  editor and view them on a separate page. Content is stored in the
  session and rendered as HTML. This pattern shows how to integrate a
  third-party editor component with Forge's form submission flow.`,
})

export const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

export const showsList = GovUKList({
  items: Literal([
    'A custom rich text editor component wrapping the MOJ Rich Text Editor',
    'Saving user-generated HTML content via effects',
    'Rendering dynamic HTML content with CollectionBlock and HtmlBlock',
    'Session-based content storage for a multi-step authoring flow',
  ]),
  style: 'bullet',
})

export const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/forge-developer-guide/patterns/demos/cms-content/posts',
  isStartButton: true,
})
