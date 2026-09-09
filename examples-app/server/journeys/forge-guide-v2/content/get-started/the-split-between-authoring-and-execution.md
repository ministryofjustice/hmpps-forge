---
title: The split between authoring and execution
slug: the-split-between-authoring-and-execution
section: get-started
path: get-started/the-split-between-authoring-and-execution
nav: Thinking with Forge
order: 5
description: Why definitions are data, what references actually produce, and where your application code fits in
teaches: [definition-time, runtime-evaluation, references-as-pointers, expression-boundary, composition]
prerequisites: [building-flows]
---

# The split between authoring and execution

Over the last two pages you've written definitions that use expressions like `Answer('hasPartner').match(Condition.Equals('yes'))`, references like `Data('team.name')`, redirect chains, and validation rules. If you've been reading those examples and thinking "this looks like code", you're not wrong. It has function calls, method chains, boolean logic. But it doesn't execute line by line the way a handler would.

So what's actually happening when you write a definition? Let's look under the surface.

## Definitions are data

When you call `Answer('hasPartner')`, it feels like you're reaching into the request and pulling out a value. But at this point, there's no request. Nobody has visited the page yet. Your application is just starting up.

What `Answer('hasPartner')` actually returns is a small plain object:

```json
{
  "type": "ExpressionType.Reference",
  "path": ["answers", "hasPartner"]
}
```

That object says "there will be an answer called 'hasPartner', and when the time comes, look it up here." It's an address, not a value. Every reference you've used across the last two pages works the same way:

- `Answer('hasPartner')` - "look up the answer stored under 'hasPartner'"
- `Data('team.name')` - "look up 'team.name' in loaded data"
- `Params('teamId')` - "look up 'teamId' in the route parameters"
- `Self()` - "look up the value of the field this expression belongs to"

Conditions are addresses too, just to a different thing. `Condition.Equals('yes')` doesn't compare anything yet. It produces another plain object:

```json
{
  "type": "FunctionType.Condition",
  "name": "Equals",
  "arguments": ["yes"]
}
```

That says "when you need to check this, call the function named 'Equals' and pass it 'yes'."

Now look at the full expression from the partner question: `Answer('hasPartner').match(Condition.Equals('yes'))`. The fluent API (`.match()`, `.pipe()`, `.not`) makes this comfortable to write, but what it's really doing is composing those two objects into a third:

```json
{
  "type": "PredicateType.Test",
  "subject": { "type": "ExpressionType.Reference", "path": ["answers", "hasPartner"] },
  "negate": false,
  "condition": { "type": "FunctionType.Condition", "name": "Equals", "arguments": ["yes"] }
}
```

The TypeScript runs once at startup, produces these objects, and is done. What remains is a tree of plain, JSON-serializable descriptions. The addresses stay the same from one request to the next. What changes is the values sitting at those addresses, which is why the same definition can behave differently for different people.

## What data makes possible

The earlier pages argued that the service model should be visible and inspectable. Definitions being data is how Forge makes that possible.

- Forge can **validate** it. The whole definition goes through schema validation at startup. Malformed references, missing fields, invalid conditions - caught before any request arrives.
- Forge can **compile** it. It reads the definition once, walks the entire tree, and produces optimised functions. A reference like `Data('team.name')` becomes direct property access in the generated code.
- Forge can **reason about** it. Reachability enforcement, route indexing, clearing stale answers - all possible because the definition is a structure Forge can inspect, not a set of callbacks it can only call.

None of this would work with opaque function bodies. You can inspect a data object the moment it exists. A function's behaviour is invisible until you run it.

## Evaluation resolves the data

When a request arrives, Forge evaluates the compiled definition against a *request context*. The context is assembled from everything available for this request - route parameters, query values, submitted form data, session, headers - plus any data your access hooks have loaded.

Now the references come alive. `Answer('hasPartner')` resolves to `'yes'` for one person and `'no'` for another. `Condition.Equals('yes')` runs and returns `true` or `false`. Blocks become visible or hidden. Redirects fire or don't - you get the idea.

That's the whole mechanism: a static description, evaluated against a changing context, producing a different result each time.

## Composing definitions with TypeScript

Since definitions are just data, you can use ordinary TypeScript to compose them. Helper functions, shared modules, loops, conditionals - anything that produces the right shape of output works fine.

