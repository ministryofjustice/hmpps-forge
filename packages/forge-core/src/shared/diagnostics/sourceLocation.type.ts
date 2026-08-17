export type DSLPathSegment = string | number

export interface DSLSourceLocation {
  readonly path: readonly DSLPathSegment[]
  readonly formattedPath: string
}

export interface ASTNodeDiagnostics {
  readonly source: DSLSourceLocation
  readonly callsite?: { readonly stack?: string }
}
