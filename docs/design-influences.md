# Design influences

## Purpose

Forge did not appear from a blank page.

Its design is shaped by other journey frameworks, CMSs, validation libraries,
template engines, compiler-style tools, and game engines.

This document records those influences so future design work can understand the
intent behind Forge's shape.

Forge borrows ideas where they are useful, then applies them to server-side
journey evaluation.

## Main thread

The main thread across these influences is that authored content should drive a
flexible engine.

Forge treats a journey as structured, inspectable content. The engine validates
that content, turns it into an internal representation, compiles the repeated
work, and evaluates each request from the compiled plans and request context.

That model makes it possible for service-specific journeys to be described
through definitions, while shared engine behaviour handles the repeated work.

## Authoring influences

### HMPO Form Wizard and GOV.UK CASA

HMPO Form Wizard and GOV.UK CASA influenced the authoring side of Forge.

They showed that government services can be described through journey
semantics: steps, pages, fields, conditions, hooks, validation, and navigation.

They also influenced naming and interface design. Forge uses different internal
machinery, but the authoring model follows the same broad idea: a service
journey can be described through structured definitions rather than hand-written
controllers for every route.

### Payload CMS and CMS experience

Payload CMS, and previous CMS experience with systems such as Umbraco,
influenced the way Forge treats authored data.

CMS work makes the idea of content as structured input feel natural. Content is
stored or authored as data, then hydrated into templates, views, or runtime
structures.

Forge applies a related idea to journeys. A journey definition is structured
input to an engine. The engine does not treat the definition as inert config. It
hydrates it into runtime plans, generated functions, render contexts, and
navigation state.

The useful influence is the separation between authored content and the system
that evaluates or renders it.

### Game engines

Game engines influenced the idea of Forge as a flexible runtime driven by
authored content.

In a game engine, content is often data that a general engine can load,
interpret, compile, or execute. The engine provides reusable systems, while
authored content supplies the specific behaviour and state for a given game.

Forge follows a similar principle for journeys. It should provide the engine
for validation, navigation, hooks, answer preparation, and rendering
orchestration, while journey definitions provide the content and rules that
drive each request.

Systems such as BlamScript and Unreal Blueprints are useful reference points
for this idea. They show how authored logic can be represented outside normal
application code, while still being evaluated by a powerful runtime.

The relevant influence is the content-driven engine model.

## Validation influences

Forge was also shaped by repeated validation problems in HMPPS services.

Many services have reimplemented the same kinds of validation rules in
different ways. Some use `class-validator` and `class-transformer`. Some use
application-specific condition functions. Some write fresh validation logic for
each form or route.

Those approaches can work well in local contexts. The challenge is that they
often make validation hard to inspect, share, compile, or connect to navigation
and rendering across a whole journey.

Forge treats validation as part of the journey definition and evaluation model.
Validation conditions are named, registered functions. The DSL can be validated
before routes are mounted. Runtime validation can then be compiled and evaluated
as part of the same request pipeline as answers, reachability, hooks, and
rendering.

The goal is not only to reduce repetition. It is to make validation visible to
the engine.

## Compilation influences

### Nunjucks

Nunjucks was an early influence on Forge's internal implementation.

Nunjucks takes template input and compiles it into executable render functions.
That model is useful because template structure can be analysed ahead of time,
then evaluated quickly at runtime.

Forge applies the same broad idea to journey evaluation. It takes declarative
journey input, builds an internal representation, and compiles repeated work
into generated functions.

### AJV

AJV influenced the code-generation side of Forge.

AJV compiles schemas into JavaScript validation functions. That shows a clear
benefit of code emission: repeated validation can run quickly because the
runtime executes generated code rather than interpreting the schema structure
each time.

Forge uses a similar principle for its phase compilers. Validation, rendering,
answer preparation, hooks, and navigation-related evaluation can be compiled
into functions that are attached to runtime plans.

### Vue and Svelte

Vue and Svelte were broader influences on Forge's compile-ahead model.

They show how much work a framework can move out of the hot path when it can
analyse structure before runtime. Forge does not work like a frontend compiler,
but it shares the same preference for doing structural work once and using the
result repeatedly.

The relevant idea is not the rendering model. It is the split between authored
structure, compilation, and efficient runtime evaluation.

## How the influences fit together

These influences sit at different levels.

Form Wizard and CASA helped shape the authoring language. CMS experience helped
shape the idea of authored content being hydrated into runtime structures. Game
engines helped shape the idea of a reusable engine driven by authored content.
Nunjucks and AJV helped shape the compilation model. Vue and Svelte helped
reinforce the value of moving structural work out of the request path.

Forge combines those ideas for one purpose: server-side journey evaluation for
government services.

## Further reading

These influences are useful background when trying to understand why Forge is
structured the way it is.

They are not requirements for future changes. They are reference points for the
ideas behind the authoring model, validation model, extension model, and
compiled runtime.
