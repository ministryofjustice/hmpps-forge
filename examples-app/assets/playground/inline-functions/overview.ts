import { step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

const heading = GovUKHeading({
  text: 'Shaping data inline',
  size: 'l',
  caption: 'Pattern',
})

const intro = GovUKBody({
  text: `This demo renders the same case overview dashboard twice. Both
  pages load the same data and display the same content. The difference
  is in the source code: the first version shapes data using chained
  expressions; the second uses the same six risk rows with inline
  transformers beside the properties that use them.`,
})

const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

const showsList = GovUKList({
  items: Literal([
    'A verbose version with repeated when().then().else() chains for 6 risk scores',
    'The same 6 risk rows using an inline transformer to produce the tag HTML',
    'Goals and compliance summaries computed by inline transformers instead of the effect',
    'How the same content can be rendered with presentation logic beside each component property',
  ]),
  style: 'bullet',
})

const startButton = GovUKLinkButton({
  text: 'Start with the verbose version',
  href: '/inline-functions/before',
  isStartButton: true,
})

export const overviewStep = step({
  path: '/overview',
  title: 'Shaping data inline',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, intro, shows, showsList, startButton],
})
