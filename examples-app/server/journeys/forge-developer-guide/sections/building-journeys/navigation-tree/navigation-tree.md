---
title: The route tree
section: building-journeys
path: building-journeys/navigation-tree
teaches: [RouteTree, RouteTreeNode, routeTree, active-state, ancestors, parameterised-paths]
prerequisites: [journey, JourneyDefinition, children]
---

<p class="govuk-caption-xl">Routing, reachability and navigation</p>

# The route tree

Forge automatically builds a URL-folder route tree from your registered
journeys and steps. Templates use this tree to render sidebars, breadcrumbs,
and menus without manually wiring every link.

{{slot:toc}}

---

## What is the route tree?

The route tree is a structural view of the URLs Forge has mounted. It is
based on URL folders, not on authored journey nesting.

Every node has:

- `segment` - the URL segment for this folder.
- `path` - the resolved URL for the current request.
- `templatePath` - the original route template, including params.
- `active` - `true` for the current step or an ancestor of it.
- `metadata` - custom metadata from the concrete journey or step, when the
  node represents one.
- `route` - concrete journey or step data when this URL is routable.
- `children` - nested URL folders.

Folder-only nodes are valid. A node can also represent a real route and still
have child folders.

---

## URL folders, not authored nesting

Forge still uses compiled navigation plans for reachability and redirects.
The route tree only describes the URL structure.

```typescript
journey({ path: '/travel', ... })
step({ path: '/travellers/name', title: 'Traveller name' })
step({ path: '/travellers/date-of-birth', title: 'Date of birth' })
```

Those steps produce a shared folder node:

```
/travel
└── /travellers
    ├── /name
    └── /date-of-birth
```

The `/travellers` node may not have a `route`. It exists because the URL
structure needs a folder for the child routes.

---

## Parameterised paths

If a journey or step uses route parameters, such as
`/prisoners/:prisonerId`, the tree keeps that route template in
`templatePath`. At render time, Forge resolves `path` using the current
request params.

```
{
  templatePath: '/prisoners/:prisonerId/contacts',
  path: '/prisoners/A1234BC/contacts'
}
```

---

## Using `routeTree` in templates

Forge makes `routeTree` available to every template.

```nunjucks
{% for node in routeTree %}
  {% if node.active and node.route %}
    <h3>{{ node.route.title }}</h3>
    <ul>
      {% for child in node.children %}
        {% if child.route and not child.metadata.hiddenFromNav %}
          <li>
            <a href="{{ child.path }}"
               {% if child.active %}aria-current="page"{% endif %}>
              {{ child.route.title }}
            </a>
          </li>
        {% endif %}
      {% endfor %}
    </ul>
  {% endif %}
{% endfor %}
```

Use `route.kind` to distinguish concrete journeys from concrete steps:

```
{ route: { kind: 'journey', title: 'Travel declaration', ... } }
{ route: { kind: 'step', title: 'Check answers', ... } }
```

---

## Ancestors

`ancestors` is still available as an ordered list of journey ancestors from
root to immediate parent. It is useful for breadcrumbs because it reflects the
current step's authored journey ancestry.

```nunjucks
{% for ancestor in ancestors %}
  <a href="{{ ancestor.path }}">{{ ancestor.title }}</a>
  {% if not loop.last %} / {% endif %}
{% endfor %}
```

Each ancestor includes `code`, `path`, `title`, `view`, and `metadata`.

---

## Custom metadata

The `metadata` property on journeys and steps is passed through to the
concrete route node. Forge does not interpret it. Use it for presentation
concerns such as filtering, grouping, and ordering.

```typescript
step({
  path: '/blocks',
  title: 'Blocks',
  metadata: { navGroup: 'Core concepts' },
  ...
})
```

The metadata appears on the route tree node:

```
{
  path: '/guide/blocks',
  metadata: { navGroup: 'Core concepts' },
  route: { kind: 'step', title: 'Blocks' }
}
```

### Hiding items from menus

Every route appears in the tree. To hide a step or journey from menus and
sidebars, set a flag in `metadata` and filter it in your template. The route
is still routable.

```typescript
step({
  path: '/confirmation',
  title: 'Confirmation',
  metadata: { hiddenFromNav: true },
  ...
})
```

```nunjucks
{% for child in node.children %}
  {% if child.route and not child.metadata.hiddenFromNav %}
    <li><a href="{{ child.path }}">{{ child.route.title }}</a></li>
  {% endif %}
{% endfor %}
```

---

## Best practices

- **Treat it as route structure.** Reachability and resume behaviour still
  comes from compiled navigation plans.
- **Check for `route`.** Folder-only nodes are part of the shape, but they
  may not have a title or metadata.
- **Use `metadata` for presentation.** Group labels, icons, ordering hints,
  and visibility flags belong there.
- **Check `active` on folders too.** Active state bubbles up through child
  nodes, so folders and journeys can highlight the current section.
