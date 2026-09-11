import { describe, expect, it, vi } from 'vitest'
import { GeneralConditions } from '../../../../src/built-ins/functions/conditions/generalConditions'
import { when } from '../../../../src/authoring/builders/ConditionalExprBuilder'
import { and, or } from '../../../../src/authoring/builders/combinators'
import { StringTransformers } from '../../../../src/built-ins/functions/transformers/stringTransformers'
import { journey, step } from '../../../../src/authoring/builders/structures'
import { access } from '../../../../src/authoring/builders/hooks'
import { Data, Item } from '../../../../src/authoring/builders/references'
import { match } from '../../../../src/authoring/builders/MatchExprBuilder'
import { Iterator } from '../../../../src/authoring/builders/iterators'
import { generator } from '../../../../src/authoring/functions/generator'
import { effect } from '../../../../src/authoring/functions/effect'
import { component } from '../../../../src/components/presentation'
import { createClient, Effects } from '../../contractHelpers'

const Probe = component<{ value?: unknown }>('expressionProbe', { field: true, factory: () => () => '' })
const DefaultProbe = generator('DefaultProbe', { factory: () => (value: unknown) => value })
const Capture = effect('CaptureExpression', {
  factory: () => (context, value: unknown) => context.setData('captured', value),
})

describe('shared expression semantics', () => {
  it.each(['hook', 'property', 'default', 'metadata'] as const)(
    'should retain array and map entries when compiling a %s value',
    async context => {
      // Arrange
      const unused = vi.fn(() => {
        throw new Error('Unused expression ran')
      })
      const Unused = generator('UnusedSharedExpression', { factory: () => unused })
      const isYes = Item().value().match(GeneralConditions.Equals('yes'))
      const value = {
        array: ['first', Data('missing'), Data('alsoMissing'), 'last'],
        mapped: Data('items').each(Iterator.Map(Item().value())),
        matched: match(Data('choice')).case('yes', 'selected').otherwise(Unused()),
        mixed: match(Data('choice'))
          .case('no', Unused())
          .branch(GeneralConditions.Equals('yes'), 'selected')
          .otherwise(Unused()),
        absent: match(Data('missing')).case(Data('alsoMissing'), 'absent').otherwise(Unused()),
        conditional: when(Data('choice').match(GeneralConditions.Equals('yes')))
          .then('selected')
          .else(Unused()),
        nullish: Data('choice').nullish(Unused()),
        pipeline: Data('choice').pipe(StringTransformers.ToUpperCase()),
        logicalAnd: and(
          Data('choice').match(GeneralConditions.Equals('no')),
          Unused().match(GeneralConditions.Equals(true)),
        ),
        logicalOr: or(
          Data('choice').match(GeneralConditions.Equals('yes')),
          Unused().match(GeneralConditions.Equals(true)),
        ),
        filtered: Data('keyed').each(Iterator.Filter(isYes)),
        found: Data('keyed').each(Iterator.Find(isYes)),
        some: Data('keyed').each(Iterator.Some(isYes)),
        every: Data('keyed').each(Iterator.Every(isYes)),
        count: Data('keyed').each(Iterator.Count(isYes)),
        empty: {
          map: Data('empty').each(Iterator.Map(Unused())),
          some: Data('empty').each(Iterator.Some(isYes)),
          every: Data('empty').each(Iterator.Every(isYes)),
          count: Data('empty').each(Iterator.Count(isYes)),
        },
        nested: Data('groups').each(Iterator.Map(Item().value().each(Iterator.Map(Item().value())))),
      }
      const client = createClient(
        journey({
          code: 'unified',
          path: '/unified',
          title: 'Unified',
          onAccess: [access({ effects: [Effects.LoadData(), ...(context === 'hook' ? [Capture(value)] : [])] })],
          steps: [
            step({
              path: '/result',
              title: 'Result',
              reachability: { entryWhen: true },
              metadata: context === 'metadata' ? value : {},
              blocks: [
                Probe({
                  code: 'probe',
                  ...(context === 'property' ? { value } : {}),
                  ...(context === 'default' ? { defaultValue: DefaultProbe(value) } : {}),
                }),
              ],
            }),
          ],
        }),
      )

      // Act
      const result = await client.get('/unified/result', {
        session: {
          data: {
            items: [1, undefined, 3],
            choice: 'yes',
            keyed: { first: 'no', second: 'yes' },
            empty: [],
            groups: [[1, undefined], [3]],
          },
        },
      })

      // Assert
      expect(result.type).toBe('render')
      if (result.type !== 'render') {
        throw new Error('Expected render output')
      }

      const values = {
        hook: result.context.data.captured,
        metadata: result.context.routeTree[0]?.children[0]?.metadata,
        property: result.context.blocks[0]?.properties.value,
        default: result.context.blocks[0]?.properties.value,
      }
      const actual = values[context]
      expect(actual).toStrictEqual({
        array: ['first', undefined, undefined, 'last'],
        mapped: [1, undefined, 3],
        matched: 'selected',
        mixed: 'selected',
        absent: 'absent',
        conditional: 'selected',
        nullish: 'yes',
        pipeline: 'YES',
        logicalAnd: false,
        logicalOr: true,
        filtered: [['second', 'yes']],
        found: ['second', 'yes'],
        some: true,
        every: false,
        count: 1,
        empty: { map: [], some: false, every: true, count: 0 },
        nested: [[1, undefined], [3]],
      })
      expect(unused).not.toHaveBeenCalled()
    },
  )

  it('should evaluate the subject once when a component match selects a later case', async () => {
    // Arrange
    const subject = vi.fn(async () => 'second')
    const unused = vi.fn(() => {
      throw new Error('Unused branch ran')
    })
    const Subject = generator('SharedSubject', { factory: () => subject })
    const Unused = generator('SharedUnused', { factory: () => unused })
    const client = createClient(
      journey({
        code: 'lazy',
        path: '/lazy',
        title: 'Lazy',
        steps: [
          step({
            path: '/result',
            title: 'Result',
            reachability: { entryWhen: true },
            blocks: [
              Probe({
                code: 'probe',
                value: match(Subject()).case('first', Unused()).case('second', 'selected').otherwise(Unused()),
              }),
            ],
          }),
        ],
      }),
    )

    // Act
    const result = await client.get('/lazy/result', { session: {} })

    // Assert
    expect(result.type).toBe('render')
    if (result.type === 'render') {
      expect(result.context.blocks[0]?.properties.value).toBe('selected')
    }
    expect(subject).toHaveBeenCalledTimes(1)
    expect(unused).not.toHaveBeenCalled()
  })
})
