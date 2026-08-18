import type { AuthoredValue, ExpressionValue } from '../../../chassis/contracts/models/authoredValue.type'

/**
 * The hooks concern's semantic model. Built by `HookAnalyzer`, consumed by
 * `HookLifecycleCompiler`. AST nodes survive here only as expression leaves
 * and diagnostic tokens.
 */
export interface StepHookModel {
  readonly access: AccessLifecycleModel
  readonly submit: SubmitHooksModel
}

export interface JourneyHookModel {
  readonly access: AccessLifecycleModel
}

/** The access hooks one generated access-lifecycle function runs, inherited root-first. */
export interface AccessLifecycleModel {
  /** Script-URL identity segment; `undefined` leaves the script unlabelled. */
  readonly label?: string
  readonly hooks: readonly AccessHookModel[]
}

export interface SubmitHooksModel {
  /** Script-URL identity segment; `undefined` leaves the script unlabelled. */
  readonly label?: string
  readonly hooks: readonly SubmitHookModel[]
}

export interface AccessHookModel {
  /** Stable work-task key, e.g. `access-hook-0`. */
  readonly key: string
  /** Generated-comment label: the authored path when known, else the key. */
  readonly label: string
  /** Guard predicate; absent means the hook always runs. */
  readonly when?: ExpressionValue
  readonly effects: readonly EffectCall[]
  readonly outcomes: readonly HookOutcomeModel[]
}

export interface SubmitHookModel {
  /** Stable work-task key, e.g. `submit-hook-0`. */
  readonly key: string
  /** Generated-comment label: the authored path when known, else the key. */
  readonly label: string
  /** Guard predicate; absent means the hook always runs. */
  readonly when?: ExpressionValue
  /** Guard evaluated alongside `when`; absent defaults to passing. */
  readonly guards?: ExpressionValue
  readonly validate: boolean
  /** Defaulted to `['default']` at analysis when none are authored. */
  readonly validationGroups: readonly string[]
  readonly branches: SubmitBranchesModel
}

export interface SubmitBranchesModel {
  /** Always present — an unauthored branch is an empty one. */
  readonly onAlways: SubmitBranchModel
  /** Present only when authored. */
  readonly onValid?: SubmitBranchModel
  /** Present only when authored. */
  readonly onInvalid?: SubmitBranchModel
}

export interface SubmitBranchModel {
  readonly effects: readonly EffectCall[]
  readonly outcomes: readonly HookOutcomeModel[]
}

export interface EffectCall {
  /** Stable work-task key, e.g. `submit-hook-0-onAlways-effect-0`. */
  readonly key: string
  readonly name: string
  readonly arguments: readonly AuthoredValue[]
  /** The effect call itself, kept as the tracked call's diagnostic source. */
  readonly node: ExpressionValue
}

export enum HookOutcomeKind {
  REDIRECT = 'redirect',
  THROW_ERROR = 'throw-error',
}

export type HookOutcomeModel = RedirectOutcomeModel | ThrowErrorOutcomeModel

export interface RedirectOutcomeModel {
  readonly kind: HookOutcomeKind.REDIRECT
  /** Outcome guard; absent means the redirect always applies. */
  readonly when?: ExpressionValue
  readonly goto: string | ExpressionValue
}

export interface ThrowErrorOutcomeModel {
  readonly kind: HookOutcomeKind.THROW_ERROR
  /** Outcome guard; absent means the error always applies. */
  readonly when?: ExpressionValue
  readonly status: number
  readonly message: string | ExpressionValue
}
