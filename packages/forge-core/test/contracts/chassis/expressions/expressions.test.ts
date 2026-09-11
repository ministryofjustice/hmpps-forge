import { describe, expect, it, vi } from 'vitest'
import { and, or } from '../../../../src/authoring/builders/combinators'
import { when, Conditional } from '../../../../src/authoring/builders/ConditionalExprBuilder'
import { match } from '../../../../src/authoring/builders/MatchExprBuilder'
import { GeneralConditions } from '../../../../src/built-ins/functions/conditions/generalConditions'
import { Data, Loop, Item } from '../../../../src/authoring/builders/references'
import { Literal } from '../../../../src/authoring/builders/values'
import { Iterator } from '../../../../src/authoring/builders/iterators'
import { generator } from '../../../../src/authoring/functions/generator'
import { StringTransformers } from '../../../../src/built-ins/functions/transformers/stringTransformers'

import { createClient } from '../../contractHelpers'
import { runStepCases, runJourneyCases } from '../../contractRunner'
import { stepCases, journeyCases } from './expressions.cases'
import {
  evaluationJourney,
  evaluationContexts,
  iteratorPredicatesJourney,
  someShortCircuitJourney,
  everyShortCircuitJourney,
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

  describe('iterator predicates', () => {
    it.each(evaluationContexts)(
      'should skip callbacks for empty iterators when evaluating %s expressions',
      async context => {
        // Arrange
        const unused = vi.fn(() => {
          throw new Error('Unused expression ran')
        })
        const Unused = generator('UnusedExpression', { factory: () => unused })
        const client = createClient(
          evaluationJourney(
            'phase-expression',
            {
              result: {
                map: Data('empty').each(Iterator.Map(Unused())),
                some: Data('empty').each(Iterator.Some(Unused().match(GeneralConditions.Equals(true)))),
                every: Data('empty').each(Iterator.Every(Unused().match(GeneralConditions.Equals(true)))),
                count: Data('empty').each(Iterator.Count(Unused().match(GeneralConditions.Equals(true)))),
              },
            },
            context,
          ),
        )

        // Act
        const result = await client.get('/phase-expression/result', { session: { data: { empty: [] } } })

        // Assert
        expect(result.type).toBe('render')
        if (result.type !== 'render') {
          throw new Error('Expected render output')
        }

        const values = {
          hook: { result: result.context.data.result },
          metadata: result.context.routeTree[0]?.children[0]?.metadata,
          property: result.context.blocks[0]?.properties.value,
          default: result.context.blocks[0]?.properties.value,
        }
        const actual = values[context]

        expect(actual).toStrictEqual({ result: { map: [], some: false, every: true, count: 0 } })
        expect(unused).not.toHaveBeenCalled()
      },
    )

    it.each(evaluationContexts)(
      'should preserve keyed iterator results when evaluating %s expressions',
      async context => {
        // Arrange
        const isYes = Item().value().match(GeneralConditions.Equals('yes'))
        const client = createClient(
          evaluationJourney(
            'phase-expression',
            {
              result: {
                filtered: Data('keyed').each(Iterator.Filter(isYes)),
                found: Data('keyed').each(Iterator.Find(isYes)),
                some: Data('keyed').each(Iterator.Some(isYes)),
                every: Data('keyed').each(Iterator.Every(isYes)),
                count: Data('keyed').each(Iterator.Count(isYes)),
              },
            },
            context,
          ),
        )

        // Act
        const result = await client.get('/phase-expression/result', {
          session: { data: { keyed: { first: 'no', second: 'yes' } } },
        })

        // Assert
        expect(result.type).toBe('render')
        if (result.type !== 'render') {
          throw new Error('Expected render output')
        }

        const values = {
          hook: { result: result.context.data.result },
          metadata: result.context.routeTree[0]?.children[0]?.metadata,
          property: result.context.blocks[0]?.properties.value,
          default: result.context.blocks[0]?.properties.value,
        }
        const actual = values[context]

        expect(actual).toStrictEqual({
          result: { filtered: [['second', 'yes']], found: ['second', 'yes'], some: true, every: false, count: 1 },
        })
      },
    )

    it.each(evaluationContexts)(
      'should retain undefined array and map entries when evaluating %s expressions',
      async context => {
        // Arrange

        const client = createClient(
          evaluationJourney(
            'phase-expression',
            {
              result: {
                array: ['first', Data('missing'), Data('alsoMissing'), 'last'],
                mapped: Data('items').each(Iterator.Map(Item().value())),
                nested: Data('groups').each(Iterator.Map(Item().value().each(Iterator.Map(Item().value())))),
              },
            },
            context,
          ),
        )

        // Act
        const result = await client.get('/phase-expression/result', {
          session: { data: { items: [1, undefined, 3], groups: [[1, undefined], [3]] } },
        })

        // Assert
        expect(result.type).toBe('render')
        if (result.type !== 'render') {
          throw new Error('Expected render output')
        }

        const values = {
          hook: { result: result.context.data.result },
          metadata: result.context.routeTree[0]?.children[0]?.metadata,
          property: result.context.blocks[0]?.properties.value,
          default: result.context.blocks[0]?.properties.value,
        }
        const actual = values[context]

        expect(actual).toStrictEqual({
          result: {
            array: ['first', undefined, undefined, 'last'],
            mapped: [1, undefined, 3],
            nested: [[1, undefined], [3]],
          },
        })
      },
    )

    it.each([
      { count: 0, items: [], some: false, every: true, composed: 'uniform' },
      { count: 2, items: ['yes', 'yes'], some: true, every: true, composed: 'uniform' },
      { count: 0, items: ['no', 'no'], some: false, every: false, composed: 'uniform' },
      { count: 1, items: ['no', 'yes'], some: true, every: false, composed: 'mixed' },
    ])(
      'should return some=$some and every=$every when items are $items',
      async ({ items, some, every, composed, count }) => {
        // Arrange
        const client = createClient(iteratorPredicatesJourney)
        const session = {
          data: {
            items,
            groups: [
              { expected: 'yes', items: ['yes'] },
              { expected: 'no', items: ['yes'] },
            ],
            keyed: { other: 1, target: 2 },
          },
        }

        // Act
        const result = await client.get('/iterator-predicates/result', { session })

        // Assert
        expect(result.type).toBe('render')
        if (result.type === 'render') {
          expect(result.context.data).toMatchObject({
            some,
            every,
            count,
            asyncCount: count,
            countPlusOne: count + 1,
            nestedCounts: [1, 0],
            keyedCount: 2,
            asyncSome: some,
            asyncEvery: every,
            composed,
            nested: [true, false],
            keyed: true,
          })
        }
      },
    )

    it.each([
      { definition: someShortCircuitJourney, path: '/some-short-circuit/result', first: 'yes', expected: true },
      { definition: everyShortCircuitJourney, path: '/every-short-circuit/result', first: 'no', expected: false },
    ])('should stop before a failing item when visiting $path', async ({ definition, path, first, expected }) => {
      // Arrange
      const client = createClient(definition, { maxIteratorIterations: 1 })
      const session = { data: { items: [first, 'unexpected'] } }

      // Act
      const result = await client.get(path, { session })

      // Assert
      expect(result.type).toBe('render')
      if (result.type === 'render') {
        expect(result.context.data.result).toBe(expected)
      }
    })
  })

  describe('nullish()', () => {
    it.each(evaluationContexts)(
      'should skip the fallback for a present value when evaluating %s expressions',
      async context => {
        // Arrange
        const unused = vi.fn(() => {
          throw new Error('Unused expression ran')
        })
        const Unused = generator('UnusedExpression', { factory: () => unused })
        const client = createClient(
          evaluationJourney('phase-expression', { result: Data('choice').nullish(Unused()) }, context),
        )

        // Act
        const result = await client.get('/phase-expression/result', { session: { data: { choice: 'yes' } } })

        // Assert
        expect(result.type).toBe('render')
        if (result.type !== 'render') {
          throw new Error('Expected render output')
        }

        const values = {
          hook: { result: result.context.data.result },
          metadata: result.context.routeTree[0]?.children[0]?.metadata,
          property: result.context.blocks[0]?.properties.value,
          default: result.context.blocks[0]?.properties.value,
        }
        const actual = values[context]

        expect(actual).toStrictEqual({ result: 'yes' })
        expect(unused).not.toHaveBeenCalled()
      },
    )

    it.each([
      { primaryValue: undefined, expected: 'fallback', fallbackCalls: 1 },
      { primaryValue: null, expected: 'fallback', fallbackCalls: 1 },
      { primaryValue: false, expected: false, fallbackCalls: 0 },
      { primaryValue: 0, expected: 0, fallbackCalls: 0 },
      { primaryValue: '', expected: '', fallbackCalls: 0 },
      { primaryValue: [], expected: [], fallbackCalls: 0 },
      { primaryValue: {}, expected: {}, fallbackCalls: 0 },
      { primaryValue: 'present', expected: 'present', fallbackCalls: 0 },
    ])(
      'should resolve $expected when the primary is $primaryValue',
      async ({ primaryValue, expected, fallbackCalls }) => {
        // Arrange
        const primary = vi.fn(async () => primaryValue)
        const fallback = vi.fn(async () => 'fallback')
        const Primary = generator('Primary', { factory: () => primary })
        const Fallback = generator('Fallback', { factory: () => fallback })
        const client = createClient(
          evaluationJourney('nullish', {
            result: Primary().nullish(Fallback()),
            piped: Data('missing').nullish('word').pipe(StringTransformers.ToUpperCase()),
            nested: Data('missing').nullish(Literal(null).nullish('nested')),
            absent: Data('missing').nullish(undefined),
          }),
        )

        // Act
        const result = await client.get('/nullish/result', { session: {} })

        // Assert
        expect(result.type).toBe('render')
        expect(primary).toHaveBeenCalledTimes(1)
        expect(fallback).toHaveBeenCalledTimes(fallbackCalls)
        if (result.type === 'render') {
          expect(result.context.data.result).toEqual(expected)
          expect(result.context.data.piped).toBe('WORD')
          expect(result.context.data.nested).toBe('nested')
          expect(result.context.data.absent).toBeUndefined()
        }
      },
    )

    it('should compose across value builders when values and branches are missing', async () => {
      // Arrange
      const unused = vi.fn(() => {
        throw new Error('Unselected branch evaluated')
      })
      const Unused = generator({ name: 'UnusedNullishBranch', factory: () => unused })
      const predicate = Data('flag').match(GeneralConditions.Equals(true))
      const client = createClient(
        evaluationJourney('fluent-nullish', {
          conditional: when(predicate).then(Data('missing')).else(Unused()).nullish('conditional'),
          alternate: when(Data('otherFlag').match(GeneralConditions.Equals(true)))
            .then(Unused())
            .else(Data('missing'))
            .nullish('alternate'),
          matched: match(Data('flag')).case(true, Data('missing')).otherwise(Unused()).nullish('match'),
          unmatched: match(Data('flag')).case(false, Unused()).nullish('unmatched'),
          literal: Literal(null).nullish('literal'),
          pipeline: Data('missing').pipe(StringTransformers.Trim()).nullish('pipeline'),
          items: Data('items').each(Iterator.Map(Loop.Item().nullish('item'))),
          scopedItems: Data('items').each(Iterator.Map(Item().nullish('item'))),
          collection: Data('empty').each(Iterator.Map(Loop.Item().value())).nullish(['fallback']),
          found: Data('empty').each(Iterator.Find(Loop.Item().value().match(GeneralConditions.Equals(true))))
            .nullish({ name: 'found fallback' }).path('name'),
          count: Data('empty').each(Iterator.Count(Loop.Item().value().match(GeneralConditions.Equals(true)))).nullish(100),
        }),
      )

      // Act
      const result = await client.get('/fluent-nullish/result', {
        session: { data: { flag: true, items: [null, 'present'], empty: [] } },
      })

      // Assert
      expect(result.type).toBe('render')
      expect(unused).not.toHaveBeenCalled()
      if (result.type === 'render') {
        expect(result.context.data).toMatchObject({
          conditional: 'conditional',
          alternate: 'alternate',
          matched: 'match',
          unmatched: 'unmatched',
          literal: 'literal',
          pipeline: 'pipeline',
          items: ['item', 'present'],
          scopedItems: ['item', 'present'],
          collection: [],
          found: 'found fallback',
          count: 0,
        })
      }
    })

    it('should propagate the primary error when a fallback is available', async () => {
      // Arrange
      const Primary = generator('FailingPrimary', {
        factory: () => () => {
          throw new Error('primary failed')
        },
      })
      const fallback = vi.fn(() => 'fallback')
      const Fallback = generator('UnusedFallback', { factory: () => fallback })
      const client = createClient(evaluationJourney('nullish-error', { result: Primary().nullish(Fallback()) }))

      // Act
      const result = await client.get('/nullish-error/result', { session: {} })

      // Assert
      expect(result.type).toBe('error')
      expect(fallback).not.toHaveBeenCalled()
      if (result.type === 'error') {
        expect(result.error.message).toContain('primary failed')
      }
    })
  })

  describe('native match cases', () => {
    it.each(evaluationContexts)(
      'should evaluate an async subject once per match when evaluating %s expressions',
      async context => {
        // Arrange
        const unused = vi.fn(() => {
          throw new Error('Unused expression ran')
        })
        const Unused = generator('UnusedExpression', { factory: () => unused })
        const subject = vi.fn(async () => 'second')
        const Subject = generator('Subject', { factory: () => subject })
        const selected = vi.fn(async () => 'selected')
        const Selected = generator('Selected', { factory: () => selected })
        const client = createClient(
          evaluationJourney(
            'phase-expression',
            { result: match(Subject()).case('first', Unused()).case('second', Selected()).otherwise(Unused()) },
            context,
          ),
        )

        // Act
        const result = await client.get('/phase-expression/result', { session: { data: {} } })

        // Assert
        expect(result.type).toBe('render')
        if (result.type !== 'render') {
          throw new Error('Expected render output')
        }

        const values = {
          hook: { result: result.context.data.result },
          metadata: result.context.routeTree[0]?.children[0]?.metadata,
          property: result.context.blocks[0]?.properties.value,
          default: result.context.blocks[0]?.properties.value,
        }
        const actual = values[context]

        expect(actual).toStrictEqual({ result: 'selected' })
        expect(selected).toHaveBeenCalled()
        expect(subject).toHaveBeenCalledTimes(selected.mock.calls.length)
        expect(unused).not.toHaveBeenCalled()
      },
    )

    it.each(evaluationContexts)(
      'should preserve mixed match branches and missing cases when evaluating %s expressions',
      async context => {
        // Arrange
        const unused = vi.fn(() => {
          throw new Error('Unused expression ran')
        })
        const Unused = generator('UnusedExpression', { factory: () => unused })
        const client = createClient(
          evaluationJourney(
            'phase-expression',
            {
              result: {
                matched: match(Data('choice')).case('yes', 'selected').otherwise(Unused()),
                mixed: match(Data('choice'))
                  .case('no', Unused())
                  .branch(GeneralConditions.Equals('yes'), 'selected')
                  .otherwise(Unused()),
                absent: match(Data('missing')).case(Data('alsoMissing'), 'absent').otherwise(Unused()),
              },
            },
            context,
          ),
        )

        // Act
        const result = await client.get('/phase-expression/result', { session: { data: { choice: 'yes' } } })

        // Assert
        expect(result.type).toBe('render')
        if (result.type !== 'render') {
          throw new Error('Expected render output')
        }

        const values = {
          hook: { result: result.context.data.result },
          metadata: result.context.routeTree[0]?.children[0]?.metadata,
          property: result.context.blocks[0]?.properties.value,
          default: result.context.blocks[0]?.properties.value,
        }
        const actual = values[context]

        expect(actual).toStrictEqual({ result: { matched: 'selected', mixed: 'selected', absent: 'absent' } })
        expect(unused).not.toHaveBeenCalled()
      },
    )

    it.each([
      { value: null, expected: null, result: 'matched' },
      { value: undefined, expected: undefined, result: 'matched' },
      { value: null, expected: undefined, result: 'fallback' },
      { value: 0, expected: false, result: 'fallback' },
      { value: 1, expected: '1', result: 'fallback' },
      { value: false, expected: false, result: 'matched' },
    ])('should use strict equality when comparing $value with $expected', async ({ value, expected, result }) => {
      // Arrange
      const client = createClient(
        evaluationJourney('native-case', {
          result: match(Data('value')).case(Data('expected'), 'matched').otherwise('fallback'),
          missing: match(Data('missing')).case(Data('alsoMissing'), 'undefined'),
        }),
      )

      // Act
      const outcome = await client.get('/native-case/result', { session: { data: { value, expected } } })

      // Assert
      expect(outcome.type).toBe('render')
      if (outcome.type === 'render') {
        expect(outcome.context.data.result).toBe(result)
        expect(outcome.context.data.missing).toBe('undefined')
      }
    })

    it('should compare object identity when both operands resolve to objects', async () => {
      // Arrange
      const client = createClient(
        evaluationJourney('case-identity', {
          same: match(Data('object')).case(Data('object'), true).otherwise(false),
          different: match(Data('object')).case({ value: 1 }, true).otherwise(false),
        }),
      )

      // Act
      const outcome = await client.get('/case-identity/result', { session: { data: { object: { value: 1 } } } })

      // Assert
      expect(outcome.type).toBe('render')
      if (outcome.type === 'render') {
        expect(outcome.context.data.same).toBe(true)
        expect(outcome.context.data.different).toBe(false)
      }
    })

    it('should share the subject across combinator leaves while keeping argument predicates independent', async () => {
      // Arrange
      const subject = vi.fn(async () => true)
      const Subject = generator({ name: 'CombinatorSubject', factory: () => subject })
      const client = createClient(
        evaluationJourney('case-combinators', {
          result: match(Subject())
            .case(false, 'wrong')
            .branch(
              and(
                GeneralConditions.Equals(true),
                GeneralConditions.Equals(
                  Data('items').each(Iterator.Some(Item().value().match(GeneralConditions.Equals('yes')))),
                ),
              ),
              'matched',
            )
            .otherwise('fallback'),
        }),
      )

      // Act
      const outcome = await client.get('/case-combinators/result', { session: { data: { items: ['yes'] } } })

      // Assert
      expect(outcome.type).toBe('render')
      expect(subject).toHaveBeenCalledTimes(1)
      if (outcome.type === 'render') {
        expect(outcome.context.data.result).toBe('matched')
      }
    })

    it('should evaluate the subject once and keep ordered mixed branches lazy', async () => {
      // Arrange
      const subject = vi.fn(async () => 'selected')
      const selected = vi.fn(async () => 'result')
      const unused = vi.fn(async () => {
        throw new Error('Unselected branch evaluated')
      })
      const Subject = generator({ name: 'MatchSubject', factory: () => subject })
      const Selected = generator({ name: 'SelectedCase', factory: () => selected })
      const Unused = generator({ name: 'UnusedCase', factory: () => unused })
      const client = createClient(
        evaluationJourney('ordered-case', {
          result: match(Subject())
            .case('other', Unused())
            .branch(GeneralConditions.Equals('other'), Unused())
            .case('selected', Selected())
            .case(Unused(), Unused())
            .otherwise(Unused()),
        }),
      )

      // Act
      const outcome = await client.get('/ordered-case/result', { session: {} })

      // Assert
      expect(outcome.type).toBe('render')
      expect(subject).toHaveBeenCalledTimes(1)
      expect(selected).toHaveBeenCalledTimes(1)
      expect(unused).not.toHaveBeenCalled()
      if (outcome.type === 'render') {
        expect(outcome.context.data.result).toBe('result')
      }
    })
  })

  describe('branch pipelines', () => {
    it.each(evaluationContexts)(
      'should keep conditional and logical branches lazy when evaluating %s expressions',
      async context => {
        // Arrange
        const unused = vi.fn(() => {
          throw new Error('Unused expression ran')
        })
        const Unused = generator('UnusedExpression', { factory: () => unused })
        const client = createClient(
          evaluationJourney(
            'phase-expression',
            {
              result: {
                conditional: when(Data('choice').match(GeneralConditions.Equals('yes')))
                  .then('selected')
                  .else(Unused()),
                logicalAnd: and(
                  Data('choice').match(GeneralConditions.Equals('no')),
                  Unused().match(GeneralConditions.Equals(true)),
                ),
                logicalOr: or(
                  Data('choice').match(GeneralConditions.Equals('yes')),
                  Unused().match(GeneralConditions.Equals(true)),
                ),
              },
            },
            context,
          ),
        )

        // Act
        const result = await client.get('/phase-expression/result', { session: { data: { choice: 'yes' } } })

        // Assert
        expect(result.type).toBe('render')
        if (result.type !== 'render') {
          throw new Error('Expected render output')
        }

        const values = {
          hook: { result: result.context.data.result },
          metadata: result.context.routeTree[0]?.children[0]?.metadata,
          property: result.context.blocks[0]?.properties.value,
          default: result.context.blocks[0]?.properties.value,
        }
        const actual = values[context]

        expect(actual).toStrictEqual({ result: { conditional: 'selected', logicalAnd: false, logicalOr: true } })
        expect(unused).not.toHaveBeenCalled()
      },
    )

    it.each(evaluationContexts)('should evaluate nested pipelines when evaluating %s expressions', async context => {
      // Arrange

      const client = createClient(
        evaluationJourney(
          'phase-expression',
          { result: Data('choice').pipe(StringTransformers.ToUpperCase()) },
          context,
        ),
      )

      // Act
      const result = await client.get('/phase-expression/result', { session: { data: { choice: 'yes' } } })

      // Assert
      expect(result.type).toBe('render')
      if (result.type !== 'render') {
        throw new Error('Expected render output')
      }

      const values = {
        hook: { result: result.context.data.result },
        metadata: result.context.routeTree[0]?.children[0]?.metadata,
        property: result.context.blocks[0]?.properties.value,
        default: result.context.blocks[0]?.properties.value,
      }
      const actual = values[context]

      expect(actual).toStrictEqual({ result: 'YES' })
    })

    it.each([true, false])('should transform only the chosen branches when the flag is %s', async flag => {
      // Arrange
      const selected = vi.fn(async () => 'selected')
      const unused = vi.fn(async () => {
        throw new Error('Unselected branch evaluated')
      })
      const Selected = generator('SelectedBranch', { factory: () => selected })
      const Unused = generator('UnusedBranch', { factory: () => unused })
      const predicate = Data('flag').match(GeneralConditions.Equals(true))
      const client = createClient(
        evaluationJourney('branch-pipelines', {
          conditional: when(predicate)
            .then(flag ? Selected() : Unused())
            .else(flag ? Unused() : Selected())
            .pipe(StringTransformers.ToUpperCase()),
          objectForm: Conditional({
            when: predicate,
            then: flag ? Selected() : Unused(),
            else: flag ? Unused() : Selected(),
          })
            .pipe(StringTransformers.ToUpperCase()),
          matched: match(Data('flag'))
            .case(flag, Selected())
            .case(flag, Unused())
            .otherwise(Unused())
            .pipe(StringTransformers.ToUpperCase()),
          otherwise: match(Data('flag')).case(!flag, Unused()).otherwise(Selected()).pipe(StringTransformers.ToUpperCase()),
        }),
      )

      // Act
      const result = await client.get('/branch-pipelines/result', { session: { data: { flag } } })

      // Assert
      expect(result.type).toBe('render')
      expect(selected).toHaveBeenCalledTimes(4)
      expect(unused).not.toHaveBeenCalled()
      if (result.type === 'render') {
        expect(result.context.data).toMatchObject({
          conditional: 'SELECTED',
          objectForm: 'SELECTED',
          matched: 'SELECTED',
          otherwise: 'SELECTED',
        })
      }
    })
  })

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
