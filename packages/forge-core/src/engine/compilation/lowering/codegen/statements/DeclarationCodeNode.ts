import { SafeCode } from '../fragments/CodeFragment'
import CodeNode from './CodeNode'
import IdentifierName from '../fragments/IdentifierName'

export enum DeclarationKind {
  CONST = 'const',
  LET = 'let',
  VAR = 'var',
}

export default class DeclarationCodeNode extends CodeNode {
  constructor(
    private readonly declaration: DeclarationKind,
    private readonly declarationName: IdentifierName,
    private readonly declarationValue?: SafeCode,
  ) {
    super()
  }

  get declarationKind(): DeclarationKind {
    return this.declaration
  }

  get name(): IdentifierName {
    return this.declarationName
  }

  get value(): SafeCode | undefined {
    return this.declarationValue
  }
}
