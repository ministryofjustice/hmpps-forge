import DSLPathFormatter from './DSLPathFormatter'
import type { DSLPathSegment, DSLSourceLocation } from './sourceLocation.type'

export default class DSLSourceLocator {
  constructor(
    private readonly root: unknown,
    private readonly pathFormatter = new DSLPathFormatter(),
  ) {}

  fromPath(path: readonly DSLPathSegment[]): DSLSourceLocation {
    return {
      path,
      formattedPath: this.pathFormatter.format(this.root, path),
    }
  }
}
