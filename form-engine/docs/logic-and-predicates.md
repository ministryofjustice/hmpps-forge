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
  type: 'LogicType.Conditional',
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

### Alternative Methods
> [!WARNING]
> I don't know how I feel about this but I struggled to come up with one nice word to use.
> We could probably boil this down to one single option and then remove the aliases.

The system provides semantic aliases for better readability:

```typescript
// All equivalent - use whichever reads better in context
Self().match(Condition.IsRequired())
Self().passes(Condition.IsRequired())
Self().satisfies(Condition.IsRequired())
Self().meets(Condition.IsRequired())
```

### Output Structure

Test predicates compile to this JSON structure:

```typescript
// Self().not.match(Condition.IsRequired())
{
  type: 'LogicType.Test',
  subject: { type: 'ExpressionType.Reference', path: ['@self'] },
  negate: true,
  condition: { type: 'FunctionType.Condition', name: 'isRequired', arguments: [] }
}
```

## 2. Logical Operators

Combine multiple predicates with logical operators to create complex conditions.

### `and()` - All Must Be True

```typescript
// Both conditions must be true
when(
  and(
    Self().not.match(Condition.IsRequired()),
    Answer('optional_field').not.match(Condition.IsRequired())
  )
).then('Both fields are empty')

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
when(
  or(
    Answer('phone').match(Condition.IsRequired()),
    Answer('email').match(Condition.IsRequired())
  )
).then('Contact method provided')

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
when(
  xor(
    Answer('pickup').match(Condition.MatchesValue(true)),
    Answer('delivery').match(Condition.MatchesValue(true))
  )
).then('Valid fulfillment option')

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
// Invert an entire logical expression
when(
  not(
    and(
      Answer('terms').match(Condition.MatchesValue(true)),
      Answer('privacy').match(Condition.MatchesValue(true))
    )
  )
).then('Must accept both terms and privacy policy')

// Equivalent to using .not on individual predicates
when(
  or(
    Answer('terms').not.match(Condition.MatchesValue(true)),
    Answer('privacy').not.match(Condition.MatchesValue(true))
  )
).then('Must accept both terms and privacy policy')
```

## 3. Complex Logic Examples

### Nested Logical Expressions

```typescript
// Complex validation with multiple levels of logic
validate: [
  when(
    or(
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
    )
  ).then("Please enter a valid value")
]
```

## 5. JSON Output

The logic system compiles to structured JSON that can be evaluated by the AST:

### Simple Test Predicate
```typescript
// Input
when(Self().not.match(Condition.IsRequired())).then('Required')

// Output
{
  type: 'LogicType.Conditional',
  predicate: {
    type: 'LogicType.Test',
    subject: { type: 'ExpressionType.Reference', path: ['@self'] },
    negate: true,
    condition: { type: 'FunctionType.Condition', name: 'isRequired', arguments: [] }
  },
  thenValue: 'Required',
  elseValue: false
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
  type: 'LogicType.Conditional',
  predicate: {
    type: 'LogicType.And',
    operands: [
      {
        type: 'LogicType.Test',
        subject: { type: 'ExpressionType.Reference', path: ['@self'] },
        negate: false,
        condition: { type: 'FunctionType.Condition', name: 'isRequired', arguments: [] }
      },
      {
        type: 'LogicType.Test',
        subject: { type: 'ExpressionType.Reference', path: ['answers', 'other_field'] },
        negate: true,
        condition: { type: 'FunctionType.Condition', name: 'isRequired', arguments: [] }
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
