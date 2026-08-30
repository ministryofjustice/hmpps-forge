import { z } from 'zod'

import {
  journey,
  step,
  access,
  submit,
  redirect,
  and,
  or,
  xor,
  not,
  when,
  Conditional,
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
import {
  ContractConditions,
  ContractEffects,
  ContractGenerators,
  ContractTransformers,
  Effects,
} from '../../contractHelpers'
import { StaticText } from '../../testComponents'

export const ExpressionConditions = {
  /** A schema-backed custom condition: only strings reach the evaluator. */
  IsYes: ContractConditions.register('Expressions.IsYes', {
    inputSchema: z.string(),
    factory: () => (value: string) => value === 'yes',
  }),

  /** A schemaless custom condition that would accept `null` if it ever saw it. */
  HasContent: ContractConditions.register('Expressions.HasContent', {
    factory: () => (value: unknown) => String(value).length > 0,
  }),
}

const ExpressionTransformers = {
  /** Appends a suffix, making transformer application and ordering observable. */
  Append: ContractTransformers.register('Expressions.Append', {
    inputSchema: z.string(),
    argumentsSchema: z.tuple([z.string()]),
    factory: () => (value: string, suffix: string) => value + suffix,
  }),

  /** Declares an outputSchema its numeric result satisfies. */
  Measure: ContractTransformers.register('Expressions.Measure', {
    inputSchema: z.string(),
    outputSchema: z.number(),
    factory: () => (value: string) => value.length,
  }),

  /** Declares a string outputSchema its numeric result always fails. */
  MeasureBroken: ContractTransformers.register('Expressions.MeasureBroken', {
    inputSchema: z.string(),
    outputSchema: z.string(),
    factory: () => (value: string) => value.length,
  }),
}

export const AsyncExpressionConditions = {
  /** An async schema-backed condition, compiled down the awaited call path. */
  IsYesAsync: ContractConditions.register('Expressions.IsYesAsync', {
    inputSchema: z.string(),
    factory: () => async (value: string) => value === 'yes',
  }),
}

export const AsyncExpressionTransformers = {
  /** An async Append, making awaited transformer ordering observable. */
  AppendAsync: ContractTransformers.register('Expressions.AppendAsync', {
    inputSchema: z.string(),
    argumentsSchema: z.tuple([z.string()]),
    factory: () => async (value: string, suffix: string) => value + suffix,
  }),
}

/** A generator whose only config argument must be a number. */
const Badge = ContractGenerators.register('Expressions.Badge', {
  argumentsSchema: z.tuple([z.number()]),
  factory: () => (count: number) => `#${count}`,
})

const SetData = ContractEffects.register('Expressions.SetData', {
  factory: () => (context, key: string, value: unknown) => {
    context.setData(key, value)
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
})

export const matchFallbackJourney = evaluationJourney('match-fallback', {
  outcome: match(Data('status')).branch(Condition.Equals('open'), 'Open').otherwise('Fallback'),
  withoutOtherwise: match(Data('status')).branch(Condition.Equals('open'), 'Open'),
})

export const iteratorJourney = evaluationJourney('iterators', {
  identityMap: Data('items').each(Iterator.Map(Item().value())),
  namesFromMixed: Data('people').each(Iterator.Map(Item().path('name'))),
  filtered: Data('items').each(Iterator.Filter(Item().value().not.match(Condition.Equals('drop')))),
  positions: Data('letters').each(Iterator.Map(Format('%1:%2:%3', Loop.Index(), Loop.Index0(), Item().value()))),
  reversePositions: Data('letters').each(Iterator.Map(Format('%1:%2', Loop.RevIndex(), Loop.RevIndex0()))),
  boundaries: Data('letters').each(Iterator.Map({ first: Loop.First(), last: Loop.Last() })),
  sizes: Data('letters').each(Iterator.Map(Loop.Length())),
})

export const iteratorKindsJourney = evaluationJourney('iterator-kinds', {
  found: Data('people').each(Iterator.Find(Item().path('name').match(Condition.Equals('Grace')))),
  notFound: Data('people').each(Iterator.Find(Item().path('name').match(Condition.Equals('Alan')))),
  chained: Data('people')
    .each(Iterator.Filter(Item().path('active').match(Condition.Equals(true))))
    .each(Iterator.Map(Item().path('name'))),
  bareItemNames: Data('people').each(Iterator.Map(Item().path('name'))),
})

export const objectIterationJourney = evaluationJourney('object-iteration', {
  entries: Data('scores').each(Iterator.Map({ slug: Item().key(), score: Item().path('score') })),
  filteredEntries: Data('scores').each(Iterator.Filter(Item().path('score').match(Condition.Number.GreaterThan(3)))),
})

export const nestedIterationJourney = evaluationJourney('nested-iteration', {
  teamMembers: Data('teams').each(
    Iterator.Map(
      Item()
        .path('members')
        .each(Iterator.Map(Format('%1>%2', Item().parent.path('name'), Item().path('name')))),
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
  filtered: Data('answers').each(Iterator.Filter(Item().value().match(AsyncExpressionConditions.IsYesAsync()))),
  found: Data('answers').each(Iterator.Find(Item().value().match(AsyncExpressionConditions.IsYesAsync()))),
  mapped: Data('letters').each(
    Iterator.Map(Format('%1', Item().value()).pipe(AsyncExpressionTransformers.AppendAsync('!'))),
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
  mapped: Data('items').each(Iterator.Map(Item().value())),
})

/** Two chained stages that each stay under the budget but together exceed it. */
export const chainedIteratorBudgetJourney = evaluationJourney('iterator-budget-chained', {
  chained: Data('items').each(Iterator.Map(Item().value())).each(Iterator.Map(Item().value())),
})
