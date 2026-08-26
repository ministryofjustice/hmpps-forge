import { describe, expect, it } from 'vitest'

import { createClient } from '../../contractHelpers'
import { runStepCases, runJourneyCases } from '../../contractRunner'
import { stepCases, journeyCases } from './expressions.cases'
import {
  chainedIteratorBudgetJourney,
  conditionArgumentErrorJourney,
  generatorArgumentErrorJourney,
  iteratorBudgetJourney,
  nullSubjectJourney,
  outputSchemaErrorJourney,
  transformerSchemaErrorJourney,
  type ExpressionsSession,
} from './expressions.fixtures'

describe('expression contracts', () => {
  runStepCases(stepCases)
  runJourneyCases(journeyCases)

  describe('null subjects', () => {
    it('should treat conditions as false when the subject is null even when the evaluator would accept null', async () => {
      // Arrange
      const client = createClient(nullSubjectJourney)
      const session: ExpressionsSession = { answers: { 'null-subject': { legacy: null } } }

      // Act
      const result = await client.post('/null-subject/form', { session, body: {} })

      // Assert
      // The probe effect received the subject itself, proving it was null and
      // not silently dropped to undefined. HasContent would return true for
      // null (String(null) has content) and Equals(null) would compare
      // null === null, so the unmatched redirect proves neither evaluator ran.
      expect(session.subjectProbe).toBe('null')
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/null-subject/unmatched')
      }
    })
  })

  describe('author mistakes', () => {
    it('should throw when a condition config argument fails its argumentsSchema even though the subject is absent', async () => {
      // Arrange
      const client = createClient(conditionArgumentErrorJourney)

      // Act
      const result = await client.post('/condition-arguments/guarded', { session: {}, body: {} })

      // Assert
      expect(result.type).toBe('error')

      if (result.type === 'error') {
        expect(result.error.message).toContain('Number.GreaterThan: arguments failed schema validation')
      }
    })

    it('should throw when a defined pipe value fails a transformer inputSchema', async () => {
      // Arrange
      const client = createClient(transformerSchemaErrorJourney)

      // Act
      const result = await client.get('/transformer-errors/result', { session: {} })

      // Assert
      expect(result.type).toBe('error')

      if (result.type === 'error') {
        expect(result.error.message).toContain('String.Trim: value failed schema validation')
      }
    })

    it('should throw when a function result fails its outputSchema', async () => {
      // Arrange
      const client = createClient(outputSchemaErrorJourney)

      // Act
      const result = await client.get('/output-schema-errors/result', { session: {} })

      // Assert
      expect(result.type).toBe('error')

      if (result.type === 'error') {
        expect(result.error.message).toContain('Expressions.MeasureBroken: return value failed schema validation')
      }
    })

    it('should throw when a generator config argument fails its argumentsSchema', async () => {
      // Arrange
      const client = createClient(generatorArgumentErrorJourney)

      // Act
      const result = await client.get('/generator-arguments/result', { session: {} })

      // Assert
      expect(result.type).toBe('error')

      if (result.type === 'error') {
        expect(result.error.message).toContain('Expressions.Badge: arguments failed schema validation')
      }
    })
  })

  describe('iterator budget', () => {
    it('should throw ForgeIteratorBudgetExceededError when iteration exceeds the per-request budget', async () => {
      // Arrange
      const client = createClient(iteratorBudgetJourney, { maxIteratorIterations: 5 })
      const session = { data: { items: [1, 2, 3, 4, 5, 6] } }

      // Act
      const result = await client.get('/iterator-budget/result', { session })

      // Assert
      expect(result.type).toBe('error')

      if (result.type === 'error') {
        expect(result.error.message).toContain('exceeded the per-request limit of 5 iterations')
      }
    })

    it('should count chained iterator stages against one shared per-request budget', async () => {
      // Arrange
      // Each stage iterates 4 times, under the limit alone; together they
      // consume 8, so only a shared budget makes the second stage throw.
      const client = createClient(chainedIteratorBudgetJourney, { maxIteratorIterations: 5 })
      const session = { data: { items: [1, 2, 3, 4] } }

      // Act
      const result = await client.get('/iterator-budget-chained/result', { session })

      // Assert
      expect(result.type).toBe('error')

      if (result.type === 'error') {
        expect(result.error.message).toContain('exceeded the per-request limit of 5 iterations')
      }
    })

    it('should render normally when iteration fits a configured maxIteratorIterations limit', async () => {
      // Arrange
      const client = createClient(iteratorBudgetJourney, { maxIteratorIterations: 5 })
      const session = { data: { items: [1, 2, 3] } }

      // Act
      const result = await client.get('/iterator-budget/result', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.mapped).toEqual([1, 2, 3])
      }
    })
  })
})
