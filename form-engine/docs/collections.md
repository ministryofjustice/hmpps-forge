# Collections

Collections let you work with lists of items in your forms. Form-engine provides two complementary patterns for handling collections: iteration for rendering repeated content, and hub-and-spoke for full CRUD management.

This enables:
- Displaying lists of items from API data
- Generating table rows and repeated field groups
- Building "add/edit/remove" interfaces for list management
- Creating dynamic fields with unique codes per item

## Two Patterns for Collections

| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| **Collection Iteration** | Render repeated content from arrays | Display lists, generate tables, repeated read-only content |
| **Hub-and-Spoke** | Full CRUD with dedicated edit pages | Users need to add, edit, and remove items |

Often you'll use both together: the hub page uses Collection Iteration to display items, while the full hub-and-spoke pattern handles CRUD operations.

### Import

```typescript
import {
  Collection, Item,
  Data, Answer, Format,
  block, field,
} from '@form-engine/form/builders'

import { CollectionBlock } from '@form-engine/registry/components/collectionBlock'
```

---

## Collection Iteration

Use `Collection()` to iterate over arrays and render blocks for each item. Access each item's data with the `Item()` reference.

### The `Collection()` Expression

```typescript
Collection({
  collection: Data('items'),    // Array to iterate
  template: [/* blocks */],     // Rendered for each item
  fallback: [/* blocks */],     // Optional: shown when empty
})
```

**Properties:**
- `collection` (Required): The data source - an array to iterate over
- `template` (Required): Blocks to render for each item
- `fallback` (Optional): Blocks shown when the array is empty

### Basic Usage

```typescript
block<CollectionBlock>({
  variant: 'collection-block',
  collection: Collection({
    collection: Data('people'),
    template: [
      block<HtmlBlock>({
        variant: 'html',
        content: Format(
          '<p><strong>%1</strong>: %2</p>',
          Item().path('name'),
          Item().path('email')
        ),
      }),
    ],
    fallback: [
      block<HtmlBlock>({
        variant: 'html',
        content: '<p>No people found.</p>',
      }),
    ],
  }),
})
```

### The `Item()` Reference

Inside a collection template, `Item()` refers to the current iteration item:

```typescript
// Access item properties
Item().path('name')           // item.name
Item().path('address.city')   // item.address.city (nested)

// Get the full item object
Item().value()                // the entire item

// Get the iteration index (0-based)
Item().index()                // 0, 1, 2, ...

// Display 1-based numbers to users
Item().index().pipe(Transformer.Number.Add(1))  // 1, 2, 3, ...

// Access parent scope (in nested collections)
Item().parent.path('name')    // parent item's name
```

### Data Sources

The `collection` property accepts various data sources:

```typescript
// Data reference (loaded from API/effects)
Collection({
  collection: Data('users'),
  template: [...],
})

// Answer reference (user-provided array)
Collection({
  collection: Answer('selectedItems'),
  template: [...],
})

// Static array (for fixed content)
Collection({
  collection: ['Option A', 'Option B', 'Option C'],
  template: [...],
})

// Nested data (for inner collections)
Collection({
  collection: Item().path('children'),
  template: [...],
})
```

### Nested Collections

Collections can be nested. Use `Item().parent` to access the outer scope:

```typescript
// Data structure:
// categories: [
//   { name: 'Electronics', products: [{ name: 'Phone' }, { name: 'Laptop' }] },
//   { name: 'Books', products: [{ name: 'Novel' }] },
// ]

Collection({
  collection: Data('categories'),
  template: [
    block<HtmlBlock>({
      variant: 'html',
      content: Format('<h3>%1</h3>', Item().path('name')),
    }),

    // Inner collection: products within category
    block<CollectionBlock>({
      variant: 'collection-block',
      collection: Collection({
        collection: Item().path('products'),
        template: [
          block<HtmlBlock>({
            variant: 'html',
            content: Format(
              '<p>%1 (in %2)</p>',
              Item().path('name'),         // Product name (current scope)
              Item().parent.path('name'),  // Category name (parent scope)
            ),
          }),
        ],
      }),
    }),
  ],
})
```

### Dynamic Field Codes

Use `Format()` with `Item().index()` to create unique field codes:

```typescript
Collection({
  collection: Data('items'),
  template: [
    field<GovUKTextInput>({
      variant: 'govukTextInput',
      // Unique code: item_0_name, item_1_name, etc.
      code: Format('item_%1_name', Item().index()),

      // Display 1-based position to users
      label: Format('Name for item %1',
        Item().index().pipe(Transformer.Number.Add(1))
      ),

      // Pre-populate from item data
      defaultValue: Item().path('name'),
    }),
  ],
})
```

