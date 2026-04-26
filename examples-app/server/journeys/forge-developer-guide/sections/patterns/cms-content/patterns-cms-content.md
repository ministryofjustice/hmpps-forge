---
title: CMS content
section: patterns
path: patterns/cms-content
teaches: [cms-content, rich-text-editor, custom-component, html-rendering]
prerequisites: [step, access, effects, data, custom-components]
---

<p class="govuk-caption-xl">Patterns</p>

# CMS content

A blog-style content management pattern where users write posts with
a rich text editor and view them on a separate page. Content is stored
in the session and rendered as HTML.

<p class="govuk-body"><a class="govuk-button" href="/forge-developer-guide/patterns/demos/cms-content/overview" data-module="govuk-button">Try the live demo</a></p>

{{slot:toc}}

---

## When to use it

Use this pattern when a journey needs to capture and display
user-authored rich text content. It fits well when:

- Users need to write formatted content (bold, italic, lists).
- The content is displayed back to users or other readers.
- A third-party editor component needs integrating into a Forge step.

---

## What the pattern covers

The live demo is a minimal blog. Following the flow shows:

- **A custom component** that wraps the GOV.UK textarea with the
  MOJ Rich Text Editor `data-module` attributes, turning a plain
  textarea into a WYSIWYG editor.
- **Session-based storage** using effects to save and load posts.
- **Dynamic HTML rendering** using `CollectionBlock` and `HtmlBlock`
  to display user-authored content.

---

## How it works

### The rich text editor component

The custom `RichTextEditor` component uses `buildNunjucksComponent`
to render the standard `govukTextarea` Nunjucks template with
additional `data-module` and `data-toolbar.*` attributes on the
form group wrapper. The MOJ frontend JavaScript, already initialised
via `mojFrontend.initAll()`, picks up the `data-module` and
enhances the textarea into a toolbar-equipped editor.

```typescript
import { RichTextEditor } from '../components/richTextEditor'

const bodyEditor = RichTextEditor({
  code: 'postBody',
  label: { text: 'Content', classes: 'govuk-label--m' },
  hint: 'Use the toolbar to format your post.',
  toolbar: {
    bold: true,
    italic: true,
    underline: true,
    bullets: true,
    numbers: true,
  },
})
```

The editor writes HTML back to the underlying textarea on form
submission, so Forge's normal `Answer()` flow receives the
content as an HTML string.

### Saving and loading posts

An effect reads the `postTitle` and `postBody` answers on
submission, creates a post object with a timestamp, and
prepends it to an array stored in the Express session.

A separate effect loads posts from the session into `Data('posts')`
on access, making them available to blocks on the posts page.

### Rendering content

Each post is rendered as an `<article>` element using
`CollectionBlock` with `Iterator.Map`. The post body is
rendered via `HtmlBlock`, which outputs the stored HTML
directly.

```typescript
const postsList = CollectionBlock({
  collection: Data('posts').each(
    Iterator.Map(
      HtmlBlock({
        tag: 'article',
        content: [
          GovUKHeading({ text: Item().path('title'), size: 'm' }),
          GovUKBody({ text: Item().path('date'), size: 's' }),
          HtmlBlock({ content: Item().path('body') }),
        ],
      }),
    ),
  ),
})
```

---

## Best practices

- Register custom components in the package's `components` array
  so they are available to all journeys in the package.
- The MOJ Rich Text Editor outputs HTML, not markdown. Store and
  render accordingly.
- In production, sanitise user-authored HTML before rendering to
  prevent XSS. The demo skips this since content stays in the
  same user's session.
