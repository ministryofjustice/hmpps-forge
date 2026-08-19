import { BlockType } from '../../../../authoring/types/enums'
import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import type { ASTNode, NodeId } from '../../../chassis/contracts/ast/engine.type'
import type { FieldBlockASTNode } from '../../../chassis/contracts/ast/structures.type'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'

function buildError(code: string, diagnostics: ASTNodeDiagnostics | undefined): ForgeReferenceScopeError {
  const source = diagnostics?.source

  return new ForgeReferenceScopeError({
    message: `Field code '${code}' is shared by multiple blocks on the same step, so every one of them must declare dependentWhen to mark which variant is active`,
    formattedPath: source?.formattedPath ?? 'unknown',
    callsite: diagnostics?.callsite,
  })
}

function owningStepId(node: ASTNode): NodeId | undefined {
  let ancestor = node.parent

  while (ancestor !== undefined) {
    if (ancestor.type === ASTNodeType.STEP) {
      return ancestor.id
    }

    ancestor = ancestor.parent
  }

  return undefined
}

/**
 * Same-code field blocks on one step are variants of one logical field: at
 * runtime the first copy whose `dependentWhen` holds owns answer preparation
 * and validation. Copies without a `dependentWhen` would always be active, so
 * duplicates are only legal when every copy declares one. Runtime-resolved
 * codes (iterator template fields) cannot be checked statically and are
 * exempt.
 */
export const validateFieldCodeUniqueness: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex } = context
  const errors: Error[] = []
  const fieldBlocksByStepAndCode = new Map<string, FieldBlockASTNode[]>()

  nodeIndex.findByType<FieldBlockASTNode>(BlockType.FIELD).forEach(fieldBlock => {
    const code = fieldBlock.properties.code
    const stepId = owningStepId(fieldBlock)

    if (typeof code !== 'string' || stepId === undefined) {
      return
    }

    const key = `${stepId}:${code}`
    const group = fieldBlocksByStepAndCode.get(key) ?? []

    group.push(fieldBlock)
    fieldBlocksByStepAndCode.set(key, group)
  })

  fieldBlocksByStepAndCode.forEach(fieldBlocks => {
    if (fieldBlocks.length < 2) {
      return
    }

    fieldBlocks
      .filter(fieldBlock => fieldBlock.properties.dependentWhen === undefined)
      .forEach(fieldBlock => {
        errors.push(buildError(fieldBlock.properties.code as string, fieldBlock.diagnostics))
      })
  })

  return errors
}
