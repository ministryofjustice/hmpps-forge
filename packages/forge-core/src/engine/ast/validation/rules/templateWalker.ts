import type { TemplateNode, TemplateValue } from '../../../contracts/ast/template.type'
import { isTemplateNode } from '../../../contracts/ast/nodes'
import type { DSLSourceMetadata } from '../../../diagnostics/sourceMetadata'
import { getDSLSourceMetadata } from '../../../diagnostics/sourceMetadata'

export interface TemplateVisitor {
  onTemplateNode(node: TemplateNode, metadata: DSLSourceMetadata | undefined): void
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
    visitor.onTemplateNode(value, getDSLSourceMetadata(value))
    walkTemplateProperties(value, visitor)

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
    if (key === 'type' || key === 'originalType' || key === 'id' || key === 'properties') {
      return
    }

    walkTemplateValue(value as TemplateValue, visitor)
  })
}
