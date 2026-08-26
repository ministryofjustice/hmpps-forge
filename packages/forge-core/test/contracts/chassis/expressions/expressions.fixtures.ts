import { z } from 'zod'

import {
  journey,
  step,
  access,
  submit,
  redirect,
  condition,
  transformer,
  generator,
  effect,
  and,
  or,
  xor,
  not,
  when,
  Conditional,
  Answer,
  Data,
  Format,
  Literal,
  Item,
  Loop,
  Iterator,
  match,
  Condition,
  Transformer,
} from '../../../../src/authoring'
import type { ResolvableValue } from '../../../../src/authoring/types/expressions.type'
import { Effects, type ContractSession } from '../../contractHelpers'
import { StaticText } from '../../testComponents'

export interface ExpressionsSession extends ContractSession {
  /** What the probe effect saw as the condition subject: 'null' or a typeof. */
  subjectProbe?: string
}

export const ExpressionConditions = {
  /** A schema-backed custom condition: only strings reach the evaluator. */
  IsYes: condition('Expressions.IsYes', {
    inputSchema: z.string(),
    factory: () => (value: string) => value === 'yes',
  }),

  /** A schemaless custom condition that would accept `null` if it ever saw it. */
  HasContent: condition('Expressions.HasContent', {
    factory: () => (value: unknown) => String(value).length > 0,
  }),
}

const ExpressionTransformers = {
  /** Appends a suffix, making transformer application and ordering observable. */
  Append: transformer('Expressions.Append', {
    inputSchema: z.string(),
    argumentsSchema: z.tuple([z.string()]),
    factory: () => (value: string, suffix: string) => value + suffix,
  }),

  /** Declares an outputSchema its numeric result satisfies. */
  Measure: transformer('Expressions.Measure', {
    inputSchema: z.string(),
    outputSchema: z.number(),
    factory: () => (value: string) => value.length,
  }),

  /** Declares a string outputSchema its numeric result always fails. */
  MeasureBroken: transformer('Expressions.MeasureBroken', {
    inputSchema: z.string(),
    outputSchema: z.string(),
    factory: () => (value: string) => value.length,
  }),
}

export const AsyncExpressionConditions = {
  /** An async schema-backed condition, compiled down the awaited call path. */
  IsYesAsync: condition('Expressions.IsYesAsync', {
    inputSchema: z.string(),
    factory: () => async (value: string) => value === 'yes',
  }),
}

export const AsyncExpressionTransformers = {
  /** An async Append, making awaited transformer ordering observable. */
  AppendAsync: transformer('Expressions.AppendAsync', {
    inputSchema: z.string(),
    argumentsSchema: z.tuple([z.string()]),
    factory: () => async (value: string, suffix: string) => value + suffix,
  }),
}

/** A generator whose only config argument must be a number. */
const Badge = generator('Expressions.Badge', {
  argumentsSchema: z.tuple([z.number()]),
  factory: () => (count: number) => `#${count}`,
})

const SetData = effect('Expressions.SetData', {
  factory: () => (context, key: string, value: unknown) => {
    context.setData(key, value)
  },
})

const CaptureSubject = effect('Expressions.CaptureSubject', {
  factory: () => (context, value: unknown) => {
    const session = context.getSession() as ExpressionsSession | undefined

    if (session) {
      session.subjectProbe = value === null ? 'null' : typeof value
    }
  },
})

/**
 * A journey whose only job is to evaluate expressions: an access hook loads
 * session data, then stores each expression's result under its key, so rows
 * observe expression results through the render context's `data` verdict.
 */
function evaluationJourney(code: string, evaluations: Record<string, ResolvableValue>) {
  return journey({
    code,
    path: `/${code}`,
    title: code,
    onAccess: [
      access({
        effects: [
          Effects.LoadData(),
          ...Object.entries(evaluations).map(([key, expression]) => SetData(key, expression)),
        ],
      }),
    ],
    steps: [
      step({
        path: '/result',
        title: 'Result',
        reachability: { entryWhen: true },
        blocks: [StaticText({ text: 'Result' })],
      }),
    ],
  })
}

export const generatorJourney = evaluationJourney('generators', {
  absentReplacement: Format('Value: %1', Data('missing')),
  pipedGenerator: Format('%1 day', Data('from')).pipe(Transformer.String.ToUpperCase()),
})

