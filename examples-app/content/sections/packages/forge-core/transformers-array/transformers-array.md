---
title: Arrays
section: packages
path: packages/forge-core/transformers-array
teaches: [transformer::array, array-transformers]
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

Array transformers are called as `transformer::array::<name>()` and
applied with `.pipe()`:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

data("items").pipe([transformer::array::length()])
data("results").pipe([transformer::array::first()])
answer("selections").pipe([transformer::array::sort()])
```

You can chain them with other transformers:

```rust
data("pages").pipe([transformer::array::length()]).pipe([transformer::number::subtract(1)])
```

All arguments that accept a value also accept an expression:

```rust
data("items").pipe([transformer::array::slice(0, answer("pageSize"))])
```

---

## Element access

### Length

Returns the number of elements in the array.

```rust
data("items").pipe([transformer::array::length()])
// [1, 2, 3, 4] -> 4
```

### First

Returns the first element. Returns `undefined` if the array is
empty.

```rust
data("results").pipe([transformer::array::first()])
// ["alpha", "bravo", "charlie"] -> "alpha"
```

### Last

Returns the last element. Returns `undefined` if the array is
empty.

```rust
data("results").pipe([transformer::array::last()])
// ["alpha", "bravo", "charlie"] -> "charlie"
```

---

## Slicing and combining

### Slice

Returns a portion of the array from a start index to an optional
end index (zero-based, exclusive end).

```rust
data("items").pipe([transformer::array::slice(0, 3)])
// [10, 20, 30, 40, 50] -> [10, 20, 30]
data("items").pipe([transformer::array::slice(2, Value::Undefined)])
// [10, 20, 30, 40, 50] -> [30, 40, 50]
```

### Concat

Concatenates one or more arrays onto the input array.

```rust
data("listA").pipe([transformer::array::concat(vec![data("listB").into()])])
// [1, 2] + [3, 4] -> [1, 2, 3, 4]
```

### Flatten

Flattens a nested array by one level.

```rust
data("nested").pipe([transformer::array::flatten()])
// [[1, 2], [3, 4], [5]] -> [1, 2, 3, 4, 5]
```

---

## Ordering and filtering

### Sort

Sorts the array in ascending order. Numbers sort numerically;
strings sort alphabetically. Returns a new array.

```rust
data("scores").pipe([transformer::array::sort()])
// [3, 1, 4, 2] -> [1, 2, 3, 4]
data("names").pipe([transformer::array::sort()])
// ["Charlie", "Alpha", "Bravo"] -> ["Alpha", "Bravo", "Charlie"]
```

### Reverse

Reverses the order of elements. Returns a new array.

```rust
data("items").pipe([transformer::array::reverse()])
// [1, 2, 3] -> [3, 2, 1]
```

### Filter

Returns only elements that match the specified value.

```rust
answer("tags").pipe([transformer::array::filter("urgent")])
// ["urgent", "normal", "urgent", "low"] -> ["urgent", "urgent"]
```

### Unique

Removes duplicate elements.

```rust
answer("selections").pipe([transformer::array::unique()])
// [1, 2, 2, 3, 1] -> [1, 2, 3]
```

---

## Transformation

### Map

Extracts a property from each element in an array of objects, or an
index from each element in an array of arrays.

```rust
data("users").pipe([transformer::array::map("name")])
// [{name: "John"}, {name: "Jane"}] -> ["John", "Jane"]
data("rows").pipe([transformer::array::map(0)])
// [[1, 2], [3, 4]] -> [1, 3]
```

### Join

Joins array elements into a string with a separator. Defaults to
`,` if no separator is provided.

```rust
data("names").pipe([transformer::array::join(", ")])
// ["Alice", "Bob", "Charlie"] -> "Alice, Bob, Charlie"
answer("selections").pipe([transformer::array::join(" and ")])
// ["red", "blue"] -> "red and blue"
```

---

## Practical examples

### Pagination total pages

Calculate the total number of pages and check if there is a next
page:

```rust
use forge_core::authoring::*;
use forge_core::{Value, obj};

format("Page %1 of %2", [data("currentPage").into(), data("pages").pipe([transformer::array::length()]).into()])
data("currentPage").matches(condition::number::less_than(data("pages").pipe([transformer::array::length()])))
```

### Display a comma-separated list

Show a list of selected options as readable text:

```rust
govuk::BODY.build(obj! {
    "text": format("You selected: %1", [answer("choices").pipe([transformer::array::join(", ")]).into()]),
})
```

### Extract names from a list of objects

Pull a single field out of each item in a collection for display:

```rust
data("contacts").pipe([transformer::array::map("name")]).pipe([transformer::array::sort()]).pipe([transformer::array::join(", ")])
// [{name: "Zara"}, {name: "Ali"}] -> "Ali, Zara"
```

### Get the latest N items

Combine `Reverse` and `Slice` to get the most recent entries:

```rust
data("auditLog").pipe([transformer::array::reverse()]).pipe([transformer::array::slice(0, 5)])
```