---

## Hub-and-Spoke Pattern

The hub-and-spoke pattern lets users manage a collection through a central list page (hub) with dedicated edit pages (spokes) for each item.

### Architecture Overview

- **Hub page** displays the collection and provides navigation to add/edit items
- **Spoke pages** handle editing with forms and save operations
- **Effects** manage loading, saving, and removing items

### URL Structure

| URL | Purpose |
|-----|---------|
| `/items` | Hub: list all items |
| `/items/new/edit` | Spoke: create new item |
| `/items/:itemId/edit` | Spoke: edit existing item |

The convention of using `"new"` as the `itemId` for creating new items simplifies the spoke page logic.

### Hub Page Responsibilities

1. Display the list of items using `Collection()`
2. Provide "Add" navigation to create new items
3. Provide "Edit" links for each existing item

```typescript
step({
  path: '/items',
  title: 'Your Items',

  onLoad: [
    loadTransition({
      effects: [MyEffects.initializeItems()],
    }),
  ],

  blocks: [
    block<HtmlBlock>({
      variant: 'html',
      content: '<h1 class="govuk-heading-l">Your items</h1>',
    }),

    // Display items with edit links
    block<CollectionBlock>({
      variant: 'collection-block',
      collection: Collection({
        collection: Data('items'),
        template: [
          block<HtmlBlock>({
            variant: 'html',
            content: Format(
              `<div class="govuk-summary-card">
                <div class="govuk-summary-card__title-wrapper">
                  <h2 class="govuk-summary-card__title">%1</h2>
                </div>
                <div class="govuk-summary-card__content">
                  <p>%2</p>
                  <a href="items/%3/edit" class="govuk-link">Edit</a>
                </div>
              </div>`,
              Item().path('name'),
              Item().path('description'),
              Item().path('id'),
            ),
          }),
        ],
        fallback: [
          block<HtmlBlock>({
            variant: 'html',
            content: '<p class="govuk-body">No items yet.</p>',
          }),
        ],
      }),
    }),

    // Add button
    block<HtmlBlock>({
      variant: 'html',
      content: `<a href="items/new/edit" class="govuk-button govuk-button--secondary">
        Add item
      </a>`,
    }),

    block<GovUKButton>({
      variant: 'govukButton',
      text: 'Continue',
    }),
  ],

  onSubmission: [
    submitTransition({
      validate: false,
      onAlways: {
        next: [next({ goto: 'next-step' })],
      },
    }),
  ],
})
```

### Spoke Page Responsibilities

1. URL parameter (`:itemId`) identifies which item
2. Load effect populates form with existing data (or empty for "new")
3. Access control redirects if item not found
4. Save effect persists changes
5. Navigation returns to hub

```typescript
step({
  path: '/items/:itemId/edit',
  title: 'Edit Item',

  // Hide from step progress navigation
  view: {
    hiddenFromNavigation: true,
  },

  onLoad: [
    loadTransition({
      effects: [MyEffects.loadItem()],
    }),
  ],

  onAccess: [
    accessTransition({
      guards: Data('itemNotFound').match(Condition.Equals(true)),
      redirect: [next({ goto: 'items' })],
    }),
  ],

  blocks: [
    // Dynamic heading
    block<HtmlBlock>({
      variant: 'html',
      content: when(Data('isNewItem').match(Condition.Equals(true)))
        .then('<h1 class="govuk-heading-l">Add item</h1>')
        .else('<h1 class="govuk-heading-l">Edit item</h1>'),
    }),

    field<GovUKTextInput>({
      variant: 'govukTextInput',
      code: 'itemName',
      label: 'Name',
      validate: [
        validation({
          when: Self().not.match(Condition.IsRequired()),
          message: 'Enter a name',
        }),
      ],
    }),

    field<GovukTextareaInput>({
      variant: 'govukTextareaInput',
      code: 'itemDescription',
      label: 'Description',
    }),

    block<GovUKButton>({
      variant: 'govukButton',
      text: 'Save',
      name: 'action',
      value: 'save',
    }),

    block<GovUKButton>({
      variant: 'govukButton',
      text: 'Save and add another',
      name: 'action',
      value: 'saveAndAdd',
      classes: 'govuk-button--secondary',
    }),
  ],

  onSubmission: [
    submitTransition({
      when: Post('action').match(Condition.Equals('save')),
      validate: true,
      onValid: {
        effects: [MyEffects.saveItem()],
        next: [next({ goto: 'items' })],
      },
    }),

    submitTransition({
      when: Post('action').match(Condition.Equals('saveAndAdd')),
      validate: true,
      onValid: {
        effects: [MyEffects.saveItem()],
        next: [next({ goto: 'items/new/edit' })],
      },
    }),
  ],
})
```