export const pipelineJourney = evaluationJourney('pipelines', {
  ordered: Literal('a').pipe(ExpressionTransformers.Append('b'), ExpressionTransformers.Append('c')),
  overUndefined: Data('missing').pipe(ExpressionTransformers.Append('!')),
  overNull: Data('nullValue').pipe(ExpressionTransformers.Append('!')),
})

export const matchFallbackJourney = evaluationJourney('match-fallback', {
  outcome: match(Data('status')).branch(Condition.Equals('open'), 'Open').otherwise('Fallback'),
  withoutOtherwise: match(Data('status')).branch(Condition.Equals('open'), 'Open'),
})

export const iteratorJourney = evaluationJourney('iterators', {
  identityMap: Data('items').each(Iterator.Map(Loop.Item())),
  namesFromMixed: Data('people').each(Iterator.Map(Loop.Item().path('name'))),
  namesCompacted: Data('people')
    .each(Iterator.Map(Loop.Item().path('name')))
    .pipe(Transformer.Array.Compact()),
  filtered: Data('items').each(Iterator.Filter(Loop.Item().value().not.match(Condition.Equals('drop')))),
  compacted: Data('items').each(Iterator.Map(Loop.Item())).pipe(Transformer.Array.Compact()),
  positions: Data('letters').each(Iterator.Map(Format('%1:%2:%3', Loop.Index(), Loop.Index0(), Loop.Item().value()))),
  reversePositions: Data('letters').each(Iterator.Map(Format('%1:%2', Loop.RevIndex(), Loop.RevIndex0()))),
  boundaries: Data('letters').each(Iterator.Map({ first: Loop.First(), last: Loop.Last() })),
  sizes: Data('letters').each(Iterator.Map(Loop.Length())),
})

export const iteratorKindsJourney = evaluationJourney('iterator-kinds', {
  found: Data('people').each(Iterator.Find(Loop.Item().path('name').match(Condition.Equals('Grace')))),
  notFound: Data('people').each(Iterator.Find(Loop.Item().path('name').match(Condition.Equals('Alan')))),
  chained: Data('people')
    .each(Iterator.Filter(Loop.Item().path('active').match(Condition.Equals(true))))
    .each(Iterator.Map(Loop.Item().path('name'))),
  bareItemNames: Data('people').each(Iterator.Map(Item().path('name'))),
})

export const objectIterationJourney = evaluationJourney('object-iteration', {
  entries: Data('scores').each(Iterator.Map({ slug: Loop.Item().key(), score: Loop.Item().path('score') })),
  filteredEntries: Data('scores').each(
    Iterator.Filter(Loop.Item().path('score').match(Condition.Number.GreaterThan(3))),
  ),
})

export const nestedIterationJourney = evaluationJourney('nested-iteration', {
  teamMembers: Data('teams').each(
    Iterator.Map(
      Loop.Item()
        .path('members')
        .each(Iterator.Map(Format('%1>%2', Loop.Parent.Item().path('name'), Loop.Item().path('name')))),
    ),
  ),
})

export const conditionalJourney = evaluationJourney('conditionals', {
  bareWhen: when(Data('flag').match(Condition.Equals(true))),
  fluent: when(Data('flag').match(Condition.Equals(true)))
    .then('yes')
    .else('no'),
  objectForm: Conditional({
    when: Data('flag').match(Condition.Equals(true)),
    then: Data('greeting'),
    else: 'fallback',
  }),
  withoutElse: Conditional({ when: Data('flag').match(Condition.Equals(true)), then: 'only-then' }),
  nested: Conditional({
    when: Data('tier').match(Condition.Equals('premium')),
    then: 'Premium',
    else: Conditional({
      when: Data('tier').match(Condition.Equals('standard')),
      then: 'Standard',
      else: 'Basic',
    }),
  }),
})

