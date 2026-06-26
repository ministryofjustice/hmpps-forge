/**
 * The result every hook stage returns. A hook runs its stages as one `first-match`
 * group: a `continue` stage lets the next stage run; a `terminal` stage carries the
 * hook's final result and stops the group. The hook's `complete` is then a pure fold
 * — return the terminal stage's result, or a default when every stage continued.
 */
export type HookStageResult<TFinal> =
  | { readonly status: 'continue' }
  | { readonly status: 'terminal'; readonly result: TFinal }
