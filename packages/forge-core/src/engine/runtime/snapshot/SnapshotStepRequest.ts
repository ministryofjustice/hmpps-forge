import type { HttpMethod, RequestLocation, StepRequest } from '../../../framework/types/request.type'
import type { RequestSnapshot } from '../../../framework/types/snapshot.type'

/**
 * Adapts a plain {@link RequestSnapshot} to the {@link StepRequest} the
 * evaluation pipeline consumes. This is the only translation the engine needs
 * to stay framework-agnostic: phases, terminals and compiled functions read
 * through this interface and never know a snapshot produced it.
 */
export default class SnapshotStepRequest implements StepRequest {
  readonly method: HttpMethod

  readonly url: string

  readonly baseUrl: string

  readonly location: RequestLocation

  constructor(private readonly snapshot: RequestSnapshot) {
    this.method = snapshot.method
    this.location = snapshot.location
    this.url = snapshot.location.href
    this.baseUrl = snapshot.location.basePath
  }

  getHeader(name: string): string | string[] | undefined {
    return this.snapshot.headers[name.toLowerCase()]
  }

  getAllHeaders(): Record<string, string | string[] | undefined> {
    return this.snapshot.headers
  }

  getCookie(name: string): string | undefined {
    return this.snapshot.cookies[name]
  }

  getAllCookies(): Record<string, string | undefined> {
    return this.snapshot.cookies
  }

  getParam(name: string): string | undefined {
    return this.snapshot.params[name]
  }

  getParams(): Record<string, string> {
    return this.snapshot.params
  }

  getQuery(name: string): string | string[] | undefined {
    return this.snapshot.query[name]
  }

  getAllQuery(): Record<string, string | string[]> {
    return this.snapshot.query
  }

  getPost(name: string): string | string[] | undefined {
    return this.snapshot.post[name]
  }

  getAllPost(): Record<string, string | string[]> {
    return this.snapshot.post
  }

  getSession(): unknown {
    return this.snapshot.session
  }

  getState(key: string): unknown {
    return this.snapshot.state[key]
  }

  getAllState(): Record<string, unknown> {
    return this.snapshot.state
  }
}
