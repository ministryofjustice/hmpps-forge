# validation

Validation decides whether a step's answers pass the rules the author wrote. Forge runs two distinct validation
rounds, and this concern owns both:

- **Reachability validation** exists only to provide validity facts to the journey reachability calculation. It
  runs every validating step once under the reachability filter (default group, no `submissionOnly` rules) and
  stores results by step ID. It never affects validation display.
- **Current-page validation** validates only the page handling the request. It is one operation —
  `validation.current-step` — invoked from two legitimate control-flow locations: matching `validateOnEntry`
  conditions on GET, and the submit lifecycle after `onAlways` on POST. Its stored result,
  `currentPageValidation`, is the single display signal: present means it ran and should be shown (possibly
  passing with no failures), absent means it never ran.

Rule selection happens before execution: the compiled validation function receives a `ValidationRuleFilter`
(`groups` + `includeSubmissionOnly`) and filters each rule before its condition is evaluated, so rules outside
the active groups never run. Field and step-level rules share the same filtering semantics.

## Stage folders

- [analysis](analysis/README.md) selects the validating field blocks and map iterates for a step, and answers whether a step validates at all.
- [lowering](lowering/README.md) emits the step-validation generated function ([StepValidationCompiler.ts](lowering/StepValidationCompiler.ts)) and the `validateOnEntry` group selector ([EntryValidationCompiler.ts](lowering/EntryValidationCompiler.ts)).
- [runtime](runtime/README.md) runs the compiled tasks and owns both result stores: `reachabilityValidities` by `NodeId`, and the request's `currentPageValidation`.
- `contracts` holds `ValidationWork.type.ts` (including `ValidationRuleFilter`), `stepValidityResult.type.ts`, `validationResult.type.ts`, and `validationView.type.ts`.

## Runtime phases

This concern owns two request phases and one nested work stage:

- `request.validities`, the reachability validities pass that populates `reachabilityValidities` before
  reachability reads them.
- `request.entry-validation` (GET steps only), which runs the compiled `validateOnEntry` selector and, when
  groups match, schedules `validation.current-step`. The phase keeps its name because it represents the authored
  `validateOnEntry` feature, but it is a trigger only — it contains no validation implementation.
- `validation.current-step`, the shared current-page operation, also scheduled by
  [hooks](../hooks/README.md)' submit lifecycle after `onAlways`.

The child work kinds are `validation.step`, `validation.field`, and `validation.domain`, shared by both rounds.

## Cross-concern edges

- **hooks**, **reachability**, and **resolve** import validation (the current-step work task type, the validity
  result types, and `validationResult` respectively).
- Validation imports no other concern.

Validation is the most imported concern in the engine, which is why its surface — the work task contracts and
the validity result types — is kept small and free of request-phase knowledge. The zones are in
[eslint.config.mjs](../../../../eslint.config.mjs).
