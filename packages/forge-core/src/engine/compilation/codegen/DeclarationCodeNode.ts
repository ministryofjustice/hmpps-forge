import { SafeCode } from './Code'
import GeneratedCodeNode from './GeneratedCodeNode'
import Name from './Name'

export enum DeclarationKind {
  CONST = 'const',
  LET = 'let',
  VAR = 'var',
}

export default class DeclarationCodeNode extends GeneratedCodeNode {
  constructor(
    private readonly declaration: DeclarationKind,
    private readonly declarationName: Name,
    private readonly declarationValue?: SafeCode,
  ) {
    super()
  }

  get declarationKind(): DeclarationKind {
    return this.declaration
  }

  get name(): Name {
    return this.declarationName
  }

  get value(): SafeCode | undefined {
    return this.declarationValue
  }
}