Here's a helper that builds a reusable field pattern from the partner details example:

```typescript [[1, 1, "requiredField"], [1, 20, "requiredField"], [1, 21, "requiredField"]]
function requiredField(code: string, label: string) {
  return GovUKTextInput({
    code,
    label: { text: label, isPageHeading: true },
    validWhen: [
      validation({
        condition: Self().match(Condition.IsRequired()),
        message: `Enter ${label.toLowerCase()}`,
      }),
    ],
  })
}

// Used in a step:
const partnerDetailsStep = step({
  code: 'partner-details',
  path: '/partner-details',
  title: "Partner's details",
  blocks: [
    requiredField('partnerFirstName', "Partner's first name"),
    requiredField('partnerLastName', "Partner's last name"),
    GovUKButton({ text: 'Continue' }),
  ],
  // ...
})
```

The <s1>`requiredField`</s1> helper wraps a common pattern: a text input with a required validation rule. Each call produces a plain definition object. By the time Forge sees the step, the helper is gone; only its output remains.

This goes further than just tidying up repetition. Because definitions are plain data with no runtime logic baked in, they're easy to share. A team can publish a journey definition as a package, and other teams can import it into their own applications with their own effects, their own functions, and their own data sources. The shared definition describes the structure and the rules. Each consuming application supplies the implementation. Teams can reuse whole sections of flows this way, not just individual components.

## Your functions live in the other world

So the definition describes what should happen. But somebody still has to load records, check permissions, call APIs, and persist data. That's where your application's functions come in - the effects, conditions, and transformers you register with Forge.

These run at evaluation time, not definition time. Forge resolves references and expressions first, then hands your function the concrete results.

Here's what that boundary looks like:

```typescript [[1, 2, "Answer('score')"], [1, 5, "value"]]
// Definition side - a reference and an expression
Answer('score').match(MyConditions.IsEligible(18))

// Function side - receives concrete values
conditions.register('IsEligible', () => (value, minAge) => {
  // value is a real number, already resolved from the answer
  return value >= minAge
})
```

The <s1>reference in the definition</s1> tells Forge which answer to resolve. The <s1>function argument</s1> is where that resolved value arrives - a plain number the function can work with directly.

This split runs through all of Forge's extension points. Effects receive resolved values and return outcomes. Transformers receive a value and return a transformed one. Conditions receive a value and return a boolean. In every case, the definition names what to resolve and which function to call. The function works with what arrives.

## A common mistake

There's a specific error that comes from crossing this boundary, and it's worth spending time on because TypeScript won't catch it.

Here's what it looks like inside a generator:

```typescript [[2, 3, "Answer('firstName')"]]
// Wrong - Answer() inside a generator
generators.register('BuildGreeting', () => () => {
  const name = Answer('firstName')   // a data object, not a string
  return `Hello, ${name}`            // "Hello, [object Object]"
})
```

The problem is that the <s2>authoring reference inside the function body</s2> does the same thing it would do anywhere - it creates a small data object. Inside a definition, that object becomes part of the tree Forge compiles and evaluates. Inside a function, it's just sitting there. Forge doesn't inspect what your function does internally. It calls the function, and the function runs as plain TypeScript.

So `name` is an object, not a string. Template literals call `.toString()` on it, and you get `"Hello, [object Object]"`. The code compiles. The generator runs. The output is silently wrong. You might not notice for a while.

The fix is to pass the reference through the definition as an argument:

```typescript [[3, 2, "Answer('firstName')"]]
// The reference is in the definition, where Forge can compile it
MyGenerators.BuildGreeting(Answer('firstName'))
```

This way Forge can see it and resolve it before your function runs. The <s3>reference is in the definition</s3>, and the generator receives the resolved value as an argument.

The same applies to effects, transformers, conditions, or any other registered function.

The general rule: references belong in definitions. Concrete values arrive in functions. If you find yourself calling `Answer()`, `Data()`, or any other Forge authoring reference inside a function body, the reference needs to move into the definition that invokes the function.

## What's next

That completes the thinking: the ideas Forge is built on, how a definition is structured as data, and how Forge evaluates it when a request arrives. Time to put it into practice. Head over to [Installing Forge](installing-forge) to get set up.
