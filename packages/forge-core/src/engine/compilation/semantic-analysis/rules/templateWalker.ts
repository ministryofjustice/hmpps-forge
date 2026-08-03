import type { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import { isTemplateNode } from '../../../contracts/ast/nodes'
import type { DSLSourceLocation } from '../../../../shared/diagnostics/sourceLocation.type'

export interface TemplateVisitor {
  /** Return false to skip walking this node's children. */
  onTemplateNode(node: TemplateNode, source: DSLSourceLocation | undefined): boolean | void
}

export function walkTemplateValue(value: TemplateValue, visitor: TemplateVisitor): void {
  if (value === null || value === undefined || typeof value !== 'object') {
    return
  }

  if (Array.isArray(value)) {
    value.forEach(item => walkTemplateValue(item, visitor))

    return
  }

  if (isTemplateNode(value)) {
    const shouldWalkChildren = visitor.onTemplateNode(value, value.diagnostics?.source)

    if (shouldWalkChildren !== false) {
      walkTemplateProperties(value, visitor)
    }

    return
  }

  Object.values(value as Record<string, TemplateValue>).forEach(child => {
    walkTemplateValue(child, visitor)
  })
}

function walkTemplateProperties(node: TemplateNode, visitor: TemplateVisitor): void {
  if (!node.properties) {
    return
  }

  Object.values(node.properties).forEach(propValue => {
    walkTemplateValue(propValue, visitor)
  })

  Object.entries(node).forEach(([key, value]) => {
    if (key === 'type' || key === 'originalType' || key === 'id' || key === 'diagnostics' || key === 'properties') {
      return
    }

    walkTemplateValue(value as TemplateValue, visitor)
  })
}
