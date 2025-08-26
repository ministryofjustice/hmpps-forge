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
}

export enum LogicType {
  TEST = 'LogicType.Test',
  AND = 'LogicType.And',
  OR = 'LogicType.Or',
  XOR = 'LogicType.Xor',
  NOT = 'LogicType.Not',
  CONDITIONAL = 'LogicType.Conditional',
}