---

## Collection Effects

Effects handle the data operations for collection management. A typical collection needs four effects.

### Initialize Items

Run on the hub page to ensure items are available:

```typescript
initializeItems: deps => async (context: EffectFunctionContext) => {
  // Load from API
  const items = await deps.api.getItems()
  context.setData('items', items)

  // Or use session storage
  const session = context.getSession()
  if (!session.items) {
    session.items = []
  }
  context.setData('items', session.items)
}
```

### Load Item

Run on the spoke page to populate form fields:

```typescript
loadItem: _deps => (context: EffectFunctionContext) => {
  const itemId = context.getRequestParam('itemId')
  const session = context.getSession()
  const items = session.items || []

  if (itemId === 'new') {
    // Empty form for new item
    context.setAnswer('itemName', '')
    context.setAnswer('itemDescription', '')
    context.setData('isNewItem', true)
  } else {
    // Find and load existing item
    const item = items.find((i: { id: string }) => i.id === itemId)

    if (item) {
      context.setAnswer('itemName', item.name || '')
      context.setAnswer('itemDescription', item.description || '')
      context.setData('isNewItem', false)
    } else {
      context.setData('itemNotFound', true)
    }
  }
}
```

### Save Item

Run on form submission to persist changes:

```typescript
saveItem: deps => async (context: EffectFunctionContext) => {
  const itemId = context.getRequestParam('itemId')
  const session = context.getSession()
  const items = session.items || []

  const itemData = {
    name: context.getAnswer('itemName') as string,
    description: context.getAnswer('itemDescription') as string,
  }

  if (itemId === 'new') {
    // Create new item with generated ID
    const newItem = {
      id: `item_${Date.now()}`,
      ...itemData,
    }
    session.items = [...items, newItem]
  } else {
    // Update existing item
    session.items = items.map((item: { id: string }) =>
      item.id === itemId ? { ...item, ...itemData } : item
    )
  }

  context.setData('items', session.items)
}
```

### Remove Item

Filter out the item by ID:

```typescript
removeItem: deps => async (context: EffectFunctionContext) => {
  const itemId = context.getRequestParam('itemId')
  const session = context.getSession()

  session.items = (session.items || []).filter(
    (item: { id: string }) => item.id !== itemId
  )

  context.setData('items', session.items)
}
```

### Key Context Methods

| Method | Purpose |
|--------|---------|
| `getRequestParam(name)` | Get URL parameter (e.g., `:itemId`) |
| `getSession()` | Access session storage (persists across requests) |
| `setData(key, value)` | Set data for `Data()` references |
| `getData(key)` | Get previously set data |
| `setAnswer(code, value)` | Pre-populate form field value |
| `getAnswer(code)` | Get current answer value |

---

## Best Practices

### Use Stable IDs

Use unique identifiers (UUIDs, database IDs) rather than array indices:

```typescript
// DO: Stable ID
{ id: 'item_abc123', name: 'Widget' }

// DON'T: Array index (breaks when items reorder)
{ index: 0, name: 'Widget' }
```

### Hide Spoke Pages from Navigation

Spoke pages shouldn't appear in step progress indicators:

```typescript
step({
  path: '/items/:itemId/edit',
  view: {
    hiddenFromNavigation: true,
  },
  // ...
})
```

### Handle "Not Found" Gracefully

Always redirect if the item doesn't exist:

```typescript
onAccess: [
  accessTransition({
    guards: Data('itemNotFound').match(Condition.Equals(true)),
    redirect: [next({ goto: 'items' })],
  }),
]
```

### Use "new" Convention for Creating Items

The convention of `/items/new/edit` for new items simplifies spoke page logic:

```typescript
if (itemId === 'new') {
  // Create mode
} else {
  // Edit mode
}
```

### Pre-populate Fields in Load Effects

Use `context.setAnswer()` to populate form fields from item data:

```typescript
// DO: Set answers in load effect
context.setAnswer('itemName', item.name)

// DON'T: Rely only on defaultValue (won't update on edit)
```

---

## Related Topics

- [References and Chaining](references-and-chaining.md) - `Item()` reference details
- [Logic and Expressions](logic-and-expressions.md) - `Collection()` and `Format()` expressions
- [Transitions and Lifecycle](transitions-and-lifecycle.md) - Effects and navigation
