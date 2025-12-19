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

export enum ExpressionType {
  REFERENCE = 'ExpressionType.Reference',
  FORMAT = 'ExpressionType.Format',
  PIPELINE = 'ExpressionType.Pipeline',
  NEXT = 'ExpressionType.Next',
  VALIDATION = 'ExpressionType.Validation',
  COLLECTION = 'ExpressionType.Collection',
  ITERATE = 'ExpressionType.Iterate',
}

export enum IteratorType {
  MAP = 'IteratorType.Map',
  FILTER = 'IteratorType.Filter',
  FIND = 'IteratorType.Find',
}

export enum LogicType {
  TEST = 'LogicType.Test',
  AND = 'LogicType.And',
  OR = 'LogicType.Or',
  XOR = 'LogicType.Xor',
  NOT = 'LogicType.Not',
  CONDITIONAL = 'LogicType.Conditional',
}

export enum TransitionType {
  LOAD = 'TransitionType.Load',
  ACCESS = 'TransitionType.Access',
  ACTION = 'TransitionType.Action',
  SUBMIT = 'TransitionType.Submit',
}
