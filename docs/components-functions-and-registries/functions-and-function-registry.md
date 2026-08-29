# Functions and function registry

## Purpose

Functions are how Forge gives journey definitions executable behaviour without
putting that behaviour inside the definition.

A journey definition names a function. The function registry provides the
implementation for that name.

This applies to conditions, transformers, generators, and effects. Each one has
a different role in the evaluation model, but they all use the same registry
boundary: a typed function expression in the definition resolves to a registered
evaluator at runtime.

## Where this sits in the pipeline

Function definitions are registered before a journey is validated and compiled.
Their factories are bound during request context preparation.

The function model is then used across the pipeline:

1. Authoring creates function expressions with a function type, name, and
   arguments.

2. Validation checks that each named function exists in the package definition catalog.

3. Validation also checks that effect functions only appear inside hooks.

4. Intermediate representation keeps function expressions as typed nodes.

5. Compilation uses definition metadata to emit function call sites.

6. Context preparation builds a request-owned registry from the package's
   function builders and dependencies.

7. Runtime evaluation calls the request-bound evaluator through the compiled
   evaluation context.

This means function lookup must stay stable from validation through to runtime.
The name that validates is the name the generated function later resolves.

## Definition shape and registry shape

The definition contains the reference to a function. It records:

- the function type
- the function name
- the function arguments

The request registry contains the implementation. A function registry entry records:

- the registered name
- the evaluator function
- input, argument, and output schemas where declared
- the function kind

These shapes are deliberately separate.

The definition stays declarative and inspectable. The request registry holds
executable code with the package dependencies captured by that request's evaluator.

## Function types

Forge recognises four function types.

### Conditions

Conditions answer yes-or-no questions.

They are used by validation rules, predicates, hooks, reachability, and other
places where Forge needs to decide whether something should happen.

### Transformers

Transformers change a value during expression evaluation.

They are commonly used in pipelines, formatting, mapping, and other places
where the output of one expression becomes the input to the next.

### Generators

Generators produce values.

They are used where a value is derived rather than read directly from answers,
data, request state, or another reference.

### Effects

Effects run from hooks.

They are the function type most likely to interact with application state or
external services. Forge controls where effects can appear and when they are
called, but the effect implementation owns the side effect itself.

Effects should remain scoped to hook execution. Allowing them in general
expression evaluation would make otherwise deterministic phases able to perform
side effects.

## Function registration

Function registration records named definitions for validation and compilation.

Package or application code provides function factories. During context
preparation Forge calls every factory with `packageDependencies` and stores the
resulting evaluators in a new registry owned by that request.

This gives registered functions a dependency boundary. A function can depend on
an application service, but the journey definition only sees the function name
and arguments.

Package registration should fail when:

- a function entry has no name
- a function definition has no factory
- a name is registered twice in the same registry

Context preparation fails when a factory throws or does not return an evaluator.

The registry does not decide where a function is allowed to appear. That is
handled by validation rules over the journey definition.

## Direct and thenable results

Function registry entries do not declare whether their evaluators are
asynchronous. Generated call sites invoke the evaluator directly and inspect
each returned value with `isThenable`. Direct values continue immediately;
thenables are awaited before output validation. The same evaluator may return
either form on different calls.

## Generated-function call sites

Forge does not inline registered function implementations into generated
source.

Generated code decides when a function should be called. The registry supplies
the evaluator that runs at that point.

The compiled evaluation context exposes the function registry to generated
functions. Generated call sites resolve the function by name, pass evaluated
arguments, and then call the registered evaluator.

When diagnostics are available, generated calls are wrapped so runtime errors
can keep useful context, such as the function name and source location in the
definition.

This keeps generated source focused on orchestration. Function implementations
remain outside the compiler.

## Effects and hook context

Effects are different from the other function types because they are expected
to do work, not just produce a value.

Hook evaluation gives effects the context they need to interact with the
request, response, and global runtime state (answers and data).

This is why effects are only valid inside access and submit hooks. Outside
hooks, expressions should remain value evaluation.

The rule to preserve is that effects belong at the edge of request handling.
They should not leak into validation, rendering, reachability, or answer
preparation as hidden side effects.

## What can fail

Important failure cases include:

- a function is registered without the required shape
- a function name is registered twice in the same registry
- a journey definition references an unregistered function
- an effect function is used outside a hook
- a factory throws or does not return an evaluator during context preparation
- the evaluator throws when runtime evaluation calls it

Registration and validation should catch problems that are knowable before
routes are mounted.

Context preparation catches factory failures; later runtime errors should be
reserved for failures inside the evaluator itself, or for failures that depend
on request-time state.

## Rules to preserve

Function names are the stable link between definitions, validation,
compilation, and runtime.

Function implementations should stay outside generated source.

The registry should remain the lookup boundary for executable function code.

Effects should stay constrained to hook execution.

Async metadata should remain accurate enough for generated functions to choose
the correct evaluation flow.

## Connection to other docs

The extension model doc explains how functions fit alongside components and
registries as Forge's extension surface.

The registry scoping doc explains how global and package-scoped function
registries affect which functions a journey can see.

The compilation docs explain how generated functions are built from the
intermediate representation.

The runtime evaluation context doc explains the data passed into compiled
functions during request evaluation.
