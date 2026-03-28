import { NodeId } from '@form-engine/core/types/engine.type'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import {
  ThunkHandler,
  ThunkInvocationAdapter,
  HandlerResult,
  MetadataComputationDependencies,
} from '@form-engine/core/compilation/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { RequestPseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { getByPath } from '@form-engine/utils/utils'
import { getPseudoNodeKey } from '@form-engine/core/utils/pseudoNodeKeyExtractor'
import NodeRegistry from '@form-engine/core/compilation/registries/NodeRegistry'

type ParsedRequestReference = {
  requestPath: string
  source: 'url' | 'path' | 'method' | 'headers' | 'cookies' | 'state'
  key?: string
  nestedPath: string[]
}

export default class RequestReferenceHandler implements ThunkHandler {
  isAsync = false

  constructor(
    public readonly nodeId: NodeId,
    private readonly node: ReferenceASTNode,
  ) {}

  computeIsAsync(_deps: MetadataComputationDependencies): void {
    this.isAsync = false
  }

  evaluateSync(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): HandlerResult {
    const parsed = this.parsePath(this.node.properties.path)

    if (!parsed) {
      return { value: undefined }
    }

    const relatedPseudoNode = this.findPseudoNodeInRegistry(context.nodeRegistry, parsed.requestPath)
    const baseValue = relatedPseudoNode
      ? invoker.invokeSync(relatedPseudoNode.id, context).value
      : this.getRequestValue(context, parsed)

    return { value: getByPath(baseValue, parsed.nestedPath.join('.')) }
  }

  async evaluate(context: ThunkEvaluationContext, invoker: ThunkInvocationAdapter): Promise<HandlerResult> {
    const parsed = this.parsePath(this.node.properties.path)

    if (!parsed) {
      return { value: undefined }
    }

    const relatedPseudoNode = this.findPseudoNodeInRegistry(context.nodeRegistry, parsed.requestPath)
    const baseValue = relatedPseudoNode
      ? (await invoker.invoke(relatedPseudoNode.id, context)).value
      : this.getRequestValue(context, parsed)

    return { value: getByPath(baseValue, parsed.nestedPath.join('.')) }
  }

  private findPseudoNodeInRegistry(nodeRegistry: NodeRegistry, requestPath: string): RequestPseudoNode | undefined {
    return nodeRegistry.findByType<RequestPseudoNode>(PseudoNodeType.REQUEST)
      .find(node => getPseudoNodeKey(node) === requestPath)
  }

  private getRequestValue(context: ThunkEvaluationContext, parsed: ParsedRequestReference): unknown {
    switch (parsed.source) {
      case 'url':
        return context.request.url

      case 'path':
        return this.getPath(context.request.url)

      case 'method':
        return context.request.method

      case 'headers':
        return parsed.key ? context.request.getHeader(parsed.key) : undefined

      case 'cookies':
        return parsed.key ? context.request.getCookie(parsed.key) : undefined

      case 'state':
        return parsed.key ? context.request.getState(parsed.key) : undefined

      default:
        return undefined
    }
  }

  private parsePath(path: unknown[]): ParsedRequestReference | undefined {
    const [, source, key, ...rest] = path

    if (source === 'url' || source === 'path' || source === 'method') {
      return {
        requestPath: source,
        source,
        nestedPath: [key, ...rest].filter((segment): segment is string => typeof segment === 'string'),
      }
    }

    if ((source === 'headers' || source === 'cookies' || source === 'state') && typeof key === 'string') {
      return {
        requestPath: `${source}.${key}`,
        source,
        key,
        nestedPath: rest.filter((segment): segment is string => typeof segment === 'string'),
      }
    }

    return undefined
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
}
