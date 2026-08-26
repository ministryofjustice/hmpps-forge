import { submit, redirect, Answer, Condition, Transformer, and, or } from '../../../../src/authoring'
import type { PredicateExpr } from '../../../../src/authoring/types/expressions.type'
import type { StepContractCase, JourneyContractCase } from '../../contractRunner'
import type { StepScaffoldOptions } from '../../stepScaffold'
import { TextField } from '../../testComponents'
import {
  ExpressionConditions,
  AsyncExpressionConditions,
  generatorJourney,
  outputSchemaJourney,
  asyncIteratorJourney,
  asyncPipelineJourney,
  conditionalJourney,
  combinatorJourney,
  pipelineJourney,
  matchFallbackJourney,
  iteratorJourney,
  iteratorKindsJourney,
  objectIterationJourney,
  nestedIterationJourney,
} from './expressions.fixtures'

/** A scaffold whose submission redirects to `done` when the predicate holds, `invalid` otherwise. */
function predicateStep(when: PredicateExpr, blocks: StepScaffoldOptions['blocks'] = []): StepScaffoldOptions {
  return {
    blocks,
    onSubmission: [
      submit({
        validate: false,
        onAlways: { next: [redirect({ when, goto: 'done' }), redirect({ goto: 'invalid' })] },
      }),
    ],
  }
}

const INVALID_PATH = '/scaffold/invalid'

export const stepCases: StepContractCase[] = [
  {
    description: 'condition application',
    step: predicateStep(Answer('choice').match(ExpressionConditions.IsYes()), [TextField({ code: 'choice' })]),
    tests: [
      {
        name: 'should apply a custom condition to the matched subject when it is answered',
        post: { choice: 'yes' },
        valid: true,
      },
      {
        name: 'should treat the condition as false when the subject is unanswered',
        post: {},
        redirectTo: INVALID_PATH,
      },
    ],
  },
  {
    description: 'schemaless custom conditions',
    step: predicateStep(Answer('legacy').match(ExpressionConditions.HasContent())),
    tests: [
      {
        name: 'should evaluate a schemaless condition when the subject is a stored value',
        post: {},
        session: { answers: { legacy: 'text' } },
        valid: true,
      },
    ],
  },
  {
    description: 'defined falsy subjects',
    step: predicateStep(Answer('note').match(Condition.Equals(''))),
    tests: [
      {
        name: 'should evaluate the condition when the subject is an empty string rather than short-circuiting',
        post: {},
        session: { answers: { note: '' } },
        valid: true,
      },
    ],
  },
  {
    description: 'negated matches',
    step: predicateStep(Answer('choice').not.match(Condition.Equals('a')), [TextField({ code: 'choice' })]),
    tests: [
      {
        name: 'should invert the condition verdict when .not precedes match',
        post: { choice: 'b' },
        valid: true,
      },
      {
        name: 'should treat a negated condition as true when the subject is unanswered',
        post: {},
        valid: true,
      },
    ],
  },
  {
    description: 'inputSchema soft failure',
    step: predicateStep(Answer('amount').match(Condition.Number.GreaterThan(5))),
    tests: [
      {
        name: 'should evaluate the condition when the subject satisfies its inputSchema',
        post: {},
        session: { answers: { amount: 9 } },
        valid: true,
      },
      {
        name: 'should treat the condition as false when a defined subject fails its inputSchema',
        post: {},
        session: { answers: { amount: 'nine' } },
        redirectTo: INVALID_PATH,
      },
    ],
  },
  {
    description: 'predicate combinators',
    step: predicateStep(
      or(
        and(Answer('first').match(Condition.Equals('x')), Answer('second').match(Condition.Equals('y'))),
        Answer('override').match(Condition.Equals('on')),
      ),
    ),
    tests: [
      {
        name: 'should fail and() when one operand subject is absent',
        post: {},
        session: { answers: { first: 'x' } },
        redirectTo: INVALID_PATH,
      },
      {
        name: 'should pass or() when one operand holds and the other operand subjects are absent',
        post: {},
        session: { answers: { override: 'on' } },
        valid: true,
      },
    ],
  },
  {
    description: 'async conditions',
    step: predicateStep(Answer('choice').match(AsyncExpressionConditions.IsYesAsync()), [
      TextField({ code: 'choice' }),
    ]),
    tests: [
      {
        name: 'should evaluate an async custom condition when the subject is answered',
        post: { choice: 'yes' },
        valid: true,
      },
      {
        name: 'should treat an async condition as false when the subject is unanswered',
        post: {},
        redirectTo: INVALID_PATH,
      },
    ],
  },
  {
    description: 'async condition inputSchema soft failure',
    step: predicateStep(Answer('amount').match(AsyncExpressionConditions.IsYesAsync())),
    tests: [
      {
        name: 'should treat the condition as false when a defined subject fails an async condition inputSchema',
        post: {},
        session: { answers: { amount: 42 } },
        redirectTo: INVALID_PATH,
      },
    ],
  },
  {
    description: 'pipe chains into match',
    step: predicateStep(Answer('raw').pipe(Transformer.String.Trim()).match(Condition.Equals('yes')), [
      TextField({ code: 'raw' }),
    ]),
    tests: [
      {
        name: 'should match against the transformed value when a pipe chain feeds the condition',
        post: { raw: '  yes  ' },
        valid: true,
      },
    ],
  },
]

