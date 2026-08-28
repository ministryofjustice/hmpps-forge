// Reference entry points - the vocabulary for reading request, session, and answer data
export { Post, Params, Query, Request, Data, Session, Answer, Item, Loop, Self } from './references'

// Structure entry points - blocks, fields, steps, journeys, and packages
export { block, field, step, journey, createForgePackage } from './structures'

// Hook and outcome entry points - lifecycle hooks, validation, and outcomes
export { submit, access, validation, tieBreaker, redirect, throwError } from './hooks'

// Value entry points - formatting and literal wrapping
export { Format, Literal } from './values'

// Conditional and match expressions
export { when, Conditional } from './ConditionalExprBuilder'
export { match } from './MatchExprBuilder'

// Predicate combinators
export { and, or, xor, not } from './combinators'

// Iterator namespace for .each() configuration
export { Iterator } from './iterators'

// Chainable interfaces - the return-type vocabulary of the fluent API.
// Use these as return types for helpers that continue a chain;
// component props should accept Resolvable* types instead.
export type {
  BranchValue,
  ChainableConditional,
  ChainableExpr,
  ChainableExpression,
  ChainableGenerator,
  ChainableIterable,
  ChainableLoopItemRef,
  ChainableLoopRef,
  ChainableMatch,
  ChainableNegation,
  ChainableRef,
  ChainableScopedRef,
  ChainableValue,
} from './types'
