---
title: Arrays
section: packages
path: packages/forge-core/transformers-array
teaches: [Transformer.Array, array-transformers]
prerequisites: [forge-core, transformers]
---

<p class="govuk-caption-xl">Forge Core</p>

# Array transformers
Array transformers operate on collections - extracting elements,
slicing, sorting, deduplicating, and converting arrays into other
shapes. They are applied through `.pipe()` on references that
resolve to arrays.

{{slot:toc}}

---

## How to use them

Array transformers are called as `Transformer.Array.<Name>()` and
applied with `.pipe()`:

```typescript
import { Data, Answer, Transformer } from '@ministryofjustice/hmpps-forge/core/authoring'

Data('items').pipe(Transformer.Array.Length())
Data('results').pipe(Transformer.Array.First())
Answer('selections').pipe(Transformer.Array.Sort())
```

You can chain them with other transformers:

```typescript
Data('pages')
  .pipe(Transformer.Array.Length())
  .pipe(Transformer.Number.Subtract(1))
```

All arguments that accept a value also accept an expression:

```typescript
Data('items').pipe(Transformer.Array.Slice(0, Answer('pageSize')))
```

---

## Element access

### Length

Returns the number of elements in the array.

```typescript
Data('items').pipe(Transformer.Array.Length())
// [1, 2, 3, 4] -> 4
```

### First

Returns the first element. Returns `undefined` if the array is
empty.

```typescript
Data('results').pipe(Transformer.Array.First())
// ["alpha", "bravo", "charlie"] -> "alpha"
```

### Last

Returns the last element. Returns `undefined` if the array is
empty.

```typescript
Data('results').pipe(Transformer.Array.Last())
// ["alpha", "bravo", "charlie"] -> "charlie"
```

---

## Slicing and combining

### Slice

Returns a portion of the array from a start index to an optional
end index (zero-based, exclusive end).

```typescript
Data('items').pipe(Transformer.Array.Slice(0, 3))
// [10, 20, 30, 40, 50] -> [10, 20, 30]

Data('items').pipe(Transformer.Array.Slice(2))
// [10, 20, 30, 40, 50] -> [30, 40, 50]
```

### Concat

Concatenates one or more arrays onto the input array.

```typescript
Data('listA').pipe(Transformer.Array.Concat(Data('listB')))
// [1, 2] + [3, 4] -> [1, 2, 3, 4]
```

### Flatten

Flattens a nested array by one level.

```typescript
Data('nested').pipe(Transformer.Array.Flatten())
// [[1, 2], [3, 4], [5]] -> [1, 2, 3, 4, 5]
```

---

## Ordering and filtering

### Sort

Sorts the array in ascending order. Numbers sort numerically;
strings sort alphabetically. Returns a new array.

```typescript
Data('scores').pipe(Transformer.Array.Sort())
// [3, 1, 4, 2] -> [1, 2, 3, 4]

Data('names').pipe(Transformer.Array.Sort())
// ["Charlie", "Alpha", "Bravo"] -> ["Alpha", "Bravo", "Charlie"]
```

### Reverse

Reverses the order of elements. Returns a new array.

```typescript
Data('items').pipe(Transformer.Array.Reverse())
// [1, 2, 3] -> [3, 2, 1]
```

### Filter

Returns only elements that match the specified value.

```typescript
Answer('tags').pipe(Transformer.Array.Filter('urgent'))
// ["urgent", "normal", "urgent", "low"] -> ["urgent", "urgent"]
```

### Unique

Removes duplicate elements.

```typescript
Answer('selections').pipe(Transformer.Array.Unique())
// [1, 2, 2, 3, 1] -> [1, 2, 3]
```

---

## Transformation

### Map

Extracts a property from each element in an array of objects, or an
index from each element in an array of arrays.

```typescript
Data('users').pipe(Transformer.Array.Map('name'))
// [{name: "John"}, {name: "Jane"}] -> ["John", "Jane"]

Data('rows').pipe(Transformer.Array.Map(0))
// [[1, 2], [3, 4]] -> [1, 3]
```

### Join

Joins array elements into a string with a separator. Defaults to
`,` if no separator is provided.

```typescript
Data('names').pipe(Transformer.Array.Join(', '))
// ["Alice", "Bob", "Charlie"] -> "Alice, Bob, Charlie"

Answer('selections').pipe(Transformer.Array.Join(' and '))
// ["red", "blue"] -> "red and blue"
```

---

## Practical examples

### Pagination total pages

Calculate the total number of pages and check if there is a next
page:

```typescript
import { Data, Format, Condition, Transformer } from '@ministryofjustice/hmpps-forge/core/authoring'

Format('Page %1 of %2', Data('currentPage'), Data('pages').pipe(Transformer.Array.Length()))

Data('currentPage').match(
  Condition.Number.LessThan(Data('pages').pipe(Transformer.Array.Length())),
)
```

### Display a comma-separated list

Show a list of selected options as readable text:

```typescript
GovUKBody({
  text: Format('You selected: %1', Answer('choices').pipe(Transformer.Array.Join(', '))),
})
```

### Extract names from a list of objects

Pull a single field out of each item in a collection for display:

```typescript
Data('contacts')
  .pipe(Transformer.Array.Map('name'))
  .pipe(Transformer.Array.Sort())
  .pipe(Transformer.Array.Join(', '))
// [{name: "Zara"}, {name: "Ali"}] -> "Ali, Zara"
```

### Get the latest N items

Combine `Reverse` and `Slice` to get the most recent entries:

```typescript
Data('auditLog')
  .pipe(Transformer.Array.Reverse())
  .pipe(Transformer.Array.Slice(0, 5))
```
