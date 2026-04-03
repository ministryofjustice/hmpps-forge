import { Answer, Format } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKPanel,
  GovUKHeading,
  GovUKBody,
  GovUKInsetText,
  GovUKButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const panel = GovUKPanel({ titleText: 'Feedback sent' })

export const whatHappensNextHeading = GovUKHeading({
  text: 'What happens next',
  size: 'm',
  level: 2,
})

export const whatHappensNextBody = GovUKBody({
  text: 'We have sent your feedback to our team. They will review it and get in touch using your preferred contact method.',
})

export const contactMethodInset = GovUKInsetText({
  text: Format('You selected to be contacted by %1.', Answer('contactMethod')),
})

export const startAgainButton = GovUKButton({ text: 'Start again' })
