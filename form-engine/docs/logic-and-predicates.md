# Logic and Predicates Documentation

## Overview
The form system uses a declarative logic system for conditional behavior, validation rules, and dynamic values for block properties.
This system allows you to build complex logical expressions using a fluent, readable API that compiles to structured JSON for evaluation.

## Core Concepts

### Rules and Predicates
The logic system is built around **rules** that follow an "if-then-else" pattern:
- **Predicate**: A condition that evaluates to true or false
- **Then Value**: What happens when the predicate is true (optional, defaults to `true`)
- **Else Value**: What happens when the predicate is false (optional, defaults to `false`)

```typescript
// Basic rule structure
when(predicate).then(value).else(otherValue)

// Outputs a CompiledRule:
{
  type: 'conditional',
  predicate: PredicateExpr,
  thenValue: 'value',
  elseValue: 'otherValue'
}
```

### Predicate Types
1. **Test Predicates**: Compare a subject against a condition function
2. **Logic Predicates**: Combine multiple predicates with logical operators

## 1. Building Test Predicates
Test predicates evaluate whether a subject passes a specific condition.
They use the pattern: `Reference().match(condition)`.

### Basic Structure

```typescript
// Pattern: Reference().match(condition)
Self().match(Condition.IsRequired())
Answer('email').match(Condition.IsEmail())
Data('user.age').match(Condition.GreaterThan(18))
```

### Negation with `.not`

```typescript
// Check if field is NOT required (is empty)
Self().not.match(Condition.IsRequired())

// Check if email is NOT valid
Answer('email').not.match(Condition.IsEmail())

// Check if age is NOT over 18
Data('user.age').not.match(Condition.GreaterThan(18))
```

### Output Structure
Test predicates compile to this JSON structure:

```typescript
// Self().not.match(Condition.IsRequired())
{
  type: 'test',
  subject: { type: 'reference', path: ['@self'] },
  negate: true,
  condition: { type: 'function', name: 'isRequired', arguments: [] }
}
```

## 2. Logical Operators
Combine multiple predicates with logical operators to create complex conditions.

### `and()` - All Must Be True

```typescript
// Both conditions must be true
validation({
  when: and(
    Self().not.match(Condition.IsRequired()),
    Answer('optional_field').not.match(Condition.IsRequired())
  ),
  message: 'Both fields are empty'
})

// Multiple conditions
when(
  and(
    Answer('age').match(Condition.GreaterThan(18)),
    Answer('country').match(Condition.Equals('UK')),
    Answer('terms_accepted').match(Condition.Equals(true))
  )
).then('Eligible for service')
```

### `or()` - Any Can Be True

```typescript
// Either condition can be true
validation({
  when: or(
    Answer('phone').not.match(Condition.IsRequired()),
    Answer('email').not.match(Condition.IsRequired())
  ),
  message: 'Provide either phone or email'
})

// Multiple alternatives
when(
  or(
    Data('user.role').match(Condition.MatchesValue('admin')),
    Data('user.role').match(Condition.MatchesValue('moderator')),
    Data('user.permissions').match(Condition.Contains('edit'))
  )
).then('Has edit permissions')
```

### `xor()` - Exactly One Must Be True

```typescript
// Exactly one of these should be true, not both
validation({
  when: not(xor(
    Answer('pickup').match(Condition.MatchesValue(true)),
    Answer('delivery').match(Condition.MatchesValue(true))
  )),
  message: 'Choose either pickup or delivery, not both'
})

// Either start with A OR end with Z, but not both
when(
  xor(
    Self().match(Condition.StartsWith('A')),
    Self().match(Condition.EndsWith('Z'))
  )
).then('Valid format')
```

### `not()` - Invert Logic

```typescript
// Invert an entire logical expression for validation
validation({
  when: not(
    and(
      Answer('terms').match(Condition.MatchesValue(true)),
      Answer('privacy').match(Condition.MatchesValue(true))
    )
  ),
  message: 'Must accept both terms and privacy policy'
})

// Equivalent to using .not on individual predicates
validation({
  when: or(
    Answer('terms').not.match(Condition.MatchesValue(true)),
    Answer('privacy').not.match(Condition.MatchesValue(true))
  ),
  message: 'Must accept both terms and privacy policy'
})
```

## 3. Complex Logic Examples

### Nested Logical Expressions

```typescript
// Complex validation with multiple levels of logic
validate: [
  validation({
    when: or(
      // Either both fields are empty
      and(
        Self().not.match(Condition.IsRequired()),
        Answer('related_field').not.match(Condition.IsRequired())
      ),
      // OR exactly one validation issue exists
      xor(
        Self().not.match(Condition.HasMaxLength(200)),
        and(
          Self().not.match(Condition.AlphanumericWithCommonPunctuation()),
          Self().not.match(Condition.IsRequired())
        )
      )
    ),
    message: "Please enter a valid value"
  })
]
```

## 5. JSON Output

The logic system compiles to structured JSON that can be evaluated by the AST:

### Simple Test Predicate
```typescript
// Input
validation({
  when: Self().not.match(Condition.IsRequired()),
  message: 'This field is required'
})

// Output
{
  type: 'validation',
  when: {
    type: 'test',
    subject: { type: 'reference', path: ['@self'] },
    negate: true,
    condition: { type: 'function', name: 'isRequired', arguments: [] }
  },
  message: 'This field is required'
}
```

### Complex Logic Expression
```typescript
// Input
when(
  and(
    Self().match(Condition.IsRequired()),
    Answer('other_field').not.match(Condition.IsRequired())
  )
).then('Show').else('Hide')

// Output
{
  type: 'conditional',
  predicate: {
    type: 'logic',
    op: 'and',
    operands: [
      {
        type: 'test',
        subject: { type: 'reference', path: ['@self'] },
        negate: false,
        condition: { type: 'function', name: 'isRequired', arguments: [] }
      },
      {
        type: 'test',
        subject: { type: 'reference', path: ['answers', 'other_field'] },
        negate: true,
        condition: { type: 'function', name: 'isRequired', arguments: [] }
      }
    ]
  },
  thenValue: 'Show',
  elseValue: 'Hide'
}
```

## 6. Best Practices
As you might be able to tell, you can go pretty wild with the logic predicate options, and build some very
complex rules quite quickly. If you find yourself repeating rules often, turn them into variables and reuse them!
```typescript
// Break complex logic into readable, reusable  chunks
const isBusinessUser = Answer('account_type').match(Condition.Equals('business'))
const hasValidTaxId = Answer('tax_id').match(Condition.IsRequired())
const isVerified = Data('user.verified').match(Condition.Equals(true))

when(
  and(isBusinessUser, hasValidTaxId, isVerified)
).then('/business-dashboard')

// Use 'and' when all conditions must be met
when(and(userIsLoggedIn, hasPermission, resourceExists))

// Use 'or' for alternative valid states
when(or(isAdmin, isOwner, hasEditRights))

// Use 'xor' for mutually exclusive options
when(xor(useEmailNotification, useSmsNotification))

// Use 'not' to invert complex expressions
when(not(and(isGuest, isRestrictedContent)))
```
