import { describe, expect, it } from 'vitest'

import type { journey } from '../../src/authoring'
import type { TestRenderResult, TestResult } from '../../src/testing'
import { answerOf, createClient, type ContractSession } from './contractHelpers'
import { stepScaffold, SCAFFOLD_DONE_PATH, type StepSession, type StepScaffoldOptions } from './stepScaffold'

/** A validation error expectation: a bare message, or an object matched against the error. */
export type ContractErrorExpectation = string | Record<string, unknown>

/**
 * The verdict vocabulary shared by every contract row. A row must carry at
 * least one verdict, and at most one of the redirect/error/render families;
 * the runner asserts exactly the verdict keys a row carries.
 */
export interface ContractVerdicts {
  /** Expect a valid submission: a redirect (to the scaffold's `done` step for step rows). */
  valid?: true
  /** Expect a redirect to exactly this URL. */
  redirectTo?: string
  /** Expect a render, asserted by this key alone. */
  rendered?: true
  /** Expect an error outcome with this status and message. */
  error?: { status: number; message: string }
  /** Response headers expected on the result, by header name. */
  headers?: Record<string, string>
  /** Field validation errors by field code; `{}` asserts no field errors at all. */
  errors?: Record<string, ContractErrorExpectation[]>
  /** Step-level (domain) validation error messages. */
  domainErrors?: string[]
  /** Expected `showValidationFailures` flag on the rendered step. */
  showFailures?: boolean
  /** Answers the submission saved to the session. */
  saved?: Record<string, unknown>
  /** Current answer values on the rendered step, by field code. */
  current?: Record<string, unknown>
  /** Parsed answer values on the rendered step, by field code. */
  parsed?: Record<string, unknown>
  /** Render-context data values by key; a key set to `undefined` asserts absence. */
  data?: Record<string, unknown>
}

/** One declarative row against the standard single-step scaffold. */
export interface StepContractTest extends ContractVerdicts {
  name: string
  /** POST body; when absent the request is a GET. */
  post?: Record<string, unknown>
  /** Flat answers and data seeded before the request; the scaffold nests them. */
  session?: StepSession
}

/** One declarative row against a whole journey definition. */
export interface JourneyContractTest extends ContractVerdicts {
  name: string
  /** Request path within the journey. */
  path: string
  /** POST body; when absent the request is a GET. */
  post?: Record<string, unknown>
  /** Raw session applied verbatim; answers nest under journey codes. */
  session?: ContractSession
}

/** Step scaffold options plus the rows that run against the scaffold they build. */
export interface StepContractCase {
  description: string
  step: StepScaffoldOptions
  tests: StepContractTest[]
}

/** A whole journey definition plus the rows that run against it. */
export interface JourneyContractCase {
  description: string
  journey: ReturnType<typeof journey>
  tests: JourneyContractTest[]
}

/**
 * Registers one describe block per case; each row runs against a fresh
 * scaffold. Call inside the suite's `describe` so declarative and narrative
 * tests share one block.
 */
export function runStepCases(contractCases: StepContractCase[]): void {
  contractCases.forEach(contractCase => {
    describe(contractCase.description, () => {
      it.each(contractCase.tests)('$name', async contractTest => {
        const scaffold = stepScaffold(contractCase.step)
        const { post, session = {} } = contractTest
        const result = post === undefined ? await scaffold.enter(session) : await scaffold.submit(post, session)

        new ContractAssertions(contractTest, SCAFFOLD_DONE_PATH).assert(result, () => scaffold.answers())
      })
    })
  })
}

/**
 * Registers one describe block per case; each row runs against a fresh
 * client. Call inside the suite's `describe` so declarative and narrative
 * tests share one block.
 */
export function runJourneyCases(contractCases: JourneyContractCase[]): void {
  contractCases.forEach(contractCase => {
    describe(contractCase.description, () => {
      it.each(contractCase.tests)('$name', async contractTest => {
        const client = createClient(contractCase.journey)
        const session = contractTest.session ?? {}
        const { path, post } = contractTest
        const result =
          post === undefined ? await client.get(path, { session }) : await client.post(path, { session, body: post })

        new ContractAssertions(contractTest).assert(result, () => session.answers?.[contractCase.journey.code] ?? {})
      })
    })
  })
}

const REDIRECT_VERDICTS = ['valid', 'redirectTo'] as const
const ERROR_VERDICTS = ['error'] as const
const RENDER_VERDICTS = ['rendered', 'errors', 'domainErrors', 'showFailures', 'current', 'parsed', 'data'] as const
const STANDALONE_VERDICTS = ['headers', 'saved'] as const

class ContractAssertions {
  constructor(
    private readonly row: ContractVerdicts & { name: string },
    private readonly validRedirectUrl?: string,
  ) {}

  assert(result: TestResult, savedAnswers: () => Record<string, unknown>): void {
    this.assertRowShape()
    this.assertRedirect(result)
    this.assertError(result)
    this.assertRender(result)
    this.assertHeaders(result)
    this.assertSaved(savedAnswers)
  }

