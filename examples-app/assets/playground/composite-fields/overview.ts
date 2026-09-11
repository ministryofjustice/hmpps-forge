import { Literal, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { GovUKHeading, GovUKBody, GovUKList, GovUKLinkButton } from '@ministryofjustice/hmpps-forge/govuk-components'

const heading = GovUKHeading({
  text: 'Multi-part composite fields',
  size: 'l',
  caption: 'Pattern',
})

const intro = GovUKBody({
  text: `Fields that are conceptually one value, but collected
  through several inputs. Two common flavours turn up: a
  component that owns the composition internally (date of
  birth), and separate fields laid out together that the author
  composes at display time (a postal address).`,
})

const shows = GovUKHeading({ text: 'What this pattern shows', size: 's' })

const showsList = GovUKList({
  items: Literal([
    'A component-owned composite with GovUKDateInputFull (day, month, year) that outputs one ISO date',
    'Pre-built field-specific validations for empty, missing part, and invalid date errors',
    'An author-owned composite where several text inputs on one step describe one address',
    'A summary list that formats the date and combines the address lines',
    'Optional fields that only contribute to the composed display when filled in',
  ]),
  style: 'bullet',
})

const startButton = GovUKLinkButton({
  text: 'Start the pattern',
  href: '/composite-fields/date-of-birth',
  isStartButton: true,
})

export const overviewStep = step({
  path: '/overview',
  title: 'Multi-part composite fields',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, intro, shows, showsList, startButton],
})
