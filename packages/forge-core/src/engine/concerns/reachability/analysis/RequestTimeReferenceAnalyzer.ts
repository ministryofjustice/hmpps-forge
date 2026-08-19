import { ExpressionType } from '../../../../authoring/types/enums'
import type { ASTNode } from '../../../chassis/contracts/ast/ast.type'
import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import type { ReferenceASTNode } from '../../../chassis/contracts/ast/expressions.type'
import { isASTNode } from '../../../chassis/contracts/ast/nodes'

export default class RequestTimeReferenceAnalyzer {
  private static readonly REQUEST_TIME_NAMESPACES: ReadonlySet<string> = new Set(['post', 'params', 'query', 'request'])

  containsRequestTimeReference(node: ASTNode): boolean {
    if (this.isRequestTimeReference(node)) {
      return true
    }

    return Object.values(node.properties ?? {}).some(value => this.containsRequestTimeReferenceInValue(value))
  }

  private containsRequestTimeReferenceInValue(value: unknown): boolean {
    if (Array.isArray(value)) {
      return value.some(item => this.containsRequestTimeReferenceInValue(item))
    }

    if (isASTNode(value)) {
      return this.containsRequestTimeReference(value)
    }

    if (this.isPlainRecord(value)) {
      return Object.values(value).some(item => this.containsRequestTimeReferenceInValue(item))
    }

    return false
  }

  private isRequestTimeReference(node: ASTNode): boolean {
    if (!this.isReferenceNode(node)) {
      return false
    }

    const root = node.properties.path[0]

    return typeof root === 'string' && RequestTimeReferenceAnalyzer.REQUEST_TIME_NAMESPACES.has(root)
  }

  private isReferenceNode(node: ASTNode): node is ReferenceASTNode {
    return node.type === ASTNodeType.EXPRESSION &&
      'expressionType' in node &&
      node.expressionType === ExpressionType.REFERENCE
  }

  private isPlainRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object'
  }
}
