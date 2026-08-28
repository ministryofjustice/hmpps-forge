import { ComponentCallType, ExpressionType } from '../../../../shared/taxonomy'
import type { IterateASTNode, ReferenceASTNode } from '../../../chassis/contracts/ast/expressions.type'
import type { ASTNode } from '../../../chassis/contracts/ast/engine.type'
import { isFieldBlockStructNode } from '../../../chassis/contracts/ast/structure-nodes'
import { isTemplateASTNode } from '../../../chassis/contracts/ast/nodes'
import type { TemplateValue } from '../../../chassis/contracts/ast/template.type'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTNodeDiagnostics } from '../../../../shared/diagnostics/sourceLocation.type'
import type { ASTValidationContext, ASTValidationRule } from './types'

function buildError(message: string, diagnostics: ASTNodeDiagnostics | undefined): ForgeReferenceScopeError {
  const source = diagnostics?.source

  return new ForgeReferenceScopeError({
    message,
    formattedPath: source?.formattedPath ?? 'unknown',
    callsite: diagnostics?.callsite,
  })
}

/** Both authored spellings survive to the AST: `['answers', '@self', …]` from the `Self()` builder and bare `['@self', …]` from raw definitions. */
function isSelfReferencePath(path: unknown): boolean {
  if (!Array.isArray(path)) {
    return false
  }

  return path[0] === '@self' || (path[0] === 'answers' && path[1] === '@self')
}

interface SelfScope {
  readonly insideFieldBlock: boolean
  readonly insideFieldCode: boolean
}

const UNSCOPED: SelfScope = { insideFieldBlock: false, insideFieldCode: false }

/**
 * Walks `parent` links to the nearest field block. The chain remembers which
 * child it arrived through, so an identity check against the field's `code`
 * property detects a reference sitting inside the field's own code expression.
 */
function scopeAt(node: ASTNode): SelfScope {
  let child: ASTNode = node
  let current = node.parent

  while (current !== undefined) {
    if (isFieldBlockStructNode(current)) {
      return { insideFieldBlock: true, insideFieldCode: current.properties?.code === child }
    }

    child = current
    current = current.parent
  }

  return UNSCOPED
}

function selfScopeError(scope: SelfScope, diagnostics: ASTNodeDiagnostics | undefined): Error | undefined {
  if (!scope.insideFieldBlock) {
    return buildError('Self() reference used outside of a field block', diagnostics)
  }

  if (scope.insideFieldCode) {
    return buildError("Self() cannot be used within the field's code expression", diagnostics)
  }

  return undefined
}

function walkTemplateForSelfScope(value: TemplateValue, scope: SelfScope, errors: Error[]): void {
  if (value === null || value === undefined || typeof value !== 'object') {
    return
  }

  if (Array.isArray(value)) {
    value.forEach(item => walkTemplateForSelfScope(item, scope, errors))

    return
  }

  if (isTemplateASTNode(value)) {
    if (value.kind === ExpressionType.REFERENCE && isSelfReferencePath(value.properties?.path)) {
      const error = selfScopeError(scope, value.diagnostics)

      if (error !== undefined) {
        errors.push(error)
      }
    }

    const isFieldBlock = value.kind === ComponentCallType.FIELD

    if (value.properties) {
      Object.entries(value.properties).forEach(([key, propValue]) => {
        const childScope = isFieldBlock ? { insideFieldBlock: true, insideFieldCode: key === 'code' } : scope

        walkTemplateForSelfScope(propValue as TemplateValue, childScope, errors)
      })
    }

    Object.entries(value).forEach(([key, val]) => {
      if (key === 'kind' || key === 'isTemplate' || key === 'id' || key === 'properties') {
        return
      }

      walkTemplateForSelfScope(val as TemplateValue, scope, errors)
    })

    return
  }

  Object.values(value as Record<string, TemplateValue>).forEach(child => {
    walkTemplateForSelfScope(child, scope, errors)
  })
}

export const validateSelfScope: ASTValidationRule = (context: ASTValidationContext): readonly Error[] => {
  const { nodeIndex } = context
  const errors: Error[] = []

  nodeIndex.findByKind<ReferenceASTNode>(ExpressionType.REFERENCE).forEach(node => {
    if (!isSelfReferencePath(node.properties?.path)) {
      return
    }

    const error = selfScopeError(scopeAt(node), node.diagnostics)

    if (error !== undefined) {
      errors.push(error)
    }
  })

  const iterateNodes = nodeIndex.findByKind<IterateASTNode>(ExpressionType.ITERATE)

  iterateNodes.forEach(iterateNode => {
    const scope = scopeAt(iterateNode)
    const { iterator } = iterateNode.properties

    const templates = [iterator.yieldTemplate, iterator.predicateTemplate].filter(
      (t): t is NonNullable<typeof t> => t !== undefined,
    )

    templates.forEach(template => {
      walkTemplateForSelfScope(template, scope, errors)
    })
  })

  return errors
}
