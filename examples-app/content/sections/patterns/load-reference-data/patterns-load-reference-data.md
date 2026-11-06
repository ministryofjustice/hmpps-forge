---
title: Load reference data on access
section: patterns
path: patterns/load-reference-data
teaches: [load-reference-data, access-hook-effects, setData]
prerequisites: [step, access, effects, data]
---

<p class="govuk-caption-xl">Patterns</p>

# Load reference data on access
A step that loads data from an external source before the page
renders, then displays the results through `data()` references
in its blocks.

<p class="govuk-body"><a class="govuk-button" href="/forge-developer-guide/patterns/demos/load-reference-data" data-module="govuk-button">Try the live demo</a></p>

{{slot:toc}}

---

## When to use it

Reach for this pattern when a step needs data that does not come
from user input. Reference lists, API responses, computed values,
and anything else that the page needs to render but does not
collect through a form.

It fits well when:

- A page displays data loaded from an API or data store.
- The data should be fresh on every page load.
- Multiple blocks on the page consume the same loaded data.

It does not fit when the data is static and known at build time.
In that case, use the step's `data` property instead of an
effect, since it avoids the overhead of a runtime call.

---

## What the pattern covers

The live demo generates a set of lottery numbers on every page
load. Following the flow shows:

- **An access hook effect** that runs before the page renders,
  simulating a call to an external API.
- **Data set by the effect** made available to blocks through
  `data()` expressions.
- **Fresh results on each load.** Refreshing the page or
  pressing "Draw again" produces new numbers, demonstrating that
  the effect runs on every GET request.
- **A custom component** (`LotteryBall`) that renders each number
  as a styled ball, demonstrating how loaded data flows into custom
  components through `data()` expressions.

---

## Anatomy of the flow

```
/forge-developer-guide/patterns/demos/load-reference-data/
├── /overview    → Overview and "See the demo" button
└── /draw        → Lottery numbers loaded on access
```

The journey registers a single access hook that generates lottery
numbers and sets them as data. The draw step displays those values
through `data()` references in its blocks. Pressing "Draw again"
triggers a new GET request, which re-runs the access hook and
produces fresh numbers.

---

## How it works

### The access hook

The journey registers an effect in its `onAccess` array. Because
it is on the journey (not the step), it runs for every step in
the journey on every request:

```rust
let load_reference_data_demo_journey = journey(obj! {
    "code": "load-reference-data-demo",
    "title": "Load reference data on access",
    "path": "/load-reference-data",
    "onAccess": [
        access(obj! {
            "effects": [effect::call("DrawLotteryNumbers", vec![])],
        }),
    ],
    "steps": [overview_step, draw_step],
});
```

### The effect implementation

The effect calls an injected API client and uses
`context.set_data()` to make the response available through
`data()` expressions for the rest of the request:

```rust
FunctionEntry::effect("DrawLotteryNumbers", move |context, _args| {
    let mocks_api = mocks_api.clone();
    async move {
        let draw = mocks_api.get_lottery_balls().await?;

        for (i, n) in draw.balls.iter().enumerate() {
            context.set_data(&format!("ball{}", i + 1), Value::from(n.to_string()))?;
        }
        context.set_data("bonusBall", Value::from(draw.bonus_ball.to_string()))?;
        context.set_data("drawDate", Value::from(draw.draw_date))
    }
})
```

The demo uses a `MocksApi` service that generates random numbers,
but the pattern is the same for any external data source. The API
client is passed in when the package is built, and the effect's
closure captures it:

```rust
let package = developer_guide_package(Arc::new(Services {
    mocks_api: services.mocks_api.clone(),
    // ...other services
}));
forge.register_package(package)?;
```

Effects capture these services in their closures, so they never
construct services themselves. This keeps them testable and
decoupled from how the service is constructed.

### Displaying loaded data

The demo uses a custom `LOTTERY_BALL` component to render each
number. Each ball receives its value through a `data()` expression,
and a `core_blocks::TEMPLATE_WRAPPER` places them in a flex row:

```rust
let numbers_row = core_blocks::TEMPLATE_WRAPPER.build(obj! {
    "template": "<div class=\"lottery-ball-row\">{{slot:balls}}</div>",
    "slots": obj! {
        "balls": [
            LOTTERY_BALL.build(obj! { "number": data("ball1") }),
            LOTTERY_BALL.build(obj! { "number": data("ball2") }),
            LOTTERY_BALL.build(obj! { "number": data("ball3") }),
            LOTTERY_BALL.build(obj! { "number": data("ball4") }),
            LOTTERY_BALL.build(obj! { "number": data("ball5") }),
            LOTTERY_BALL.build(obj! { "number": data("ball6") }),
        ],
    },
});
let bonus_ball = LOTTERY_BALL.build(obj! {
    "number": data("bonusBall"),
    "color": "green",
});
```

The blocks do not know where the data came from. They declare
what they need through `data()` and Forge resolves the values
before the component renders.

### Refreshing the data

The "Draw again" button is a link back to the same page. Because
the access hook runs on every GET request, a page refresh
produces new values with no extra wiring:

```rust
let draw_again_button = govuk::LINK_BUTTON.build(obj! {
    "text": "Draw again",
    "href": "/forge-developer-guide/patterns/demos/load-reference-data/draw",
    "classes": "govuk-button--secondary",
});
```

---

## Variations

- **Journey-level vs step-level hooks.** The demo loads data at
  the journey level so it runs for every step. Move the hook to
  an individual step's `onAccess` when only that step needs the
  data.
- **Conditional loading.** Add a `when` condition to the access
  hook to skip the effect when the data is not needed, for
  example when a query parameter is missing.
- **Error handling.** When loading from a real API, check the
  result and use `throw_error()` in the hook's `next` array to
  return a 404 or 500 if the data is unavailable.
- **Caching.** For data that does not change between requests,
  store the result in the session and check for it before calling
  the API again.
