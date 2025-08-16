# Branching steps/journey
This is an example of a classic GOVUK style flow with branching navigations
based on answers provided within the form. Every answer is stored in a draft state
until the final check answers stage where the user confirms their answers.

## Example in Typescript

```typescript
const URLs = {
  yourName: '/your-name',
  employmentStatus: '/employment-status',
  employedDetails: '/employed-details',
  unemployedDetails: '/unemployed-details',
  summary: '/check-answers',
  submitted: '/submitted',
}

export const branchingExample = journey({
  code: 'branching_example',
  title: 'Branching example',
  steps: [
    // 1) Your name
    step({
      path: URLs.yourName,
      blocks: [/*...*/],
      transitions: [
        transition({
          when: Post('action').match(Condition.MatchesValue('continue')),
          validate: true,
          onValid: {
            effects: [Effect.save({ draft: true })],
            next: [{ goto: URLs.employmentStatus }],
          },
          onInvalid: {
            next: [{ goto: URLs.yourName }],
          },
        }),
      ],
    }),

    // 2) Employment status
    step({
      path: URLs.employmentStatus,
      blocks: [/*...*/],
      transitions: [
        transition({
          when: Post('action').match(Condition.MatchesValue('continue')),
          validate: true,
          onValid: {
            effects: [Effect.save({ draft: true })],
            next: [
              {
                when: Answer('employment_status').match(Condition.MatchesValue('employed')),
                goto: URLs.employedDetails,
              },
              {
                when: Answer('employment_status').match(Condition.MatchesValue('unemployed')),
                goto: URLs.unemployedDetails,
              },
            ],
          },
          onInvalid: {
            next: [{ goto: URLs.employmentStatus }],
          },
        }),
      ],
    }),

    // 3a) Employed details
    step({
      path: URLs.employedDetails,
      blocks: [/*...*/],
      transitions: [
        transition({
          when: Post('action').match(Condition.MatchesValue('continue')),
          validate: true,
          onValid: {
            effects: [Effect.save({ draft: true })],
            next: [{ goto: URLs.summary }],
          },
          onInvalid: {
            next: [{ goto: URLs.employedDetails }],
          },
        }),
      ],
    }),

    // 3b) Unemployed details
    step({
      path: URLs.unemployedDetails,
      blocks: [/*...*/],
      transitions: [
        transition({
          when: Post('action').match(Condition.MatchesValue('continue')),
          validate: true,
          onValid: {
            effects: [Effect.save({ draft: true })],
            next: [{ goto: URLs.summary }],
          },
          onInvalid: {
            next: [{ goto: URLs.unemployedDetails }],
          },
        }),
      ],
    }),

    // 4) Check answers
    step({
      path: URLs.summary,
      blocks: [/*...*/],
      transitions: [
        transition({
          when: Post('action').match(Condition.MatchesValue('submit')),
          validate: false,
          onAlways: {
            effects: [Effect.save()],
            next: [{ goto: URLs.submitted }],
          },
        }),
      ],
    }),

    // 5) Submitted
    step({
      path: URLs.submitted,
      blocks: [/*...*/],
      transitions: [],
    }),
  ],
})
```