  /** Rejects rows that assert nothing, and rows whose outcome verdicts conflict. */
  private assertRowShape(): void {
    const outcomeFamilies = [
      this.presentVerdicts(REDIRECT_VERDICTS),
      this.presentVerdicts(ERROR_VERDICTS),
      this.presentVerdicts(RENDER_VERDICTS),
    ].filter(family => family.length > 0)

    if (outcomeFamilies.length > 1) {
      throw new Error(`row "${this.row.name}" mixes outcome verdicts: ${outcomeFamilies.flat().join(', ')}`)
    }

    if (outcomeFamilies.length === 0 && this.presentVerdicts(STANDALONE_VERDICTS).length === 0) {
      throw new Error(`row "${this.row.name}" asserts nothing - add at least one verdict key`)
    }
  }

  private presentVerdicts(keys: readonly (keyof ContractVerdicts)[]): (keyof ContractVerdicts)[] {
    return keys.filter(key => this.row[key] !== undefined)
  }

  private assertRedirect(result: TestResult): void {
    const { valid, redirectTo } = this.row

    if (valid === undefined && redirectTo === undefined) {
      return
    }

    expect(result.type, this.describeOutcome(result)).toBe('redirect')

    const expectedUrl = redirectTo ?? this.validRedirectUrl

    if (result.type === 'redirect' && expectedUrl !== undefined) {
      expect(result.url).toBe(expectedUrl)
    }
  }

  private assertError(result: TestResult): void {
    const { error } = this.row

    if (error === undefined) {
      return
    }

    expect(result.type, this.describeOutcome(result)).toBe('error')

    if (result.type === 'error') {
      expect(result.error.status).toBe(error.status)
      expect(result.error.message).toBe(error.message)
    }
  }

  private assertRender(result: TestResult): void {
    if (this.presentVerdicts(RENDER_VERDICTS).length === 0) {
      return
    }

    expect(result.type, this.describeOutcome(result)).toBe('render')

    if (result.type !== 'render') {
      return
    }

    if (this.row.showFailures !== undefined) {
      expect(result.context.showValidationFailures).toBe(this.row.showFailures)
    }

    this.assertFieldErrors(result)
    this.assertDomainErrors(result)
    this.assertAnswerValues(result)
    this.assertContextData(result)
  }

  private assertFieldErrors(result: TestRenderResult): void {
    const { errors } = this.row

    if (errors === undefined) {
      return
    }

    const fieldCodes = Object.keys(errors)

    if (fieldCodes.length === 0) {
      expect(result.context.fieldValidationErrors).toEqual([])

      return
    }

    fieldCodes.forEach(fieldCode => {
      expect(result.getValidationErrorsByFieldCode(fieldCode)).toEqual(this.toErrorMatchers(errors[fieldCode]))
    })
  }

  private assertDomainErrors(result: TestRenderResult): void {
    const { domainErrors } = this.row

    if (domainErrors === undefined) {
      return
    }

    expect(result.context.domainValidationErrors).toEqual(this.toErrorMatchers(domainErrors))
  }

  private assertAnswerValues(result: TestRenderResult): void {
    const { current = {}, parsed = {} } = this.row

    Object.entries(current).forEach(([fieldCode, value]) => {
      expect(answerOf(result.context.answers, fieldCode).current).toEqual(value)
    })
    Object.entries(parsed).forEach(([fieldCode, value]) => {
      expect(answerOf(result.context.answers, fieldCode).parsed).toEqual(value)
    })
  }

  private assertContextData(result: TestRenderResult): void {
    const { data = {} } = this.row

    Object.entries(data).forEach(([key, value]) => {
      expect(result.context.data[key]).toEqual(value)
    })
  }

  private assertHeaders(result: TestResult): void {
    const { headers = {} } = this.row

    Object.entries(headers).forEach(([name, value]) => {
      expect(result.headers.get(name)).toBe(value)
    })
  }

  private assertSaved(savedAnswers: () => Record<string, unknown>): void {
    const { saved } = this.row

    if (saved === undefined) {
      return
    }

    expect(savedAnswers()).toEqual(saved)
  }

  /** What actually happened, attached to outcome-type failures as the expect message. */
  private describeOutcome(result: TestResult): string {
    if (result.type === 'render') {
      const { fieldValidationErrors, domainValidationErrors } = result.context

      return `rendered with field errors ${JSON.stringify(fieldValidationErrors)} and domain errors ${JSON.stringify(domainValidationErrors)}`
    }

    if (result.type === 'redirect') {
      return `redirected to ${result.url}`
    }

    return `errored with ${result.error.status}: ${result.error.message}`
  }

  private toErrorMatchers(expectations: ContractErrorExpectation[]): unknown[] {
    return expectations.map(expectation =>
      expect.objectContaining(typeof expectation === 'string' ? { message: expectation } : expectation),
    )
  }
}
