# Iterators Documentation

## Overview

Iterators provide a composable way to perform per-item operations on collections. They allow you to filter, transform, and search through arrays or objects using `Item()` references to access each element during iteration.

Iterators are used with the `.each()` method on any reference or expression that evaluates to an array or object. Multiple iterators can be chained together, and the result can be further processed with `.pipe()` for whole-array transformations.

When iterating over objects, use `Item().key()` to access the property name and `Item().path()` to access the value's properties.

## Core Concepts

### Iterator vs Transformer

- **Iterators** operate on each item individually with access to `Item()` references
- **Transformers** operate on the entire array as a whole

```typescript
// Iterator: filter items one by one using Item()
Data('users').each(
  Iterator.Filter(Item().path('active').match(Condition.IsTrue()))
)

// Transformer: slice the entire array
Data('users').pipe(Transformer.Array.Slice(0, 10))

// Combined: filter then slice
Data('users')
  .each(Iterator.Filter(Item().path('active').match(Condition.IsTrue())))
  .pipe(Transformer.Array.Slice(0, 10))
```

### Available Iterators

- **`Iterator.Map`** - Transform each item to a new shape
- **`Iterator.Filter`** - Keep items matching a predicate
- **`Iterator.Find`** - Return first item matching a predicate

## 1. Iterator.Map - Transform Items

Transforms each item in the collection to a new shape. The template can contain `Item()` references that are resolved for each element.

### Basic Usage

```typescript
// Transform items to label/value pairs for a select input
items: Data('countries')
  .each(Iterator.Map({
    value: Item().path('code'),
    text: Item().path('name'),
  }))

// Extract a single property from each item
Data('users').each(Iterator.Map(Item().path('email')))
// ['alice@example.com', 'bob@example.com', ...]
```

### Complex Transformations

```typescript
// Transform with nested structures
Data('orders')
  .each(Iterator.Map({
    id: Item().path('orderId'),
    customer: {
      name: Item().path('customerName'),
      email: Item().path('customerEmail'),
    },
    total: Item().path('amount'),
  }))

// Transform with computed values using Format
Data('users')
  .each(Iterator.Map({
    value: Item().path('id'),
    text: Format('%1 (%2)', Item().path('name'), Item().path('email')),
  }))
```

## 2. Iterator.Filter - Keep Matching Items

Keeps only the items where the predicate evaluates to true. Returns an array of the original items that passed the filter.

### Basic Usage

```typescript
// Keep only active users
Data('users')
  .each(Iterator.Filter(
    Item().path('active').match(Condition.IsTrue())
  ))

// Exclude items matching a value
Data('areas')
  .each(Iterator.Filter(
    Item().path('slug').not.match(Condition.Equals(Params('currentArea')))
  ))
```

### Complex Predicates

```typescript
// Multiple conditions with and()
Data('products')
  .each(Iterator.Filter(
    and(
      Item().path('inStock').match(Condition.IsTrue()),
      Item().path('price').match(Condition.LessThan(100))
    )
  ))

// Filter with or()
Data('users')
  .each(Iterator.Filter(
    or(
      Item().path('role').match(Condition.Equals('admin')),
      Item().path('role').match(Condition.Equals('moderator'))
    )
  ))
```

## 3. Iterator.Find - Get First Match

Returns the first item where the predicate evaluates to true. Unlike Filter, this returns a single item (or `undefined` if no match is found), not an array.

### Basic Usage

```typescript
// Find user by ID
Data('users')
  .each(Iterator.Find(
    Item().path('id').match(Condition.Equals(Params('userId')))
  ))

// Find first active item
Data('items')
  .each(Iterator.Find(
    Item().path('status').match(Condition.Equals('active'))
  ))
```

### Using Find Results

```typescript
// Find returns a single item, so you can access its properties
label: Data('categories')
  .each(Iterator.Find(
    Item().path('id').match(Condition.Equals(Answer('selectedCategory')))
  ))
  .pipe(Transformer.Object.Get('name'))

// Use in conditional logic
dependent: when(
  Data('users')
    .each(Iterator.Find(
      Item().path('id').match(Condition.Equals(Params('userId')))
    ))
    .match(Condition.IsRequired())
)
```

