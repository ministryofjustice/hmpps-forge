---
title: Read-only mode
section: patterns
path: patterns/read-only-mode
teaches: [read-only-mode, visibleWhen, conditional-rendering, role-based-ui]
prerequisites: [auth-role, session, visibleWhen]
---

<p class="govuk-caption-xl">Patterns</p>

# Read-only mode
A single page that renders different content depending on the user's
role. Admins see editable form fields and a save button. Viewers see
the same data as a read-only summary list.

<p class="govuk-body"><a class="govuk-button" href="/forge-developer-guide/patterns/demos/read-only-mode" data-module="govuk-button">Try the live demo</a></p>

{{slot:toc}}

---

## When to use it

Use this pattern when the same data needs to be accessible to users
with different permission levels. A case worker might edit a record
while a manager reviews it read-only.

It fits well when:

- The same page serves both read and write users.
- The data structure is the same for both roles - only the
  interaction differs.
- You want a single step definition rather than separate read and
  edit pages.

It does not fit as well when read and edit views are substantially
different (different fields, different layouts). In that case,
separate steps with their own access hooks are clearer.

---

## What the pattern covers

The live demo shows a contact record page. Following the flow shows:

- **Conditional blocks** using `visibleWhen` driven by
  `Session('demoUser.role')`.
- **Admins** see form fields pre-filled with the record data and a
  "Save changes" button. Edits persist across page loads.
- **Viewers** see the same data as a read-only summary list with an
  inset text explaining their access level.
- **Shared blocks** like the heading and role message that both roles
  see.

---

## Anatomy of the flow

```
/forge-developer-guide/patterns/demos/read-only-mode/
├── /overview     → Pattern description and "Start" button
├── /login        → Pick a role: Admin or Viewer (seeds record data)
└── /record       → Contact record (conditional view based on role)
```

The login page seeds default record data and sets the user's role.
The record page renders different blocks depending on that role.

---

## How it works

### Defining role conditions

Define the role check once and reference it across blocks:

```typescript
const isAdmin = Session('demoUser.role').match(Condition.Equals('admin'))
const isViewer = Session('demoUser.role').match(Condition.Equals('viewer'))
```

### Read-only view for viewers

A summary list that displays the data without any edit controls:

```typescript
GovUKSummaryList({
  rows: [
    { key: { text: 'Name' }, value: { text: Answer('recordName') } },
    { key: { text: 'Email' }, value: { text: Answer('recordEmail') } },
  ],
  visibleWhen: isViewer,
})
```

### Editable view for admins

Form fields with the same answer codes, shown only to admins:

```typescript
GovUKTextInput({
  code: 'recordName',
  label: { text: 'Name' },
  visibleWhen: isAdmin,
  validWhen: [
    validation({
      condition: Self().match(Condition.IsRequired()),
      message: 'Enter a name',
    }),
  ],
})
```

Because the fields use the same `code` as the data loaded by the
journey's access hook, they are pre-filled with the current values
automatically.

### One step, two views

The step's `blocks` array contains both sets of blocks. Forge
evaluates each block's `visibleWhen` at render time and only emits
the ones that pass:

```typescript
blocks: [
  heading,           // always visible
  roleMessage,       // always visible
  viewerNotice,      // visibleWhen: isViewer
  summaryList,       // visibleWhen: isViewer
  editHeading,       // visibleWhen: isAdmin
  nameField,         // visibleWhen: isAdmin
  emailField,        // visibleWhen: isAdmin
  departmentField,   // visibleWhen: isAdmin
  saveButton,        // visibleWhen: isAdmin
  logoutButton,      // always visible
]
```

---

## Variations

- **visibleWhen vs dependentWhen.** This demo uses `visibleWhen` on
  fields. The fields still participate in validation even when
  hidden, but since viewers have no submit button, validation never
  runs for them. If you need to suppress validation entirely for
  hidden fields, use `dependentWhen` instead - but note that
  `dependentWhen` also clears the stored answer when false.
- **Action links instead of a full form.** Instead of showing all
  fields at once, show the summary list to both roles but add
  change-link actions visible only to admins. This combines the
  read-only pattern with edit-and-return.
- **Multiple roles.** Extend the pattern with more than two views.
  A third role (e.g. "editor") could see the fields but not a delete
  button, using `Condition.Array.IsIn(['admin', 'editor'])` on
  different block groups.
