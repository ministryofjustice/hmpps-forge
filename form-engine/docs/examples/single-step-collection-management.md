# Single Step Collection Management
This is one of the more complex flows you'll see in the form system,
it is a flow where the user can manage a collection from a single step.
For this flow, we only validate when the user goes to save and continue, not
when they are just deleting or adding new rows. We only commit the updated
collection to persistent storage on a `save-and-continue` action.

## Example in Typescript
```typescript
const URLs = {
  addresses: '/addresses',
  employmentStatus: '/employmentStatus',
}

export const collectionExampleJourney = journey({
  code: 'collection_example_journey',
  title: 'Single Step Example Collection Journey',
  steps: [
    step({
      path: URLs.addresses,
      blocks: [/*...*/],
      transitions: [
        // Handle continue
        transition({
          // On save, map fields from the POST data to their relevant properties in the collection item.
          when: Post('action').match(Condition.MatchesValue('save-and-continue')),
          validate: true,
          onAlways: {
            effects: [
              Effect.mapToCollection({
                collection: Answer('addresses'),
                item: [
                  { property: 'street', regexMatch: ['^address-(.+)-street$', 1], source: Post() },
                  { property: 'city', regexMatch: ['^address-(.+)-city$', 1], source: Post() },
                  { property: 'postcode', regexMatch: ['^address-(.+)-postcode$', 1], source: Post() },
                ],
              }),
            ],
          },
          onValid: {
            effects: [Effect.save()],
            next: [{ goto: URLs.employmentStatus }],
          },
          onInvalid: {
            effects: [Effect.save({ draft: true })],
            next: [{ goto: URLs.addresses }],
          },
        }),

        // Handle add-another
        transition({
          // Add a new field into the collection with blank entries.
          when: Post('action').match(Condition.MatchesValue('add-another')),
          validate: false,
          onAlways: {
            effects: [
              Effect.mapToCollection({
                collection: Answer('addresses'),
                item: [
                  { property: 'street', regexMatch: ['^address-(.+)-street$', 1], source: Post() },
                  { property: 'city', regexMatch: ['^address-(.+)-city$', 1], source: Post() },
                  { property: 'postcode', regexMatch: ['^address-(.+)-postcode$', 1], source: Post() },
                ],
              }),
              Effect.addToCollection({
                collection: Answer('addresses'),
                item: [{ street: '', city: '', postcode: '' }],
              }),
              Effect.save({ draft: true }),
            ],
            next: [{ goto: URLs.addresses }],
          },
        }),

        // Handle delete
        transition({
          // Remove a field into the collection when a user clicks the submit button linked to that row.
          when: Post('action').match(Condition.MatchesRegex('^delete-address-(.+)$')),
          validate: false,
          onAlways: {
            effects: [
              Effect.mapToCollection({
                collection: Answer('addresses'),
                item: [
                  { property: 'street', regexMatch: ['^address-(.+)-street$', 1], source: Post() },
                  { property: 'city', regexMatch: ['^address-(.+)-city$', 1], source: Post() },
                  { property: 'postcode', regexMatch: ['^address-(.+)-postcode$', 1], source: Post() },
                ],
              }),
              Effect.removeFromCollection({
                collection: Answer('addresses'),
                target: Post('action').pipe(
                  // Capture the address to delete from an action button i.e `delete-address-3` -> 3
                  Transformer.regexCapture('^delete-address-(.+)$', 1),
                ),
              }),
              Effect.save({ draft: true }),
            ],
            next: [{ goto: URLs.addresses }],
          },
        }),
      ],
    }),
  ],
})
```
