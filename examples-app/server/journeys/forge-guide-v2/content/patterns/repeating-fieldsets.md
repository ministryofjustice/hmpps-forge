---
title: Repeating fieldsets
slug: repeating-fieldsets
section: patterns
path: patterns/repeating-fieldsets
nav: Collections
order: 9
description: Add and remove groups of fields on one page, then validate and save the collection.
---

# Repeating fieldsets

Let someone enter several items on the same page by adding or removing groups of
fields. This example collects household members and keeps partially entered
values while the list changes.

## Try the pattern

1. Enter part of a member's details, then add another person before completing the first.
2. Fill in the second person and remove the first to check that the remaining values survive.
3. Continue with a required field empty, then correct it and review the household.

Edit the files below and select **Run** to try your changes. Running the edited
files starts a fresh preview.

:::playground
---
title: Repeating fieldsets
base: /assets/playground/repeating-fieldsets/
entry: journey.ts
start: /repeating-fieldsets/overview
---
journey.ts
effects.ts
AnswerStore.ts
overview.ts
household-members.ts
check-answers.ts
confirmation.ts
:::

:::note
---
---
The preview keeps this state in memory; restarting it or reloading the guide
page clears the household and saved record.
:::

## How it works

`household-members.ts` maps `Data('members')` into repeated fieldsets. Each input
has a code built from its field name and `Loop.Index0`, so every member's name and
age has a distinct answer code.

The add and remove actions skip form validation. Their effects first read the
current inputs, including unfinished values, then update the member list.
Removing a member also rebuilds the indexed answers so the remaining inputs stay
aligned with their members. Without that step, changing the list could attach an
old field value to the wrong person.

Continuing runs validation and saves the household for review. The final
confirmation stores a separate record through `AnswerStore.ts` and clears the
draft.

## Adapting the pattern

Repeating fieldsets work well when each item needs only a small amount of
information and seeing the items together helps. As each item grows, separate
forms can be easier to manage; see
[Adding, editing and deleting from collections](/forge-guide-v2/patterns/add-another).
