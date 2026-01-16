export enum FunctionType {
  CONDITION = 'FunctionType.Condition',
  TRANSFORMER = 'FunctionType.Transformer',
  GENERATOR = 'FunctionType.Generator',
  EFFECT = 'FunctionType.Effect',
}

export enum StructureType {
  BLOCK = 'StructureType.Block',
  JOURNEY = 'StructureType.Journey',
  STEP = 'StructureType.Step',
}

export enum BlockType {
  FIELD = 'BlockType.field',
  BASIC = 'BlockType.basic',
}

export enum ExpressionType {
  REFERENCE = 'ExpressionType.Reference',
  FORMAT = 'ExpressionType.Format',
  PIPELINE = 'ExpressionType.Pipeline',
  NEXT = 'ExpressionType.Next',
  VALIDATION = 'ExpressionType.Validation',
  ITERATE = 'ExpressionType.Iterate',
  CONDITIONAL = 'ExpressionType.Conditional',
}

export enum IteratorType {
  MAP = 'IteratorType.Map',
  FILTER = 'IteratorType.Filter',
  FIND = 'IteratorType.Find',
}

export enum PredicateType {
  TEST = 'PredicateType.Test',
  AND = 'PredicateType.And',
  OR = 'PredicateType.Or',
  XOR = 'PredicateType.Xor',
  NOT = 'PredicateType.Not',
}

export enum TransitionType {
  LOAD = 'TransitionType.Load',
  ACCESS = 'TransitionType.Access',
  ACTION = 'TransitionType.Action',
  SUBMIT = 'TransitionType.Submit',
}

export enum OutcomeType {
  REDIRECT = 'Outcome.Redirect',
  THROW_ERROR = 'Outcome.ThrowError',
}
