import type { TemplateASTNode } from './ast.type'

export type TemplateValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | TemplateASTNode
  | TemplateValue[]
  | { [key: string]: TemplateValue }
