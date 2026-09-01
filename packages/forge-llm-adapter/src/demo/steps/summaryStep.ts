import {
  Answer,
  Condition,
  Format,
  Item,
  Iterator,
  match,
  redirect,
  Self,
  step,
  submit,
  Transformer,
  validation,
} from '@ministryofjustice/hmpps-forge/core/authoring'

import { LlmContent } from '../../functions/components/content/llmContent'
import { LlmSingleSelect } from '../../functions/components/single-select/llmSingleSelect'
import type { LlmTurnBlocks } from '../../functions/renderers/turn/llmTurn'
import { SaveLlmDemoAnswers } from '../llmDemoJourneyEffects'

export const summaryStep = step<LlmTurnBlocks>({
  code: 'summary',
  path: '/summary',
  title: 'Check your answers',
  blocks: {
    content: [
      LlmContent({
        content: [
          { content: 'Here is what I have understood from our conversation.' },
          { content: '---' },
          {
            content: Format(
              '**Current housing situation:** %1',
              match(Answer('housingSituation'))
                .branch(Condition.Equals('owner'), 'I own my home')
                .branch(Condition.Equals('renter'), 'I rent my home')
                .branch(Condition.Equals('family-or-friends'), 'I live with family or friends')
                .otherwise('Something else'),
            ),
          },
          {
            content: Format(
              '**Property type:** %1',
              match(Answer('ownedPropertyType'))
                .branch(Condition.Equals('house'), 'House')
                .branch(Condition.Equals('flat'), 'Flat or apartment')
                .branch(Condition.Equals('bungalow'), 'Bungalow')
                .otherwise('Another kind of property'),
            ),
            visibleWhen: Answer('housingSituation').match(Condition.Equals('owner')),
          },
          {
            content: Format('**Property colour:** %1', Answer('propertyColour')),
            visibleWhen: Answer('housingSituation').match(Condition.Equals('owner')),
          },
          {
            content: Format('**Purchase date:** %1', Answer('purchaseDate').pipe(Transformer.String.FormatDate())),
            visibleWhen: Answer('housingSituation').match(Condition.Equals('owner')),
          },
          {
            content: Format(
              '**Property features:** %1',
              Answer('propertyFeatures')
                .each(
                  Iterator.Map(
                    match(Item().value())
                      .branch(Condition.Equals('garden'), 'Garden')
                      .branch(Condition.Equals('garage'), 'Garage')
                      .branch(Condition.Equals('driveway'), 'Driveway')
                      .branch(Condition.Equals('balcony'), 'Balcony')
                      .otherwise('Spare room'),
                  ),
                )
                .pipe(Transformer.Array.Join(', ')),
            ),
            visibleWhen: Answer('housingSituation').match(Condition.Equals('owner')),
          },
          {
            content: Format(
              '**Planning home improvements:** %1',
              match(Answer('plansHomeChanges'))
                .branch(Condition.Equals('yes'), 'Yes')
                .branch(Condition.Equals('no'), 'No')
                .otherwise('Not sure yet'),
            ),
            visibleWhen: Answer('housingSituation').match(Condition.Equals('owner')),
          },
          {
            content: Format(
              '**Expected time at this home:** %1',
              match(Answer('expectedTimeAtHome'))
                .branch(Condition.Equals('under-one-year'), 'Less than a year')
                .branch(Condition.Equals('one-to-three-years'), 'One to three years')
                .branch(Condition.Equals('longer-than-three-years'), 'Longer than three years')
                .otherwise('Not sure'),
            ),
            visibleWhen: Answer('housingSituation').match(Condition.Equals('owner')),
          },
          {
            content: Format('**Planned improvements:** %1', Answer('plannedImprovements')),
            visibleWhen: Answer('plansHomeChanges').match(Condition.Equals('yes')),
          },
          {
            content: Format('**Preferred improvement timeframe:** %1', Answer('improvementTimeframe')),
            visibleWhen: Answer('plansHomeChanges').match(Condition.Equals('yes')),
          },
          {
            content: Format(
              '**Improvement areas:** %1',
              Answer('improvementAreas')
                .each(
                  Iterator.Map(
                    match(Item().value())
                      .branch(Condition.Equals('kitchen'), 'Kitchen')
                      .branch(Condition.Equals('bathroom'), 'Bathroom')
                      .branch(Condition.Equals('garden'), 'Garden')
                      .branch(Condition.Equals('energy-efficiency'), 'Energy efficiency')
                      .otherwise('Accessibility'),
                  ),
                )
                .pipe(Transformer.Array.Join(', ')),
            ),
            visibleWhen: Answer('plansHomeChanges').match(Condition.Equals('yes')),
          },
          {
            content: Format(
              '**Rented property type:** %1',
              match(Answer('rentedPropertyType'))
                .branch(Condition.Equals('house'), 'House')
                .branch(Condition.Equals('flat'), 'Flat or apartment')
                .branch(Condition.Equals('room'), 'A room in a shared property')
                .otherwise('Another kind of property'),
            ),
            visibleWhen: Answer('housingSituation').match(Condition.Equals('renter')),
          },
          {
            content: Format(
              '**Rental move-in date:** %1',
              Answer('rentalMoveInDate').pipe(Transformer.String.FormatDate()),
            ),
            visibleWhen: Answer('housingSituation').match(Condition.Equals('renter')),
          },
          {
            content: Format(
              '**Furnishing:** %1',
              match(Answer('rentalFurnishing'))
                .branch(Condition.Equals('furnished'), 'Furnished')
                .branch(Condition.Equals('part-furnished'), 'Part-furnished')
                .otherwise('Unfurnished'),
            ),
            visibleWhen: Answer('housingSituation').match(Condition.Equals('renter')),
          },
          {
            content: Format(
              '**Rental features:** %1',
              Answer('rentalFeatures')
                .each(
                  Iterator.Map(
                    match(Item().value())
                      .branch(Condition.Equals('outdoor-space'), 'Outdoor space')
                      .branch(Condition.Equals('parking'), 'Parking')
                      .branch(Condition.Equals('accessible'), 'Accessible features')
                      .otherwise('Pets are allowed'),
                  ),
                )
                .pipe(Transformer.Array.Join(', ')),
            ),
            visibleWhen: Answer('housingSituation').match(Condition.Equals('renter')),
          },
          {
            content: Format('**Renting experience:** %1', Answer('rentalExperience')),
            visibleWhen: Answer('housingSituation').match(Condition.Equals('renter')),
          },
          {
            content: Format(
              '**Would like to buy a home:** %1',
              match(Answer('plansToBuy'))
                .branch(Condition.Equals('yes'), 'Yes')
                .branch(Condition.Equals('no'), 'No')
                .otherwise('Not sure yet'),
            ),
            visibleWhen: Answer('housingSituation').match(Condition.Equals('renter')),
          },
          {
            content: Format('**Preferred area to buy:** %1', Answer('preferredArea')),
            visibleWhen: Answer('plansToBuy').match(Condition.Equals('yes')),
          },
          {
            content: Format('**Preferred purchase timeframe:** %1', Answer('targetPurchaseTimeframe')),
            visibleWhen: Answer('plansToBuy').match(Condition.Equals('yes')),
          },
          {
            content: Format(
              '**Desired property features:** %1',
              Answer('desiredPropertyFeatures')
                .each(
                  Iterator.Map(
                    match(Item().value())
                      .branch(Condition.Equals('garden'), 'Garden')
                      .branch(Condition.Equals('parking'), 'Parking')
                      .branch(Condition.Equals('home-office'), 'Home office')
                      .branch(Condition.Equals('accessible'), 'Accessible features')
                      .otherwise('Near public transport'),
                  ),
                )
                .pipe(Transformer.Array.Join(', ')),
            ),
            visibleWhen: Answer('plansToBuy').match(Condition.Equals('yes')),
          },
          {
            content: Format(
              '**Shared home with:** %1',
              match(Answer('sharedHomeWith'))
                .branch(Condition.Equals('family'), 'Family')
                .branch(Condition.Equals('friends'), 'Friends')
                .branch(Condition.Equals('partner'), 'A partner')
                .otherwise('Someone else'),
            ),
            visibleWhen: Answer('housingSituation').match(Condition.Equals('family-or-friends')),
          },
          {
            content: Format(
              '**Started living there:** %1',
              Answer('sharedHomeMoveInDate').pipe(Transformer.String.FormatDate()),
            ),
            visibleWhen: Answer('housingSituation').match(Condition.Equals('family-or-friends')),
          },
          {
            content: Format('**Shared-home experience:** %1', Answer('sharedHomeExperience')),
            visibleWhen: Answer('housingSituation').match(Condition.Equals('family-or-friends')),
          },
          {
            content: Format(
              '**Shared-home plans:** %1',
              match(Answer('sharedHomePlans'))
                .branch(Condition.Equals('stay'), 'Stay where I am')
                .branch(Condition.Equals('move'), 'Move somewhere else')
                .otherwise('Not sure yet'),
            ),
            visibleWhen: Answer('housingSituation').match(Condition.Equals('family-or-friends')),
          },
          {
            content: Format('**Housing arrangement:** %1', Answer('otherHousingDescription')),
            visibleWhen: Answer('housingSituation').match(Condition.Equals('other')),
          },
          {
            content: Format(
              '**Arrangement began:** %1',
              Answer('otherHousingStartDate').pipe(Transformer.String.FormatDate()),
            ),
            visibleWhen: Answer('housingSituation').match(Condition.Equals('other')),
          },
          {
            content: Format(
              '**Arrangement stability:** %1',
              match(Answer('otherHousingStability'))
                .branch(Condition.Equals('stable'), 'Stable')
                .branch(Condition.Equals('temporary'), 'Temporary')
                .otherwise('Uncertain'),
            ),
            visibleWhen: Answer('housingSituation').match(Condition.Equals('other')),
          },
          {
            content: Format(
              '**Housing priorities:** %1',
              Answer('housingPriorities')
                .each(
                  Iterator.Map(
                    match(Item().value())
                      .branch(Condition.Equals('affordability'), 'Affordability')
                      .branch(Condition.Equals('location'), 'Location')
                      .branch(Condition.Equals('space'), 'Space')
                      .branch(Condition.Equals('accessibility'), 'Accessibility')
                      .branch(Condition.Equals('outdoor-space'), 'Outdoor space')
                      .otherwise('Public transport'),
                  ),
                )
                .pipe(Transformer.Array.Join(', ')),
            ),
          },
          { content: Format('**Ideal home:** %1', Answer('idealHomeDescription')) },
          {
            content: Format(
              '**Moving timeframe:** %1',
              match(Answer('movingTimeframe'))
                .branch(Condition.Equals('within-one-year'), 'Within a year')
                .branch(Condition.Equals('one-to-three-years'), 'In one to three years')
                .branch(Condition.Equals('later'), 'Later than that')
                .branch(Condition.Equals('no-plans'), 'No plans to move')
                .otherwise('Not sure'),
            ),
          },
          { content: '---' },
          { content: 'Does that summary look correct? If not, tell me what needs changing.' },
        ],
      }),
    ],
    questions: [
      LlmSingleSelect({
        code: 'summaryCorrect',
        prompt: 'Does that summary look correct? If not, tell me what needs changing.',
        llmHint:
          'Return yes only when the user explicitly confirms the summary after seeing it. Return no when they reject or correct any part of it. Extract any stated corrections as amendments to the earlier answers.',
        llmClarificationHint:
          'Explain that the user can confirm the summary or describe anything that should be corrected.',
        requiresExplicitAnswer: true,
        options: [
          { value: 'yes', text: 'Yes, it is correct' },
          { value: 'no', text: 'No, something needs changing' },
        ],
        validWhen: [
          validation({
            condition: Self().match(Condition.IsRequired()),
            message: 'Tell me whether the summary is correct',
          }),
        ],
      }),
    ],
  },
  onSubmission: [
    submit({
      validate: true,
      onValid: {
        effects: [SaveLlmDemoAnswers()],
        next: [
          redirect({ when: Answer('summaryCorrect').match(Condition.Equals('yes')), goto: 'complete' }),
          redirect({ goto: 'housing-situation' }),
        ],
      },
    }),
  ],
})
