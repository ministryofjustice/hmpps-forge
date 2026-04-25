import { Literal } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKBody,
  GovUKList,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: 'Shaping data inline',
  size: 'l',
  caption: 'Pattern',
})

export const intro = GovUKBody({
  text: `This demo renders the same case overview dashboard twice. Both
  pages load the same data and produce identical output. The difference
  is in the source code: the first version shapes data using chained
  expressions, the second extracts that logic into inline transformers.`,
})

export const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

export const showsList = GovUKList({
  items: Literal([
    'A verbose version with repeated when().then().else() chains for 6 risk scores',
    'A clean version using a riskRow() helper backed by one inline transformer',
    'Goals and compliance summaries computed by inline transformers instead of the effect',
    'How the rendered output stays identical while the source becomes dramatically shorter',
  ]),
  type: 'bullet',
})

export const startButton = GovUKLinkButton({
  text: 'Start with the verbose version',
  href: '/forge-developer-guide/patterns/demos/inline-functions/before',
  isStartButton: true,
})
