---
title: Forge guide (v2)
slug: home
section: overview
path: home
nav: Overview
order: 0
description: A parallel developer guide whose pages are generated from markdown at startup
teaches: [content-collections, generated-steps]
prerequisites: []
---

# Forge guide (v2)

This is a prototype of the developer guide whose pages are **generated
from markdown files at startup**. Each markdown file's frontmatter
becomes a real Forge `step()` before the package is registered, so the
route tree, navigation, and titles all work exactly as if the steps had
been hand-authored.

{{slot:toc}}

---

## How it is organised

The guide follows the Diátaxis model, with four sections:

- **Learn** - tutorials that walk you through building a journey.
- **How-to guides** - focused answers to specific problems.
- **Concepts** - the ideas behind how Forge works.
- **Reference** - precise descriptions of the authoring surface.

This home page is hand-authored in code, while every section page is
generated from a markdown file - proof that generated and hand-authored
steps coexist in one journey.
