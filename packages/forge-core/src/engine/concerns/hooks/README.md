# hooks

Hooks are the authored lifecycle work around a request. Access hooks inherit down the journey tree and can halt a
request with a redirect or an error before anything else mutates or renders. Submit hooks belong to the step that
declares them and run on `POST`: they gate on predicates, run effects, trigger validation, then select an
`onAlways`, `onValid`, or `onInvalid` branch. Both lifecycles are modelled as `WorkTask` trees so the executor can
trace each stage and stop at the right point.

## Stage folders

- [analysis](analysis/README.md) resolves which access hooks and submit hooks apply to a step or journey.
- [lowering](lowering/README.md) emits the access and submit lifecycle functions.
- [runtime](runtime/README.md) runs the lifecycles, gates the predicates, and folds hook results.
- `contracts` holds `AccessLifecycleWork.type.ts`, `SubmitLifecycleWork.type.ts`, `HookEffectWork.type.ts`, `hookLifecycle.type.ts`, and `HookStage.type.ts`.

## Runtime phases

This concern owns `request.access` and `request.submit`. Access work runs as `access.lifecycle`, `access.hook`,
`access.hook.when`, `access.hook.next`, and `hook.effect`. Submit work runs as `submit.lifecycle`, `submit.hook`,
`submit.predicate`, `submit.branch`, and `hook.effect`. The `submit.validation` stage that sits between
`onAlways` and the valid/invalid branches belongs to [validation](../validation/README.md), because the work it
does is validation - it only runs as a hook stage.

## Cross-concern edges

- Hooks import **validation** for `stepValidity`, `stepValidityState`, and the validity result types.
- **Validation** imports hooks for the work-stage contracts `SubmitValidationWorkHandler` implements.

That is a genuine two-way pair: submit validation is validation work scheduled by the hook lifecycle. Every other
concern edge is blocked by the zones in [eslint.config.mjs](../../../../eslint.config.mjs).
