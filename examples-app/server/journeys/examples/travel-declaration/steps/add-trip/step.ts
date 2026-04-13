import { step, submit, redirect } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneysEffects } from '../../../effects'
import {
  heading,
  countryField,
  departureDateField,
  returnDateField,
  reasonField,
  continueButton,
} from './blocks'
import { countries } from './countries'

// FORGE-EXAMPLE: The `data` property injects static data into the step context.
// This data becomes accessible via Data('countries') in block expressions.
// It's a simple alternative to loading data via effects when the data is static.
export const addTripStep = step({
  code: 'add-trip',
  path: '/add-trip',
  title: 'Add a trip',
  data: { countries },
  blocks: [heading, countryField, departureDateField, returnDateField, reasonField, continueButton],
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [
          ExampleJourneysEffects.AddTrip(),
          ExampleJourneysEffects.SaveAnswers('travel-form'),
        ],
        next: [redirect({ goto: 'your-trips' })],
      },
    }),
  ],
})
