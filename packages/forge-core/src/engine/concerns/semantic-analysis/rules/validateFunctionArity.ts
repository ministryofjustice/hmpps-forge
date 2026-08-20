import { z, type ZodType } from 'zod'
import { FunctionType } from '../../../../authoring/types/enums'
import type { FunctionASTNode } from '../../../chassis/contracts/ast/expressions.type'
import ForgeFunctionArityError from '../../../errors/ForgeFunctionArityError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'

const FUNCTION_TYPES = Object.values(FunctionType)

interface TupleArity {
  min: number
  /** undefined means unbounded — the tuple has a `.rest(...)` variadic tail */
  max: number | undefined
}

function tupleArity(schema: z.ZodTuple): TupleArity {
  const { items } = schema.def
  const hasRest = schema.def.rest !== null && schema.def.rest !== undefined

  // Trailing optional items lower the minimum; a gap in the middle still counts as required.
  const reversed = [...items].reverse()
  const firstRequired = reversed.findIndex(item => !(item instanceof z.ZodOptional))
  const trailingOptionals = firstRequired === -1 ? items.length : firstRequired

  return { min: items.length - trailingOptionals, max: hasRest ? undefined : items.length }
}

function describeArity({ min, max }: TupleArity): string {
  if (max === undefined) {
    return `at least ${min}`
  }

  if (min === max) {
    return `${min}`
  }

  return `between ${min} and ${max}`
}

function arityViolation(schema: ZodType, received: number): { expected: string } | undefined {
  if (!(schema instanceof z.ZodTuple)) {
    return undefined
  }

  const arity = tupleArity(schema)

  if (received >= arity.min && (arity.max === undefined || received <= arity.max)) {
    return undefined
  }

  return { expected: describeArity(arity) }
}

function buildError(
  name: string,
  functionType: string,
  diagnostics: ASTNodeDiagnostics | undefined,
  expected: string,
  received: number,
): ForgeFunctionArityError {
  const source = diagnostics?.source

  return new ForgeFunctionArityError({
    formattedPath: source?.formattedPath ?? 'unknown',
    functionName: name,
    functionType,
    expected,
    received,
    callsite: diagnostics?.callsite,
  })
}

export const validateFunctionArity: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex, templateNodeIndex, functionRegistry } = context
  const errors: Error[] = []

  FUNCTION_TYPES.forEach(functionType => {
    nodeIndex.findByType<FunctionASTNode>(functionType).forEach(node => {
      const entry = functionRegistry.get(node.properties.name)

      if (!entry?.argumentsSchema) {
        return
      }

      const received = node.properties.arguments.length
      const violation = arityViolation(entry.argumentsSchema, received)

      if (violation) {
        errors.push(buildError(node.properties.name, functionType, node.diagnostics, violation.expected, received))
      }
    })

    templateNodeIndex.findByType(functionType).forEach(({ node }) => {
      const name = (node.properties?.name as string) ?? ''
      const entry = functionRegistry.get(name)

      if (!entry?.argumentsSchema) {
        return
      }

      const received = (node.properties?.arguments as unknown[] | undefined)?.length ?? 0
      const violation = arityViolation(entry.argumentsSchema, received)

      if (violation) {
        errors.push(buildError(name, functionType, node.diagnostics, violation.expected, received))
      }
    })
  })

  return errors
}
