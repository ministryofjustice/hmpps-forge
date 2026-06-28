import { ExpressionType } from '../../../../authoring/types/enums'
import type { ASTNode } from '../../../contracts/ast/ast.type'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type { ReferenceASTNode } from '../../../contracts/ast/expressions.type'
import { isASTNode } from '../../../contracts/ast/nodes'

export default class RequestTimeReferenceAnalyzer {
  private static readonly REQUEST_TIME_NAMESPACES: ReadonlySet<string> = new Set(['post', 'params', 'query', 'request'])

  containsRequestTimeReference(node: ASTNode): boolean {
    return this.containsRequestTimeReferenceInNode(node, new Set())
  }

  private containsRequestTimeReferenceInNode(node: ASTNode, visited: Set<object>): boolean {
    if (visited.has(node)) {
      return false
    }

    visited.add(node)

    if (this.isRequestTimeReference(node)) {
      return true
    }

    const { properties } = node

    if (properties === undefined) {
      return false
    }

    return Object.values(properties).some(value => this.containsRequestTimeReferenceInValue(value, visited))
  }

  private containsRequestTimeReferenceInValue(value: unknown, visited: Set<object>): boolean {
    if (Array.isArray(value)) {
      return value.some(item => this.containsRequestTimeReferenceInValue(item, visited))
    }

    if (isASTNode(value)) {
      return this.containsRequestTimeReferenceInNode(value, visited)
    }

    if (this.isPlainRecord(value)) {
      if (visited.has(value)) {
        return false
      }

      visited.add(value)

      return Object.values(value).some(item => this.containsRequestTimeReferenceInValue(item, visited))
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
