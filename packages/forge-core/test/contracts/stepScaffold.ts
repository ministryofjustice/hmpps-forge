import {
  access,
  createForgePackage,
  journey,
  redirect,
  step,
  submit,
  type StepDefinition,
  type SubmitHook,
} from '../../src/authoring'
import { ForgeTestClient, ForgeTestHarness, type RequestTraceEvent, TestResult } from '../../src/testing'
import { Effects, type ContractSession } from './contractHelpers'

const JOURNEY_CODE = 'scaffold'
const STEP_PATH = `/${JOURNEY_CODE}/step`

/** Where the default submission hook redirects on success. */
export const SCAFFOLD_DONE_PATH = `/${JOURNEY_CODE}/done`

/**
 * The scaffolding every single-step case repeats: journey, step, submit
 * hook, done/invalid steps, and session effects. The blocks and rules under
 * test are plain authoring DSL, passed through untouched under their real
 * authoring names.
 */
export interface StepScaffoldOptions {
  /** Step blocks under test. */
  blocks?: StepDefinition['blocks']
  /** Step-level `validWhen` rules (domain validation), passed through verbatim. */
  validWhen?: StepDefinition['validWhen']
  /** Step-level `validateOnEntry` configuration, passed through verbatim. */
  validateOnEntry?: StepDefinition['validateOnEntry']
  /**
   * Submission hooks, passed through verbatim. The scaffold provides `done`
   * and `invalid` steps as redirect targets. When absent, the default hook
   * applies (see {@link StepScaffold}).
   */
  onSubmission?: StepDefinition['onSubmission']
  /** Collects request traces when provided. */
  traces?: RequestTraceEvent[]
}

/** Session state for one request; the journey-code nesting is handled here. */
export interface StepSession {
  answers?: Record<string, unknown>
  data?: Record<string, unknown>
}

/**
 * The default submission lifecycle is the common production shape: validate
 * the default group, then save answers and redirect to `done` on success, or
 * re-render on failure. Pass `onSubmission` for any other lifecycle (for
 * example `validate: false` with `onAlways`, covered by narrative tests).
 */
export class StepScaffold {
  private readonly client: ForgeTestClient

  private readonly session: ContractSession = {}

  constructor(private readonly options: StepScaffoldOptions = {}) {
    this.client = this.createClient()
  }

  async enter(seed: StepSession = {}): Promise<TestResult> {
    this.seedSession(seed)

    return this.client.get(STEP_PATH, { session: this.session })
  }

  async submit(body: Record<string, unknown>, seed: StepSession = {}): Promise<TestResult> {
    this.seedSession(seed)

    return this.client.post(STEP_PATH, { session: this.session, body })
  }

  /** The answers a valid submission saved, as stored in the scaffold's session. */
  answers(): Record<string, unknown> {
    return this.session.answers?.[JOURNEY_CODE] ?? {}
  }

  private createClient(): ForgeTestClient {
    return this.createHarness()
      .registerPackage(createForgePackage({ journey: this.buildJourney() }))
      .createClient()
  }

  private createHarness(): ForgeTestHarness {
    const traces = this.options.traces

    if (traces === undefined) {
      return new ForgeTestHarness()
    }

    return new ForgeTestHarness({
      instrumentation: {
        sinks: [{ onRequestTrace: event => traces.push(event) }],
      },
    })
  }

  private buildJourney() {
    return journey({
      code: JOURNEY_CODE,
      path: `/${JOURNEY_CODE}`,
      title: 'Step scaffold',
      onAccess: [access({ effects: [Effects.LoadAnswers(JOURNEY_CODE), Effects.LoadData()] })],
      steps: [
        this.buildScaffoldStep(),
        step({ code: 'done', path: '/done', title: 'Done', blocks: [] }),
        step({ code: 'invalid', path: '/invalid', title: 'Invalid', blocks: [] }),
      ],
    })
  }

  private buildScaffoldStep(): StepDefinition {
    const draft: Omit<StepDefinition, 'type'> = {
      path: '/step',
      title: 'Step',
      reachability: { entryWhen: true },
      blocks: this.options.blocks ?? [],
      onSubmission: this.buildSubmissionHooks(),
    }

    if (this.options.validWhen !== undefined) {
      draft.validWhen = this.options.validWhen
    }

    if (this.options.validateOnEntry !== undefined) {
      draft.validateOnEntry = this.options.validateOnEntry
    }

    return step(draft)
  }

  private buildSubmissionHooks(): SubmitHook[] {
    return this.options.onSubmission ?? [
      submit({
        validate: true,
        onValid: {
          effects: [Effects.SaveAnswers(JOURNEY_CODE)],
          next: [redirect({ goto: 'done' })],
        },
      }),
    ]
  }

  private seedSession(seed: StepSession): void {
    if (seed.answers !== undefined) {
      this.session.answers = { [JOURNEY_CODE]: seed.answers }
    }

    if (seed.data !== undefined) {
      this.session.data = seed.data
    }
  }
}

export function stepScaffold(options: StepScaffoldOptions = {}): StepScaffold {
  return new StepScaffold(options)
}
