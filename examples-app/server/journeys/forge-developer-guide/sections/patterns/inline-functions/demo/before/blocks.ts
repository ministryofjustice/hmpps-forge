import { Data, Format, Condition, when } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  GovUKHeading,
  GovUKSummaryList,
  GovUKBody,
  GovUKLinkButton,
} from '@ministryofjustice/hmpps-forge/govuk-components'

export const heading = GovUKHeading({
  text: Format('%1 %2', Data('case.name.firstName'), Data('case.name.lastName')),
  size: 'l',
  caption: Format('CRN: %1', Data('case.crn')),
})

export const riskHeading = GovUKHeading({ text: 'Risk scores', size: 'm' })

export const riskScores = GovUKSummaryList({
  rows: [
    {
      key: { text: 'Overall' },
      value: {
        html: when(Data('case.riskScores.overall').match(Condition.Equals('VERY_HIGH')))
          .then('<strong class="govuk-tag govuk-tag--red">Very high</strong>')
          .else(
            when(Data('case.riskScores.overall').match(Condition.Equals('HIGH')))
              .then('<strong class="govuk-tag govuk-tag--red">High</strong>')
              .else(
                when(Data('case.riskScores.overall').match(Condition.Equals('MEDIUM')))
                  .then('<strong class="govuk-tag govuk-tag--yellow">Medium</strong>')
                  .else('<strong class="govuk-tag govuk-tag--green">Low</strong>'),
              ),
          ),
      },
    },
    {
      key: { text: 'Self-harm' },
      value: {
        html: when(Data('case.riskScores.selfHarm').match(Condition.Equals('VERY_HIGH')))
          .then('<strong class="govuk-tag govuk-tag--red">Very high</strong>')
          .else(
            when(Data('case.riskScores.selfHarm').match(Condition.Equals('HIGH')))
              .then('<strong class="govuk-tag govuk-tag--red">High</strong>')
              .else(
                when(Data('case.riskScores.selfHarm').match(Condition.Equals('MEDIUM')))
                  .then('<strong class="govuk-tag govuk-tag--yellow">Medium</strong>')
                  .else('<strong class="govuk-tag govuk-tag--green">Low</strong>'),
              ),
          ),
      },
    },
    {
      key: { text: 'Public protection' },
      value: {
        html: when(Data('case.riskScores.publicProtection').match(Condition.Equals('VERY_HIGH')))
          .then('<strong class="govuk-tag govuk-tag--red">Very high</strong>')
          .else(
            when(Data('case.riskScores.publicProtection').match(Condition.Equals('HIGH')))
              .then('<strong class="govuk-tag govuk-tag--red">High</strong>')
              .else(
                when(Data('case.riskScores.publicProtection').match(Condition.Equals('MEDIUM')))
                  .then('<strong class="govuk-tag govuk-tag--yellow">Medium</strong>')
                  .else('<strong class="govuk-tag govuk-tag--green">Low</strong>'),
              ),
          ),
      },
    },
    {
      key: { text: 'Known adult' },
      value: {
        html: when(Data('case.riskScores.knownAdult').match(Condition.Equals('VERY_HIGH')))
          .then('<strong class="govuk-tag govuk-tag--red">Very high</strong>')
          .else(
            when(Data('case.riskScores.knownAdult').match(Condition.Equals('HIGH')))
              .then('<strong class="govuk-tag govuk-tag--red">High</strong>')
              .else(
                when(Data('case.riskScores.knownAdult').match(Condition.Equals('MEDIUM')))
                  .then('<strong class="govuk-tag govuk-tag--yellow">Medium</strong>')
                  .else('<strong class="govuk-tag govuk-tag--green">Low</strong>'),
              ),
          ),
      },
    },
    {
      key: { text: 'Children' },
      value: {
        html: when(Data('case.riskScores.children').match(Condition.Equals('VERY_HIGH')))
          .then('<strong class="govuk-tag govuk-tag--red">Very high</strong>')
          .else(
            when(Data('case.riskScores.children').match(Condition.Equals('HIGH')))
              .then('<strong class="govuk-tag govuk-tag--red">High</strong>')
              .else(
                when(Data('case.riskScores.children').match(Condition.Equals('MEDIUM')))
                  .then('<strong class="govuk-tag govuk-tag--yellow">Medium</strong>')
                  .else('<strong class="govuk-tag govuk-tag--green">Low</strong>'),
              ),
          ),
      },
    },
    {
      key: { text: 'Staff' },
      value: {
        html: when(Data('case.riskScores.staff').match(Condition.Equals('VERY_HIGH')))
          .then('<strong class="govuk-tag govuk-tag--red">Very high</strong>')
          .else(
            when(Data('case.riskScores.staff').match(Condition.Equals('HIGH')))
              .then('<strong class="govuk-tag govuk-tag--red">High</strong>')
              .else(
                when(Data('case.riskScores.staff').match(Condition.Equals('MEDIUM')))
                  .then('<strong class="govuk-tag govuk-tag--yellow">Medium</strong>')
                  .else('<strong class="govuk-tag govuk-tag--green">Low</strong>'),
              ),
          ),
      },
    },
  ],
})

export const sentenceHeading = GovUKHeading({ text: 'Sentence', size: 'm' })

export const sentenceDetails = GovUKSummaryList({
  rows: [
    { key: { text: 'Type' }, value: { text: Data('case.sentence.type') } },
    { key: { text: 'Start date' }, value: { text: Data('case.sentence.startDate') } },
    { key: { text: 'End date' }, value: { text: Data('case.sentence.endDate') } },
  ],
})

export const goalsHeading = GovUKHeading({ text: 'Goals', size: 'm' })

export const goalsSummary = GovUKBody({
  text: Format('%1 of %2 goals achieved', Data('goalsAchieved'), Data('goalsTotal')),
  classes: 'govuk-!-font-weight-bold',
})

export const complianceHeading = GovUKHeading({ text: 'Compliance', size: 'm' })

export const complianceSummary = GovUKBody({
  text: Format('%1% attendance rate', Data('complianceRate')),
  classes: 'govuk-!-font-weight-bold',
})

export const nextButton = GovUKLinkButton({
  text: 'See the refactored version',
  href: '/forge-developer-guide/patterns/demos/inline-functions/after',
})
