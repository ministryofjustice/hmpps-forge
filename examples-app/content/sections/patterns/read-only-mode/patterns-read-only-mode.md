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
  `session("demoUser.role")`.
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
├── /overview        → Pattern description and "Start" button
├── /login           → Pick a role: Admin or Viewer (seeds contact data)
├── /contacts        → List of contacts with "View" links
└── /record/:index   → Contact record (conditional view based on role)
```

The login page seeds a small collection of contacts and sets the
user's role. The contacts page lists them, and the record page
renders different blocks depending on that role.

---

## How it works

### Defining role conditions

Define the role check once and reference it across blocks:

```rust
let is_admin = session("demoUser.role").matches(condition::equals("admin"));
let is_viewer = session("demoUser.role").matches(condition::equals("viewer"));
```

### Read-only view for viewers

A summary list that displays the data without any edit controls:

```rust
govuk::SUMMARY_LIST.build(obj! {
    "rows": [
        obj! {
            "key": obj! { "text": "Name" },
            "value": obj! { "text": answer("recordName") },
        },
        obj! {
            "key": obj! { "text": "Email" },
            "value": obj! { "text": answer("recordEmail") },
        },
    ],
    "visibleWhen": is_viewer,
})
```

### Editable view for admins

Form fields with the same answer codes, shown only to admins:

```rust
govuk::TEXT_INPUT.build(obj! {
    "code": "recordName",
    "label": obj! { "text": "Name" },
    "visibleWhen": is_admin,
    "validWhen": [
        validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter a name",
        }),
    ],
})
```

Because the fields use the same `code` as the data loaded by the
step's access hook (`LoadItemForEdit` copies the selected contact
into the field answers), they are pre-filled with the current values
automatically.

### One step, two views

The step's `blocks` array contains both sets of blocks. Forge
evaluates each block's `visibleWhen` at render time and only emits
the ones that pass:

```rust
"blocks": [
    heading, // always visible
    role_message, // always visible
    viewer_notice, // visibleWhen: isViewer
    summary_list, // visibleWhen: isViewer
    edit_heading, // visibleWhen: isAdmin
    name_field, // visibleWhen: isAdmin
    email_field, // visibleWhen: isAdmin
    department_field, // visibleWhen: isAdmin
    save_button, // visibleWhen: isAdmin
    back_button, // always visible
],
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
  button, using `condition::array::is_in(["admin", "editor"])` on
  different block groups.
