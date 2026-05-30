import { BlockType, ExpressionType, StructureType } from '../../../authoring/types/enums'
import ForgeConfigurationReferenceScopeError from '../../errors/ForgeConfigurationReferenceScopeError'
import { formatDSLPath } from '../../diagnostics/formatDSLPath'
import type { ReferenceValidationRule, TraversalContext } from './types'

const LOOP_PROPERTIES: ReadonlySet<string> = new Set([
  'index',
  'index0',
  'revindex',
  'revindex0',
  'first',
  'last',
  'length',
])

const createError = (context: TraversalContext, message: string, code: string): ForgeConfigurationReferenceScopeError =>
  new ForgeConfigurationReferenceScopeError({
    path: [...context.path],
    message,
    code,
    formattedPath: formatDSLPath(context.root, [...context.path]),
  })

const hasFieldBlockAncestor = (context: TraversalContext): boolean =>
  context.ancestors.some(a => a.type === StructureType.BLOCK && a.record.blockType === BlockType.FIELD)

const getIteratorDepth = (context: TraversalContext): number =>
  context.ancestors.filter(a => a.type === ExpressionType.ITERATE).length

const parseReferenceLevel = (value: unknown): number | undefined => {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return undefined
  }

  const level = Number(value)

  return Number.isInteger(level) && level >= 0 ? level : undefined
}

const validateSelfReference = (context: TraversalContext): readonly Error[] => {
  if (!hasFieldBlockAncestor(context)) {
    return [createError(context, 'Self() can only be used inside a field block', 'self_outside_field')]
  }

  if (context.insideFieldCode) {
    return [createError(context, "Self() cannot be used within the field's code expression", 'self_inside_code')]
  }

  return []
}

const validateItemReference = (referencePath: unknown[], context: TraversalContext): readonly Error[] => {
  const level = parseReferenceLevel(referencePath[1])

  if (level === undefined) {
    return [createError(context, 'Item() reference level must be a non-negative integer', 'item_invalid_level')]
  }

  const iteratorDepth = getIteratorDepth(context)

  if (level >= iteratorDepth) {
    const message =
      iteratorDepth === 0
        ? 'Item() can only be used inside an iterator'
        : `Item().parent references level ${level}, but only ${iteratorDepth} iterator scope is available`

    return [createError(context, message, 'item_outside_iterator_scope')]
  }

  return []
}

const validateLoopReference = (referencePath: unknown[], context: TraversalContext): readonly Error[] => {
  const errors: Error[] = []
  const level = parseReferenceLevel(referencePath[1])

  if (level === undefined) {
    return [createError(context, 'Loop reference level must be a non-negative integer', 'loop_invalid_level')]
  }

  const iteratorDepth = getIteratorDepth(context)

  if (level >= iteratorDepth) {
    const message =
      iteratorDepth === 0
        ? 'Loop can only be used inside an iterator'
        : `Loop.Parent references level ${level}, but only ${iteratorDepth} iterator scope is available`

    errors.push(createError(context, message, 'loop_outside_iterator_scope'))
  }

  const property = referencePath[2]

  if (typeof property !== 'string' || !LOOP_PROPERTIES.has(property)) {
    errors.push(
      createError(
        context,
        'Loop reference property must be one of index, index0, revindex, revindex0, first, last, length',
        'loop_invalid_property',
      ),
    )
  }

  return errors
}

export const referenceScopeRule: ReferenceValidationRule = {
  kind: 'reference',
  check: (referencePath, context) => {
    const namespace = referencePath[0]

    if ((namespace === 'answers' && referencePath[1] === '@self') || namespace === '@self') {
      return validateSelfReference(context)
    }

    if (namespace === '@scope') {
      return validateItemReference(referencePath, context)
    }

    if (namespace === '@loop') {
      return validateLoopReference(referencePath, context)
    }

    return []
  },
}