export const journeyCases: JourneyContractCase[] = [
  {
    description: 'generators',
    journey: generatorJourney,
    tests: [
      {
        name: 'should substitute an absent replacement with an empty string',
        path: '/generators/result',
        session: { data: {} },
        data: { absentReplacement: 'Value: ' },
      },
      {
        name: 'should pipe a generator result through transformers',
        path: '/generators/result',
        session: { data: { from: 'Mon' } },
        data: { pipedGenerator: 'MON DAY' },
      },
    ],
  },
  {
    description: 'conditional values',
    journey: conditionalJourney,
    tests: [
      {
        name: 'should take the then branch when the when predicate is true',
        path: '/conditionals/result',
        session: { data: { flag: true, greeting: 'hello', tier: 'premium' } },
        data: { bareWhen: true, fluent: 'yes', objectForm: 'hello', withoutElse: 'only-then', nested: 'Premium' },
      },
      {
        name: 'should take the else branch when the when predicate is false',
        path: '/conditionals/result',
        session: { data: { flag: false, tier: 'standard' } },
        data: { bareWhen: false, fluent: 'no', objectForm: 'fallback', nested: 'Standard' },
      },
      {
        name: 'should resolve Conditional without else to false when the predicate is false',
        path: '/conditionals/result',
        session: { data: { flag: false } },
        data: { withoutElse: false },
      },
      {
        name: 'should fall through nested conditionals to the innermost else',
        path: '/conditionals/result',
        session: { data: { tier: 'basic' } },
        data: { nested: 'Basic' },
      },
    ],
  },
  {
    description: 'value combinators',
    journey: combinatorJourney,
    tests: [
      {
        name: 'should pass xor when exactly one operand predicate is true',
        path: '/combinators/result',
        session: { data: { a: true, b: false } },
        data: { xorResult: 'one' },
      },
      {
        name: 'should fail xor when both operand predicates are true',
        path: '/combinators/result',
        session: { data: { a: true, b: true } },
        data: { xorResult: 'both-or-neither' },
      },
      {
        name: 'should invert with standalone not when the predicate is false',
        path: '/combinators/result',
        session: { data: { a: false } },
        data: { notResult: 'negated' },
      },
      {
        name: 'should match an and() branch only when every condition holds',
        path: '/combinators/result',
        session: { data: { word: 'four' } },
        data: { branchAnd: 'mid' },
      },
      {
        name: 'should fall to otherwise when one condition of an and() branch fails',
        path: '/combinators/result',
        session: { data: { word: 'toolongword' } },
        data: { branchAnd: 'out' },
      },
      {
        name: 'should match an or() branch when one condition holds',
        path: '/combinators/result',
        session: { data: { word: 'stop' } },
        data: { branchOr: 'either', branchNot: 'halt' },
      },
      {
        name: 'should match a not() branch when the negated condition fails',
        path: '/combinators/result',
        session: { data: { word: 'other' } },
        data: { branchNot: 'go', branchOr: 'neither' },
      },
    ],
  },
  {
    description: 'output schemas',
    journey: outputSchemaJourney,
    tests: [
      {
        name: 'should return the function result unchanged when it passes its outputSchema',
        path: '/output-schemas/result',
        session: { data: {} },
        data: { measured: 3 },
      },
    ],
  },
  {
    description: 'async pipe chains',
    journey: asyncPipelineJourney,
    tests: [
      {
        name: 'should apply async transformers in authored order in a pipe chain',
        path: '/async-pipelines/result',
        session: { data: {} },
        data: { ordered: 'abc' },
      },
    ],
  },
  {
    description: 'async iterators',
    journey: asyncIteratorJourney,
    tests: [
      {
        name: 'should await an async condition per item in a Filter predicate',
        path: '/async-iterators/result',
        session: { data: { answers: ['yes', 'no', 'yes'] } },
        data: { filtered: ['yes', 'yes'] },
      },
      {
        name: 'should await an async condition per item in a Find predicate',
        path: '/async-iterators/result',
        session: { data: { answers: ['no', 'yes', 'no'] } },
        data: { found: 'yes' },
      },
      {
        name: 'should await an async transformer piped inside a Map yield per item',
        path: '/async-iterators/result',
        session: { data: { letters: ['a', 'b'] } },
        data: { mapped: ['a!', 'b!'] },
      },
    ],
  },
  {
    description: 'pipe chains',
    journey: pipelineJourney,
    tests: [
      {
        name: 'should apply pipeline steps in authored order',
        path: '/pipelines/result',
        session: { data: {} },
        data: { ordered: 'abc' },
      },
      // The Append transformer would produce 'undefined!' if it ever ran, so
      // an undefined result proves the step was skipped entirely.
      {
        name: 'should yield undefined without running transformers when the pipe input is undefined',
        path: '/pipelines/result',
        session: { data: {} },
        data: { overUndefined: undefined },
      },
      {
        name: 'should yield undefined when the pipe input is null',
        path: '/pipelines/result',
        session: { data: { nullValue: null } },
        data: { overNull: undefined },
      },
    ],
  },
  {
    description: 'match expressions',
    journey: matchFallbackJourney,
    tests: [
      {
        name: 'should take the first branch whose condition matches the subject',
        path: '/match-fallback/result',
        session: { data: { status: 'open' } },
        data: { outcome: 'Open' },
      },
      {
        name: 'should fall through to otherwise when the subject is absent',
        path: '/match-fallback/result',
        session: { data: {} },
        data: { outcome: 'Fallback' },
      },
      {
        name: 'should yield undefined when no branch matches and there is no otherwise',
        path: '/match-fallback/result',
        session: { data: { status: 'closed' } },
        data: { withoutOtherwise: undefined },
      },
    ],
  },
  {
    description: 'iterators',
    journey: iteratorJourney,
    tests: [
      {
        name: 'should keep null items when mapping a collection',
        path: '/iterators/result',
        session: { data: { items: [1, null, 2] } },
        data: { identityMap: [1, null, 2] },
      },
      // TODO: Probably should decide whether map dropping undefined yields is
      // still wanted now that null items are kept — the keep-null-items change
      // removed the null skip from the loop, but compileMapIterator still only
      // pushes yields !== undefined, so a .path() yield over a null item
      // vanishes while an identity yield keeps the null. If dropping stays,
      // these two rows are the contract; if not, update them together.
      {
        name: 'should omit an item from map output when its yield resolves undefined',
        path: '/iterators/result',
        session: { data: { people: [{ name: 'Ada' }, {}, { name: 'Grace' }] } },
        data: { namesFromMixed: ['Ada', 'Grace'] },
      },
      {
        name: 'should present null items to the filter predicate and keep those that pass',
        path: '/iterators/result',
        session: { data: { items: ['keep', null, 'drop'] } },
        data: { filtered: ['keep', null] },
      },
      {
        name: 'should remove null items when the mapped collection is piped through Array.Compact',
        path: '/iterators/result',
        session: { data: { items: [1, null, 2] } },
        data: { compacted: [1, 2] },
      },
      {
        name: 'should expose a 1-based Index and a 0-based Index0 during iteration',
        path: '/iterators/result',
        session: { data: { letters: ['a', 'b'] } },
        data: { positions: ['1:0:a', '2:1:b'] },
      },
      {
        name: 'should expose RevIndex and RevIndex0 counting down from the collection length',
        path: '/iterators/result',
        session: { data: { letters: ['a', 'b', 'c'] } },
        data: { reversePositions: ['3:2', '2:1', '1:0'] },
      },
      {
        name: 'should mark First on only the first item and Last on only the final item',
        path: '/iterators/result',
        session: { data: { letters: ['a', 'b', 'c'] } },
        data: {
          boundaries: [
            { first: true, last: false },
            { first: false, last: false },
            { first: false, last: true },
          ],
        },
      },
      {
        name: 'should expose the collection size via Loop.Length during iteration',
        path: '/iterators/result',
        session: { data: { letters: ['a', 'b', 'c'] } },
        data: { sizes: [3, 3, 3] },
      },
    ],
  },
  {
    description: 'non-collection iterator inputs',
    journey: iteratorJourney,
    tests: [
      {
        name: 'should yield an empty array when a Map iterator input is absent',
        path: '/iterators/result',
        session: { data: {} },
        data: { identityMap: [] },
      },
      {
        name: 'should yield an empty array when a Filter iterator input is a scalar',
        path: '/iterators/result',
        session: { data: { items: 'not-a-collection' } },
        data: { filtered: [] },
      },
    ],
  },
  {
    description: 'iterator kinds',
    journey: iteratorKindsJourney,
    tests: [
      {
        name: 'should return the first item whose Find predicate matches',
        path: '/iterator-kinds/result',
        session: { data: { people: [{ name: 'Ada' }, { name: 'Grace' }, { name: 'Grace Hopper' }] } },
        data: { found: { name: 'Grace' } },
      },
      {
        name: 'should resolve Find to undefined when no item matches',
        path: '/iterator-kinds/result',
        session: { data: { people: [{ name: 'Ada' }] } },
        data: { notFound: undefined },
      },
      {
        name: 'should resolve Find to undefined when its input is absent',
        path: '/iterator-kinds/result',
        session: { data: {} },
        data: { found: undefined },
      },
      {
        name: 'should feed one iterator stage into the next when each() calls chain',
        path: '/iterator-kinds/result',
        session: {
          data: {
            people: [
              { name: 'Ada', active: true },
              { name: 'Grace', active: false },
              { name: 'Alan', active: true },
            ],
          },
        },
        data: { chained: ['Ada', 'Alan'] },
      },
      {
        name: 'should resolve a bare Item() reference inside an iterator',
        path: '/iterator-kinds/result',
        session: { data: { people: [{ name: 'Ada' }, { name: 'Grace' }] } },
        data: { bareItemNames: ['Ada', 'Grace'] },
      },
    ],
  },
  {
    description: 'object iteration',
    journey: objectIterationJourney,
    tests: [
      {
        name: 'should iterate object inputs as entries exposing the value as the item and the key via key()',
        path: '/object-iteration/result',
        session: { data: { scores: { accommodation: { score: 5 }, finances: { score: 3 } } } },
        data: {
          entries: [
            { slug: 'accommodation', score: 5 },
            { slug: 'finances', score: 3 },
          ],
        },
      },
      {
        name: 'should return key-value tuples when filtering an object input',
        path: '/object-iteration/result',
        session: { data: { scores: { accommodation: { score: 5 }, finances: { score: 3 } } } },
        data: { filteredEntries: [['accommodation', { score: 5 }]] },
      },
    ],
  },
  {
    description: 'nested iteration',
    journey: nestedIterationJourney,
    tests: [
      {
        name: 'should read the parent loop item with Loop.Parent.Item() in nested iterators',
        path: '/nested-iteration/result',
        session: {
          data: {
            teams: [
              { name: 'Alpha', members: [{ name: 'Ada' }, { name: 'Grace' }] },
              { name: 'Beta', members: [{ name: 'Linus' }] },
            ],
          },
        },
        data: {
          teamMembers: [['Alpha>Ada', 'Alpha>Grace'], ['Beta>Linus']],
        },
      },
    ],
  },
]
