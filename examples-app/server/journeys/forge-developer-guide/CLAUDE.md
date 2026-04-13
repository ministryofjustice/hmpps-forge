# Forge Developer Guide

Interactive developer guide built with Forge itself. Content lives in markdown
files under `content/` which are both the source for the rendered guide and
directly readable by LLMs.

## Content File Structure

All `.md` files in `content/` follow this structure:

### Frontmatter

```yaml
---
title: Short name (used in nav, search results, page title)
section: Group this belongs to (e.g. core-concepts, authoring, runtime)
order: Number (sort order within section)
teaches: [list, of, concepts, this, page, introduces]
prerequisites: [concept-slugs-the-reader-should-know-first]
---
```

- **`teaches`** - Concepts, APIs, or patterns the reader will understand after
  reading this page. Used for search indexing and LLM navigation. Use the actual
  symbol names where possible (`block`, `visibleWhen`, `BlockDefinition`).
- **`prerequisites`** - Slugs from other pages' `teaches` arrays. Not hard
  gates - they signal "you'll get more out of this if you've read X first".

### Content Sections

#### 1. Title + Lead

```markdown
# {Title}

One to two sentences that say what this concept is and why it matters.
No preamble, no "In this section you will learn...".
```

#### 2. The Concept

The core explanation. What is this thing? What problem does it solve?
How does it fit into Forge's model?

This teaches the *idea*, not the API. Use plain-language explanations, ASCII
diagrams where they help, and short code snippets to make abstract ideas concrete.

Don't catalogue every property or option here - that belongs in the API surface
section.

#### 3. How It Works

The mechanics. What happens at runtime, compile time, or validation time?
What does Forge actually do with this definition?

Explain the pipeline, evaluation model, or lifecycle - whatever makes the reader
understand what's happening under the hood without needing to read the source.

#### 4. API Surface

Properties, builder functions, signatures. Each property gets its own `###`
heading in the format `### propertyName (Required/Optional)`, followed by a
short description and a code snippet showing usage. Do not use tables for
property lists.

Only cover what belongs to *this concept*. If a property is better explained
on another page (e.g. `validWhen` belongs on the Validation page), list it
briefly with a cross-reference rather than duplicating the explanation.

#### 5. Best Practices

Short, opinionated guidance. Bullet points. Each one should be actionable
and specific to this concept - not generic advice.

## Content Guidelines

- **Teach the concept, not the catalogue.** A page about "Blocks" should
  explain what a block *is* and how the variant system works - not list
  every block type. Specific components belong on their own pages or in
  a Components section.
- **Code examples use the real API.** Import paths should be the actual
  `@ministryofjustice/hmpps-forge/...` paths. Code should be copy-pasteable.
- **Cross-reference, don't duplicate.** If a concept is explained in depth
  on another page, link to it. Don't rewrite it.
- **Fenced code blocks are the canonical examples.** These are what LLMs
  and the search index consume. When the interactive guide adds a live demo
  via `{{slot:...}}`, the fenced block above it should already show the same
  thing as static code.
- **Keep it flat.** Two levels of heading max (`##` and `###`). If you need
  a fourth level, the page is probably covering too much - split it.
- **Section breaks (`---`) between major sections.** These map to
  `govuk-section-break` in the rendered guide and give visual breathing room.


Use GOVUK styling for content
@govuk-style-guide.md
