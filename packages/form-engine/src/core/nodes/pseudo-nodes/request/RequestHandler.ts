import { NodeId } from '@form-engine/core/types/engine.type'
import { RequestPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { ThunkHandler, HandlerResult } from '@form-engine/core/compilation/thunks/types'
import { isSafePropertyKey } from '@form-engine/core/utils/propertyAccess'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import ThunkEvaluationError from '@form-engine/errors/ThunkEvaluationError'

/**
 * Handler for REQUEST pseudo nodes
 *
 * Returns request metadata values from the current request context.
 */
export default class RequestHandler implements ThunkHandler {
  isAsync = false

  constructor(
    public readonly nodeId: NodeId,
    private readonly pseudoNode: RequestPseudoNode,
  ) {}

  computeIsAsync(): void {
    this.isAsync = false
  }

  async evaluate(context: ThunkEvaluationContext): Promise<HandlerResult> {
    return this.evaluateSync(context)
  }

  evaluateSync(context: ThunkEvaluationContext): HandlerResult {
    const parsed = this.parseRequestPath(this.pseudoNode.properties.requestPath)

    if (!parsed) {
      return { value: undefined }
    }

    if (parsed.key !== undefined && !isSafePropertyKey(parsed.key)) {
      const error = ThunkEvaluationError.securityViolation(this.nodeId, parsed.key, PseudoNodeType.REQUEST)

      return { error: error.toThunkError() }
    }

    switch (parsed.source) {
      case 'url':
        return { value: context.request.url }

      case 'path':
        return { value: this.getPath(context.request.url) }

      case 'method':
        return { value: context.request.method }

      case 'headers':
        return { value: parsed.key ? context.request.getHeader(parsed.key) : undefined }

      case 'cookies':
        return { value: parsed.key ? context.request.getCookie(parsed.key) : undefined }

      case 'state':
        return { value: parsed.key ? context.request.getState(parsed.key) : undefined }

      default:
        return { value: undefined }
    }
  }

  private getPath(url: string): string {
    try {
      return new URL(url).pathname
    } catch {
      const [withoutHash] = url.split('#', 1)
      const [path] = withoutHash.split('?', 1)

      return path
    }
  }

  private parseRequestPath(requestPath: string): { source: string; key?: string } | undefined {
    if (requestPath === 'url' || requestPath === 'path' || requestPath === 'method') {
      return { source: requestPath }
    }

    if (requestPath.startsWith('headers.')) {
      return { source: 'headers', key: requestPath.slice('headers.'.length) }
    }

    if (requestPath.startsWith('cookies.')) {
      return { source: 'cookies', key: requestPath.slice('cookies.'.length) }
    }

    if (requestPath.startsWith('state.')) {
      return { source: 'state', key: requestPath.slice('state.'.length) }
    }

    return undefined
  }
}
