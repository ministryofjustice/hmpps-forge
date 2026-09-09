---
title: The web in declarative form
slug: the-web-in-declarative-form
section: get-started
path: get-started/the-web-in-declarative-form
nav: Thinking with Forge
order: 1
description: Why every web service has a service model, and what changes when you describe it declaratively
teaches: [service-model, request-loop, shared-state, declarative-description]
prerequisites: []
related:
  concept: [what-is-forge, building-pages, building-flows]
---

# The web in declarative form

Every web service you've built is more than its files. Behind the routes, templates, handlers, and session code sits a structure: what the service contains, what its parts depend on, and what can happen next. That structure exists whether or not you've ever written it down - and this page is about what it costs you when you don't, and what becomes possible when you do.

## The web is built from a small set of parts

Think about what you actually work with when you build for the web: URLs, requests, responses, forms, events, state, and markup. That's a short list. Yet from it you can build a checkout, a publishing tool, a search interface, or a forty-page application form. The primitives stay familiar even when the service built from them isn't.

This compositional quality is one of the web's strengths. The same handful of parts, combined differently, produces very different services.

But as the parts combine, they start to depend on one another. A request changes some state. That state affects what a page displays. What the page displays determines which actions are available next. The parts stop being independent the moment you connect them - and connecting them is the whole job.

Those dependencies aren't random. They follow a pattern, and it's one you already know.

## Every interaction is a loop

Take a form submission - the most ordinary thing a web service does. The request carries a value. Your service validates it, maybe saves it, and returns a response that reflects the result. What the person sees next depends on both the value they sent and the state that already existed.

Strip away the specifics and there's a loop underneath:

1. Receive input.
2. Evaluate it against the current state.
3. Perform any required work.
4. Update the state.
5. Return the next response.

Every interaction in your service runs this loop. A search, a login, a "save and continue" - the same five steps each time.

One loop on its own isn't a service, though. A service emerges when many of these loops are connected. So what connects them? Shared state. Step 4 of one loop writes the state that step 2 of the next loop reads.

## Shared state connects the loops

Here's what that connection looks like in practice. Suppose your service asks a question partway through a journey: does this person have a partner? They answer "yes", continue for a few pages, then go back and change the answer to "no".

What should happen? Quite a lot, as it turns out. A section on the current page should disappear. Two later pages should no longer be visited. Answers collected on those pages no longer apply and should be cleared. The "next" destination changes. Some actions that were valid a moment ago aren't any more.

One state change has rippled through the service at several levels:

- a control collected the value;
- a section used it to decide what to display;
- a page used it to decide what should happen next;
- the service used it to decide which parts of the journey still applied.

These aren't four separate behaviours you'd design independently. They're four consequences of one dependency - the dependency between that answer and the state of the service. This is what makes a service feel like one connected experience rather than a pile of pages: each loop reads from the current state, produces an outcome, and may change the state the next loop runs in.

Notice what this does to the question you ask when you look at a page. "What does this page show?" is no longer enough. The useful question is: what does this part of the service depend on, what can it change, and what should happen afterwards?

## The connections are the service model

Those dependencies exist in your service right now, whether or not anything describes them. State still influences content. Validation still controls progress. Earlier answers can make later answers invalid. Some actions are available while others are blocked.

Together, those rules form the *service model*: the service's content, its state, the dependencies between them, the transitions from one response to the next, and the outcomes that are possible.

**Every web service has a service model, whether or not you describe it.** The only choice you get is where it lives.

So where does that model usually live? In most services, it is spread through the implementation. One rule sits in a template conditional. Another sits in a validation schema. Others live in route handlers, callbacks, session helpers, or guards. Each decision makes sense where it is made, but the relationships between them are difficult to see.

That has a cost. To work out what the service can do, you have to reconstruct the model from the paths the code might take: find where a piece of state originates, trace everywhere it is read, and work out which decisions can affect later behaviour. Every time you open an unfamiliar journey and start following a value through the codebase, that reconstruction is happening. It is the price of leaving the service model implicit.

## An implicit service model is hard to change safely

An implicit service model can be perfectly manageable while a service remains stable. Its weaknesses tend to appear when the service changes.

Say you add one new condition - a question whose answer affects what comes later. That single condition may touch content, validation, navigation, and saved state. In the codebase, those look like four separate changes in four separate files. In the service model, they're consequences of one dependency.

When the dependency isn't visible anywhere, you discover its full effect by tracing the implementation - and hoping you traced everything. Go back to the partner question: suppose you handled the hidden section and the skipped pages, but missed clearing the stale answers. Nothing fails loudly. The service carries on, with one part behaving as though the person has a partner and another behaving as though they don't. The bug isn't in any one file; it's in a connection no file describes.

The problem isn't poor code. Each piece can be well written, well tested, and reasonable on its own. The problem is that the service model can only be inferred from what the code does.

## A declarative description makes the model visible

So what would it take to make the service model something you can read, rather than something you reconstruct?

A declarative description starts from the model instead of from the sequence of instructions that implements it. It states the service's content, the state that content depends on, the changes an interaction can produce, and the transitions between responses. The dependency between the partner answer and everything downstream of it becomes a stated fact, not a pattern smeared across four files.

A runtime still does the work of serving requests - describing a service declaratively doesn't make it static, and it doesn't remove its complexity. The rules are as intricate as they ever were. What changes is that the structure is visible. Dependencies can be reviewed, tested, and reasoned about directly, instead of discovered as side effects of the implementation.

## The same description can drive the runtime

At this point you might object: isn't a description like this documentation with extra steps? Documentation drifts. The moment the code changes and the description doesn't, it's worse than nothing.

That objection lands if the description is only for people. But if the description expresses the service model in a form a runtime can evaluate, it serves two purposes at once. It explains the service to the people who build it, and it determines how the service behaves when a request is handled. The description can't drift from the behaviour, because the description is what produces the behaviour.

This is the idea Forge is built on. Forge provides a language for describing the service model, and an engine that evaluates that description to handle each request. The next page introduces it properly.

## What's next

Head over to **What is Forge?** to see this idea made concrete: the language Forge gives you for describing a service model, and the engine that evaluates it on every request.