export const combinatorJourney = evaluationJourney('combinators', {
  xorResult: when(xor(Data('a').match(Condition.Equals(true)), Data('b').match(Condition.Equals(true))))
    .then('one')
    .else('both-or-neither'),
  notResult: when(not(Data('a').match(Condition.Equals(true)))).then('negated').else('straight'),
  branchAnd: match(Data('word'))
    .branch(and(Condition.String.HasMinLength(3), Condition.String.HasMaxLength(5)), 'mid')
    .otherwise('out'),
  branchOr: match(Data('word'))
    .branch(or(Condition.Equals('start'), Condition.Equals('stop')), 'either')
    .otherwise('neither'),
  branchNot: match(Data('word')).branch(not(Condition.Equals('stop')), 'go').otherwise('halt'),
})

/**
 * Submits against conditions a null subject would satisfy if it ever reached
 * their evaluators, capturing what the subject actually was via an effect so
 * the null-versus-unanswered distinction is observable.
 */
export const nullSubjectJourney = journey({
  code: 'null-subject',
  path: '/null-subject',
  title: 'Null subject',
  onAccess: [access({ effects: [Effects.LoadAnswers('null-subject')] })],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            effects: [CaptureSubject(Answer('legacy'))],
            next: [
              redirect({
                when: or(
                  Answer('legacy').match(ExpressionConditions.HasContent()),
                  Answer('legacy').match(Condition.Equals(null)),
                ),
                goto: 'matched',
              }),
              redirect({ goto: 'unmatched' }),
            ],
          },
        }),
      ],
    }),
    step({ code: 'matched', path: '/matched', title: 'Matched', blocks: [] }),
    step({ code: 'unmatched', path: '/unmatched', title: 'Unmatched', blocks: [] }),
  ],
})

/** Evaluates a condition whose config argument comes from request data. */
export const conditionArgumentErrorJourney = journey({
  code: 'condition-arguments',
  path: '/condition-arguments',
  title: 'Condition arguments',
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      path: '/guarded',
      title: 'Guarded',
      reachability: { entryWhen: true },
      blocks: [],
      onSubmission: [
        submit({
          validate: false,
          onAlways: {
            next: [
              redirect({ when: Data('amount').match(Condition.Number.GreaterThan(Data('limit'))), goto: 'passed' }),
              redirect({ goto: 'failed' }),
            ],
          },
        }),
      ],
    }),
    step({ code: 'passed', path: '/passed', title: 'Passed', blocks: [] }),
    step({ code: 'failed', path: '/failed', title: 'Failed', blocks: [] }),
  ],
})

/** Pipes a number into a string transformer, so its inputSchema rejects the value. */
export const transformerSchemaErrorJourney = evaluationJourney('transformer-errors', {
  broken: Literal(42).pipe(Transformer.String.Trim()),
})

export const outputSchemaJourney = evaluationJourney('output-schemas', {
  measured: Literal('abc').pipe(ExpressionTransformers.Measure()),
})

/** Pipes through a transformer whose result always fails its outputSchema. */
export const outputSchemaErrorJourney = evaluationJourney('output-schema-errors', {
  broken: Literal('abc').pipe(ExpressionTransformers.MeasureBroken()),
})

export const asyncIteratorJourney = evaluationJourney('async-iterators', {
  filtered: Data('answers').each(Iterator.Filter(Loop.Item().value().match(AsyncExpressionConditions.IsYesAsync()))),
  found: Data('answers').each(Iterator.Find(Loop.Item().value().match(AsyncExpressionConditions.IsYesAsync()))),
  mapped: Data('letters').each(
    Iterator.Map(Format('%1', Loop.Item().value()).pipe(AsyncExpressionTransformers.AppendAsync('!'))),
  ),
})

export const asyncPipelineJourney = evaluationJourney('async-pipelines', {
  ordered: Literal('a').pipe(
    AsyncExpressionTransformers.AppendAsync('b'),
    AsyncExpressionTransformers.AppendAsync('c'),
  ),
})

/** Feeds an absent value into a generator's number-only config argument. */
export const generatorArgumentErrorJourney = evaluationJourney('generator-arguments', {
  badge: Badge(Data('missing')),
})

export const iteratorBudgetJourney = evaluationJourney('iterator-budget', {
  mapped: Data('items').each(Iterator.Map(Loop.Item())),
})

/** Two chained stages that each stay under the budget but together exceed it. */
export const chainedIteratorBudgetJourney = evaluationJourney('iterator-budget-chained', {
  chained: Data('items').each(Iterator.Map(Loop.Item())).each(Iterator.Map(Loop.Item())),
})
