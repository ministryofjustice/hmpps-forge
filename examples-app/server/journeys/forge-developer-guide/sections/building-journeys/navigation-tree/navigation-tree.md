---
title: The navigation tree
section: building-journeys
path: building-journeys/navigation-tree
teaches: [NavigationTree, NavigationJourney, NavigationStep, navigation-metadata, active-state, ancestors, parameterised-paths]
prerequisites: [journey, JourneyDefinition, children]
---

<p class="govuk-caption-xl">Routing, reachability and navigation</p>

# The navigation tree

Forge automatically builds a navigation tree from your journey and step
definitions. Templates use this tree to render sidebars, breadcrumbs,
and menus without any manual wiring.

{{slot:toc}}

---

## What is the navigation tree?

When you define journeys and steps, Forge automatically builds a navigation
tree from them. You do not author the tree yourself. It's derived from the
structure you've already declared.

The tree mirrors your journey hierarchy. Every journey becomes a node with
children, every step becomes a leaf. Forge adds runtime state, like which
step is currently active and which journeys contain it, so your templates
can render sidebars, breadcrumbs, and menus without any manual wiring.

---

## How it's built

The navigation tree is built in two phases:

### Extraction (at mount time)

When Forge mounts a journey, it walks the definition and extracts metadata
from each journey and step: `title`, `path`, `description`, and `metadata`.
This produces a static snapshot of the structure, with no runtime state.

```
journey({ title: 'Travel declaration', path: '/travel', ... })
├── step({ title: 'Your trips', path: '/your-trips' })
├── step({ title: 'Add a trip', path: '/add-trip' })
└── step({ title: 'Check answers', path: '/check-answers' })

Extracts to:
{
  title: 'Travel declaration',
  description: 'Declare business travel for approval',
  path: '/travel',
  children: [
    { title: 'Your trips', path: '/travel/your-trips' },
    { title: 'Add a trip', path: '/travel/add-trip' },
    { title: 'Check answers', path: '/travel/check-answers' },
  ]
}
```

Paths are fully composed at this point. A step's path is joined with its
parent journey's path. Nested journeys compose the same way, all the
way up.

### Hydration (at render time)

On each request, Forge takes the stored metadata and hydrates it with runtime
state. Each node gets two additional properties:

- **`type`**: either `'journey'` or `'step'`, so templates can distinguish
  between them.
- **`active`**: for steps, `true` when the step's path matches the current
  request. For journeys, `true` when any descendant step is active.

```
// User is on /travel/add-trip:

{
  type: 'journey',
  title: 'Travel declaration',
  description: 'Declare business travel for approval',
  active: true,                    // ← a child is active
  children: [
    { type: 'step', title: 'Your trips',    active: false },
    { type: 'step', title: 'Add a trip',    active: true },  // ← current page
    { type: 'step', title: 'Check answers', active: false },
  ]
}
```

This means `active` bubbles up. If a step is active inside a nested child
journey, both the child journey and its parent journey will be marked active.
This is what lets a sidebar highlight the correct section even when the
navigation is deeply nested.

### Parameterised paths

If a journey or step uses route parameters, such as
`/prisoners/:prisonerId`, the navigation tree stores the route template
as-is during extraction. At render time, Forge resolves each parameter using
the current request's route params, so navigation links contain real URLs.

```
// Stored during extraction:
{ path: '/prisoners/:prisonerId/contacts' }

// Hydrated for a request to /prisoners/A1234BC/overview:
{ path: '/prisoners/A1234BC/contacts' }
```

---

## Using the tree in templates

Forge makes two things available to every template:

### `navigation`

The full navigation tree. This is an array of top-level
`NavigationJourney` objects with their children. Use it to build sidebars
and menus.

```nunjucks
{% for journey in navigation %}
  {% if journey.active %}
    <h3>{{ journey.title }}</h3>
    <ul>
      {% for child in journey.children %}
        <li>
          <a href="{{ child.path }}"
             {% if child.active %}aria-current="page"{% endif %}>
            {{ child.title }}
          </a>
        </li>
      {% endfor %}
    </ul>
  {% endif %}
{% endfor %}
```

### `ancestors`

An ordered array of journey ancestors from root to immediate parent. Use this
for breadcrumbs.

```nunjucks
{% for ancestor in ancestors %}
  <a href="{{ ancestor.path }}">{{ ancestor.title }}</a>
  {% if not loop.last %} / {% endif %}
{% endfor %}
```

Each ancestor includes `code`, `path`, `title`, `view`, and `metadata`.
This is everything from the journey definition except hooks, steps,
and children.

---

## Custom metadata

The `metadata` property on journeys and steps is passed through to the
navigation tree as-is. Forge does not interpret it. It's there for your
templates to use however they need. This is the single mechanism for
controlling how navigation is displayed, whether that's filtering,
grouping, ordering, or anything else your templates care about.

```typescript
step({
  path: '/blocks',
  title: 'Blocks',
  metadata: { navGroup: 'Core concepts' },
  ...
})
```

The metadata appears on the navigation node exactly as you defined it:

```
{ type: 'step', title: 'Blocks', metadata: { navGroup: 'Core concepts' }, ... }
```

### Hiding items from navigation

Every node appears in the navigation tree regardless. To hide a step or
journey from menus and sidebars, set a flag in `metadata` and filter it
in your template. The step is still routable. Users can navigate to it directly or reach
it through a flow.

```typescript
step({
  path: '/confirmation',
  title: 'Confirmation',
  metadata: { hiddenFromNav: true },
  ...
})
```

```nunjucks
{% for child in journey.children %}
  {% if not child.metadata.hiddenFromNav %}
    <li><a href="{{ child.path }}">{{ child.title }}</a></li>
  {% endif %}
{% endfor %}
```

### Grouping items under headings

A common pattern is tagging steps with a group name and rendering section
headings in the sidebar. This lets your navigation layout differ from the
journey hierarchy when it needs to.

```typescript
step({
  path: '/blocks',
  title: 'Blocks',
  metadata: { navGroup: 'Core concepts' },
  ...
})

step({
  path: '/fields',
  title: 'Fields',
  metadata: { navGroup: 'Core concepts' },
  ...
})

step({
  path: '/expressions',
  title: 'Expressions',
  metadata: { navGroup: 'Authoring' },
  ...
})
```

Your template can then group children by `metadata.navGroup` to render
section headings rather than a flat list.

---

## Best practices

- **Let the tree do the work.** Do not manually build navigation data in
  effects or templates. The tree already reflects your journey structure.
- **Hide steps sparingly.** If most of your steps are hidden from navigation,
  the tree is not providing much value. Consider whether the journey
  structure itself needs rethinking.
- **Use `metadata` for presentation concerns.** Group labels, icons and
  ordering hints. Anything that affects how navigation is displayed but
  not how the journey works.
- **Check `active` on journeys, not just steps.** A journey is active when
  any of its descendants are active. Use this to highlight the current
  section in multi-level navigation.