## 4. Chaining Iterators

Multiple iterators can be chained with successive `.each()` calls. Each iterator operates on the result of the previous one.

### Filter then Map

```typescript
// Filter to active items, then transform to select options
items: Data('areas')
  .each(Iterator.Filter(
    Item().path('slug').not.match(Condition.Equals(Params('areaOfNeed')))
  ))
  .each(Iterator.Map({
    value: Item().path('value'),
    text: Item().path('text'),
  }))
```

### Multiple Filters

```typescript
// Apply multiple filter conditions in sequence
Data('products')
  .each(Iterator.Filter(Item().path('available').match(Condition.IsTrue())))
  .each(Iterator.Filter(Item().path('category').match(Condition.Equals('electronics'))))
  .each(Iterator.Filter(Item().path('price').match(Condition.LessThan(500))))
```

### Exiting Iteration with .pipe()

After iterating, use `.pipe()` to apply whole-array transformations:

```typescript
// Filter, map, then slice to first 10
Data('items')
  .each(Iterator.Filter(Item().path('active').match(Condition.IsTrue())))
  .each(Iterator.Map({ label: Item().path('name') }))
  .pipe(Transformer.Array.Slice(0, 10))
```

## 5. Using with Literal()

For static arrays defined in your form configuration, wrap them with `Literal()` to use iterators:

```typescript
const areasOfNeed = [
  { slug: 'accommodation', value: 'area_accommodation', text: 'Accommodation' },
  { slug: 'finances', value: 'area_finances', text: 'Finances' },
  { slug: 'health', value: 'area_health', text: 'Health and wellbeing' },
]

// Use Literal() to make static arrays iterable
items: Literal(areasOfNeed)
  .each(Iterator.Filter(
    Item().path('slug').not.match(Condition.Equals(Params('currentArea')))
  ))
  .each(Iterator.Map({
    value: Item().path('value'),
    text: Item().path('text'),
  }))
```

## 6. Item() References

Inside iterators, use `Item()` to reference the current element being processed.

### Property Access

```typescript
Item().path('name')           // Access item.name
Item().path('address.city')   // Access nested property
Item().value()                // Access the entire item
Item().index()                // Access the 0-based iteration index
Item().key()                  // Access the key when iterating over objects
```

### Parent Scope (Nested Iterations)

When iterating within an iteration, use `.parent` to access outer scope:

```typescript
Item().parent.path('groupId')         // Parent item's groupId
Item().parent.parent.path('orgId')    // Grandparent's orgId
```

### Using Index

```typescript
// Include index in transformed output
Data('items')
  .each(Iterator.Map({
    position: Item().index(),
    name: Item().path('name'),
  }))

// Use index in dynamic field codes
field({
  code: Format('item_%1_name', Item().index()),
  // ...
})
```

## 7. Nested Iterators

You can nest iterators to process hierarchical data structures. Use `Item().parent` to access the outer iteration's scope.

### Basic Nested Iteration

```typescript
// Data structure:
// departments: [
//   { name: 'Engineering', employees: [{ name: 'Alice' }, { name: 'Bob' }] },
//   { name: 'Sales', employees: [{ name: 'Carol' }] }
// ]

// Flatten employees with their department names
Data('departments')
  .each(Iterator.Map(
    Item().path('employees').each(Iterator.Map({
      employeeName: Item().path('name'),
      departmentName: Item().parent.path('name'),
    }))
  ))
  .pipe(Transformer.Array.Flatten())

// Result: [
//   { employeeName: 'Alice', departmentName: 'Engineering' },
//   { employeeName: 'Bob', departmentName: 'Engineering' },
//   { employeeName: 'Carol', departmentName: 'Sales' }
// ]
```

### Nested Filter and Map

```typescript
// Get active employees from each department
Data('departments')
  .each(Iterator.Map({
    department: Item().path('name'),
    activeEmployees: Item().path('employees')
      .each(Iterator.Filter(
        Item().path('active').match(Condition.IsTrue())
      ))
      .each(Iterator.Map(Item().path('name'))),
  }))
```

### Multiple Parent Levels

