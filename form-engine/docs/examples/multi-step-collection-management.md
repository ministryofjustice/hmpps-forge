# Multi Page Collection Management
For this flow, we are allowing users to add, remove and edit a collection
in a hub-and-spoke style pattern where a summary page acts as the main access point.

## Example in Typescript
```typescript
const URLs = {
  addAddress: '/addresses/new',
  editAddress: '/addresses/$index/edit',
  deleteAddress: '/addresses/$index/delete',
  addressesSummary: '/addresses',
}

// eslint-disable-next-line import/prefer-default-export
export const collectionExampleJourney = journey({
  code: 'multi_step_collection_example_journey',
  title: 'Multi Step Example Collection Journey',
  steps: [
    // Summary page
    step({
      path: URLs.addressesSummary,
      blocks: [/*
      // Summary component with `edit` and `delete` buttons that take you to relevant steps
      // Button which takes you to the `add` page.
      */],
    }),

    // Add address
    step({
      path: URLs.addAddress,
      blocks: [/*...*/],
      transitions: [
        // Handle continue
        transition({
          when: Post('action').match(Condition.MatchesValue('save')),
          validate: true,
          onValid: {
            effects: [
              Effect.addToCollection({
                collection: Answer('addresses'),
                item: [
                  { property: 'street', value: Post('street') },
                  { property: 'city', value: Post('city') },
                  { property: 'postcode', value: Post('postcode') },
                ],
              }),
              Effect.save(),
            ],
            next: [{ goto: URLs.addressesSummary }],
          },
          onInvalid: {
            next: [{ goto: URLs.addAddress }],
          },
        }),
      ],
    }),

    // Edit address
    step({
      path: URLs.editAddress,
      blocks: [/*...*/],
      transitions: [
        transition({
          when: Post('action').match(Condition.MatchesValue('save')),
          validate: true,
          onValid: {
            effects: [
              Effect.replaceInCollection({
                collection: Answer('addresses'),
                target: Params('index'),
                item: [
                  { property: 'street', value: Post('street') },
                  { property: 'city', value: Post('city') },
                  { property: 'postcode', value: Post('postcode') },
                ],
              }),
              Effect.save(),
            ],
            next: [{ goto: URLs.addressesSummary }],
          },
          onInvalid: {
            next: [{ goto: URLs.editAddress }],
          },
        }),
      ],
    }),

    step({
      path: URLs.deleteAddress,
      blocks: [/*...*/],
      transitions: [
        transition({
          when: Post('action').match(Condition.MatchesValue('delete')),
          validate: true,
          onValid: {
            effects: [
              Effect.removeFromCollection({
                collection: Answer('addresses'),
                target: Params('index'),
              }),
              Effect.save(),
            ],
            next: [{ goto: URLs.addressesSummary }],
          },
          onInvalid: {
            next: [{ goto: URLs.deleteAddress }],
          },
        }),
      ],
    }),
  ],
})
```
