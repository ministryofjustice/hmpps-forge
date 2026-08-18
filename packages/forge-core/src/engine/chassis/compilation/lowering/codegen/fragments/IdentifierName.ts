import ForgeInternalError from '../../../../../errors/ForgeInternalError'

/** A validated JavaScript identifier, safe to interpolate as executable code. */
export default class IdentifierName {
  constructor(private readonly identifier: string) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(identifier) || FORBIDDEN_BINDING_NAMES.has(identifier)) {
      throw new ForgeInternalError(`Code: "${identifier}" is not a valid JavaScript identifier`)
    }
  }

  get value(): string {
    return this.identifier
  }
}

const FORBIDDEN_BINDING_NAMES = new Set([
  'arguments',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'eval',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
])