```typescript
// Three levels deep: organisation → department → employee
Data('organisations')
  .each(Iterator.Map(
    Item().path('departments').each(Iterator.Map(
      Item().path('employees').each(Iterator.Map({
        orgName: Item().parent.parent.path('name'),
        deptName: Item().parent.path('name'),
        empName: Item().path('name'),
      }))
    ))
  ))
  .pipe(Transformer.Array.Flatten())
  .pipe(Transformer.Array.Flatten())
```

### Generating Dynamic Field Codes

```typescript
// Create unique field codes using parent context
Data('sections')
  .each(Iterator.Map(
    Item().path('questions').each(Iterator.Map(
      field({
        variant: 'govukTextInput',
        code: Format(
          'section_%1_question_%2',
          Item().parent.path('sectionId'),
          Item().path('questionId')
        ),
        label: Item().path('label'),
      })
    ))
  ))
```

## 8. Iterating Over Objects

Iterators work with both arrays and objects. When you iterate over an object, each entry becomes accessible with `Item().key()` for the property name and `Item().path()` for the value's properties.

### Object with Object Values

```typescript
// Data structure:
// scores: {
//   accommodation: { score: 5, label: 'Accommodation' },
//   finances: { score: 3, label: 'Finances' },
//   health: { score: 4, label: 'Health' }
// }

// Transform to array with key included
Data('scores')
  .each(Iterator.Map({
    slug: Item().key(),           // 'accommodation', 'finances', 'health'
    score: Item().path('score'),  // 5, 3, 4
    label: Item().path('label'),  // 'Accommodation', 'Finances', 'Health'
  }))

// Result: [
//   { slug: 'accommodation', score: 5, label: 'Accommodation' },
//   { slug: 'finances', score: 3, label: 'Finances' },
//   { slug: 'health', score: 4, label: 'Health' }
// ]
```

### Object with Primitive Values

When object values are primitives (not objects), access them via `@value`:

```typescript
// Data structure:
// scores: { accommodation: 5, finances: 3, health: 4 }

Data('scores')
  .each(Iterator.Map({
    area: Item().key(),           // 'accommodation', 'finances', 'health'
    score: Item().path('@value'), // 5, 3, 4
  }))

// Result: [
//   { area: 'accommodation', score: 5 },
//   { area: 'finances', score: 3 },
//   { area: 'health', score: 4 }
// ]
```

### Filtering Object Entries

```typescript
// Keep only entries where score > 3
Data('scores')
  .each(Iterator.Filter(
    Item().path('score').match(Condition.Number.GreaterThan(3))
  ))
  .each(Iterator.Map({
    area: Item().key(),
    score: Item().path('score'),
  }))
```

### Finding an Object Entry

```typescript
// Find the entry with highest priority
Data('areas')
  .each(Iterator.Find(
    Item().path('isPriority').match(Condition.IsTrue())
  ))
  .pipe(Transformer.Object.Get('label'))
```

## 9. Common Patterns

### Select/Checkbox Items from Data

```typescript
// Generate checkbox items from external data
field<GovUKCheckboxInput>({
  variant: 'govukCheckboxInput',
  code: 'selectedAreas',
  items: Data('areas')
    .each(Iterator.Map({
      value: Item().path('id'),
      text: Item().path('name'),
      hint: { text: Item().path('description') },
    })),
})
```

### Filtered Dropdown Options

```typescript
// Show all options except the currently selected one
field<GovUKSelect>({
  variant: 'govukSelect',
  code: 'relatedArea',
  items: Data('areas')
    .each(Iterator.Filter(
      Item().path('id').not.match(Condition.Equals(Answer('primaryArea')))
    ))
    .each(Iterator.Map({
      value: Item().path('id'),
      text: Item().path('name'),
    })),
})
```

### Lookup by ID

```typescript
// Display name of selected item
block<HtmlBlock>({
  variant: 'html',
  content: Format(
    'Selected: %1',
    Data('categories')
      .each(Iterator.Find(
        Item().path('id').match(Condition.Equals(Answer('categoryId')))
      ))
      .pipe(Transformer.Object.Get('name'))
  ),
})
```
