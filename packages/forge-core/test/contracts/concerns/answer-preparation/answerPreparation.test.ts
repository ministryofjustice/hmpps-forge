import { describe, expect, it } from 'vitest'

import { Answer, Condition, Transformer } from '../../../../src/authoring'
import type { RequestTraceEvent } from '../../../../src/testing'
import { answerOf, answersFromTrace } from '../../contractHelpers'
import { runStepCases } from '../../contractRunner'
import { stepScaffold } from '../../stepScaffold'
import { TextField } from '../../testComponents'
import { cases } from './answerPreparation.cases'

describe('answer preparation contracts', () => {
  runStepCases(cases)

  describe('parsers across requests', () => {
    it('should run formatters on POST and parsers on GET for the same field', async () => {
      // Arrange
      const scaffold = stepScaffold({
        blocks: [
          TextField({
            code: 'fullName',
            formatters: [Transformer.String.Trim()],
            parsers: [Transformer.String.ToUpperCase()],
          }),
        ],
      })

      // Act
      await scaffold.submit({ fullName: '  ada lovelace  ' })
      const result = await scaffold.enter()

      // Assert
      expect(scaffold.answers()).toEqual({ fullName: 'ada lovelace' })

      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const answer = answerOf(result.context.answers, 'fullName')

        expect(answer.current).toBe('ada lovelace')
        expect(answer.parsed).toBe('ADA LOVELACE')
      }
    })

    it('should not apply parsers on POST', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const scaffold = stepScaffold({
        blocks: [TextField({ code: 'fullName', parsers: [Transformer.String.ToUpperCase()] })],
        traces,
      })

      // Act
      await scaffold.submit({ fullName: 'hello' })

      // Assert
      expect(scaffold.answers()).toEqual({ fullName: 'hello' })

      const answer = answerOf(answersFromTrace(traces[0]), 'fullName')

      expect(answer.parsed).toBeUndefined()
      expect(answer.mutations.every(mutation => mutation.source !== 'processed' || mutation.value !== 'HELLO')).toBe(
        true,
      )
    })
  })

  describe('dependentWhen across requests', () => {
    it('should re-seed defaultValue on GET when dependentWhen previously cleared current to undefined', async () => {
      // Arrange
      const scaffold = stepScaffold({
        blocks: [
          TextField({ code: 'contactMethod' }),
          TextField({
            code: 'emailAddress',
            dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
            defaultValue: 'default@example.com',
          }),
        ],
      })

      // Act - POST with phone to clear emailAddress via dependentWhen
      await scaffold.submit(
        { contactMethod: 'phone', emailAddress: 'ada@example.com' },
        { answers: { contactMethod: 'email', emailAddress: 'ada@example.com' } },
      )

      expect(scaffold.answers().emailAddress).toBeUndefined()

      // Act - GET should re-seed the defaultValue because current is undefined
      const result = await scaffold.enter()

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(answerOf(result.context.answers, 'emailAddress').current).toBe('default@example.com')
      }
    })

    it('should show cleared answer on GET after dependentWhen cleared it on POST', async () => {
      // Arrange
      const scaffold = stepScaffold({
        blocks: [
          TextField({ code: 'contactMethod' }),
          TextField({
            code: 'emailAddress',
            dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
          }),
        ],
      })

      // Act - POST with phone to clear emailAddress via dependentWhen
      await scaffold.submit(
        { contactMethod: 'phone', emailAddress: 'ada@example.com' },
        { answers: { contactMethod: 'email', emailAddress: 'ada@example.com' } },
      )

      // Act - GET re-renders the step with the updated session
      const result = await scaffold.enter()

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(answerOf(result.context.answers, 'emailAddress').current).toBeUndefined()
      }
    })
  })

  describe('same-code cleardown', () => {
    // With no same-code copy active the shared answer is cleared once, not
    // once per copy.
    it('should clear a same-code field once when no copy is active', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const scaffold = stepScaffold({
        blocks: [
          TextField({ code: 'employment_status' }),
          TextField({
            code: 'has_been_employed',
            dependentWhen: Answer('employment_status').match(Condition.Equals('unavailable')),
          }),
          TextField({
            code: 'has_been_employed',
            dependentWhen: Answer('employment_status').match(Condition.Equals('actively-seeking')),
          }),
          TextField({
            code: 'has_been_employed',
            dependentWhen: Answer('employment_status').match(Condition.Equals('not-actively-seeking')),
          }),
        ],
        traces,
      })

      // Act
      await scaffold.submit({ employment_status: 'employed', has_been_employed: 'yes' })

      // Assert
      const history = answerOf(answersFromTrace(traces[0]), 'has_been_employed')

      expect(history.current).toBeUndefined()
      expect(history.mutations).toEqual([{ value: undefined, source: 'dependentWhen' }])
    })
  })

  describe('mutation history', () => {
    it('should record a post mutation on plain submission', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const scaffold = stepScaffold({ blocks: [TextField({ code: 'fullName' })], traces })

      // Act
      await scaffold.submit({ fullName: 'Ada' })

      // Assert
      const answers = answersFromTrace(traces[0])

      expect(answerOf(answers, 'fullName').mutations).toEqual([{ value: 'Ada', source: 'post' }])
    })

    it('should record post and processed mutations when formatters change the value', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const scaffold = stepScaffold({
        blocks: [
          TextField({
            code: 'fullName',
            formatters: [Transformer.String.Trim(), Transformer.String.ToTitleCase()],
          }),
        ],
        traces,
      })

      // Act
      await scaffold.submit({ fullName: '  ada lovelace  ' })

      // Assert
      const answers = answersFromTrace(traces[0])

      expect(answerOf(answers, 'fullName').mutations).toEqual([
        { value: '  ada lovelace  ', source: 'post' },
        { value: 'Ada Lovelace', source: 'processed' },
      ])
    })

    it('should record a default mutation when seeding on GET', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const scaffold = stepScaffold({
        blocks: [TextField({ code: 'country', defaultValue: 'United Kingdom' })],
        traces,
      })

      // Act
      await scaffold.enter()

      // Assert
      const answers = answersFromTrace(traces[0])

      expect(answerOf(answers, 'country').mutations).toEqual([{ value: 'United Kingdom', source: 'default' }])
    })

    it('should record a dependentWhen mutation when condition is false', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const scaffold = stepScaffold({
        blocks: [
          TextField({ code: 'contactMethod' }),
          TextField({
            code: 'emailAddress',
            dependentWhen: Answer('contactMethod').match(Condition.Equals('email')),
          }),
        ],
        traces,
      })

      // Act
      await scaffold.submit(
        { contactMethod: 'phone', emailAddress: 'ada@example.com' },
        { answers: { contactMethod: 'email', emailAddress: 'ada@example.com' } },
      )

      // Assert
      const answer = answerOf(answersFromTrace(traces[0]), 'emailAddress')

      expect(answer.mutations).toEqual([
        { value: 'ada@example.com', source: 'access' },
        { value: 'ada@example.com', source: 'post' },
        { value: undefined, source: 'dependentWhen' },
      ])
      expect(answer.current).toBeUndefined()
    })
  })
})
