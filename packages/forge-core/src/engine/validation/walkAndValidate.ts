import type { JourneyDefinition } from '../../authoring/types/structures.type'
import { BlockType, ExpressionType, FunctionType, StructureType } from '../../authoring/types/enums'
import type {
  AncestorNode,
  DSLPathSegment,
  TraversalContext,
  ValidationRule,
  ReferenceValidationRule,
  FunctionValidationRule,
  BlockValidationRule,
} from './rules/types'

const FUNCTION_TYPE_VALUES: ReadonlySet<string> = new Set(Object.values(FunctionType))

interface CategorisedRules {
  readonly reference: readonly ReferenceValidationRule[]
  readonly function: readonly FunctionValidationRule[]
  readonly block: readonly BlockValidationRule[]
}

const categoriseRules = (rules: readonly ValidationRule[]): CategorisedRules => {
  const reference: ReferenceValidationRule[] = []
  const fn: FunctionValidationRule[] = []
  const block: BlockValidationRule[] = []

  rules.forEach(rule => {
    switch (rule.kind) {
      case 'reference':
        reference.push(rule)
        break
      case 'function':
        fn.push(rule)
        break
      case 'block':
        block.push(rule)
        break
      default:
        break
    }
  })

  return { reference, function: fn, block }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

interface WalkState {
  readonly ancestors: readonly AncestorNode[]
  readonly insideFieldCode: boolean
}

const walkIterateNode = (
  record: Record<string, unknown>,
  path: readonly DSLPathSegment[],
  root: JourneyDefinition,
  state: WalkState,
  rules: CategorisedRules,
  errors: Error[],
): void => {
  walk(record.input, [...path, 'input'], root, state, rules, errors)

  const iterator = record.iterator

  if (!isRecord(iterator)) {
    return
  }

  const iteratorState: WalkState = {
    ...state,
    ancestors: [...state.ancestors, { type: record.type as string, record }],
  }

  Object.entries(iterator).forEach(([key, child]) => {
    walk(child, [...path, 'iterator', key], root, iteratorState, rules, errors)
  })
}

const dispatchRules = (
  record: Record<string, unknown>,
  context: TraversalContext,
  rules: CategorisedRules,
  errors: Error[],
): void => {
  if (record.type === ExpressionType.REFERENCE && Array.isArray(record.path)) {
    rules.reference.forEach(rule => {
      errors.push(...rule.check(record.path as unknown[], context))
    })
  }

  if (typeof record.type === 'string' && FUNCTION_TYPE_VALUES.has(record.type) && typeof record.name === 'string') {
    rules.function.forEach(rule => {
      errors.push(...rule.check(record.name as string, record.type as string, context))
    })
  }

  if (record.type === StructureType.BLOCK && typeof record.variant === 'string') {
    rules.block.forEach(rule => {
      errors.push(...rule.check(record.variant as string, context))
    })
  }
}

const walk = (
  value: unknown,
  path: readonly DSLPathSegment[],
  root: JourneyDefinition,
  state: WalkState,
  rules: CategorisedRules,
  errors: Error[],
): void => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walk(item, [...path, index], root, state, rules, errors)
    })

    return
  }

  if (!isRecord(value)) {
    return
  }

  const context: TraversalContext = {
    path,
    root,
    ancestors: state.ancestors,
    insideFieldCode: state.insideFieldCode,
    record: value,
  }

  dispatchRules(value, context, rules, errors)

  if (value.type === ExpressionType.ITERATE) {
    walkIterateNode(value, path, root, state, rules, errors)

    return
  }

  const nextAncestors =
    typeof value.type === 'string' ? [...state.ancestors, { type: value.type, record: value }] : state.ancestors

  const isFieldBlock = value.type === StructureType.BLOCK && value.blockType === BlockType.FIELD

  Object.entries(value).forEach(([key, child]) => {
    walk(
      child,
      [...path, key],
      root,
      {
        ancestors: nextAncestors,
        insideFieldCode: state.insideFieldCode || (isFieldBlock && key === 'code'),
      },
      rules,
      errors,
    )
  })
}

export const walkAndValidate = (root: JourneyDefinition, rules: readonly ValidationRule[]): readonly Error[] => {
  const categorised = categoriseRules(rules)
  const errors: Error[] = []

  walk(root, [], root, { ancestors: [], insideFieldCode: false }, categorised, errors)

  return errors
}
