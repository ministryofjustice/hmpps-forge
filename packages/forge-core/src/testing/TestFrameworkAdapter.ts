import type {
  ComponentRegistry,
  FrameworkAdapter,
  FrameworkAdapterBuilder,
  FrameworkAdapterDependencies,
  StepHandler,
} from '../framework/types/adapter.type'
import type { CookieOptions, StepResponse } from '../framework/types/response.type'
import type { StepRequest } from '../framework/types/request.type'
import type { RenderContext } from '../framework/rendering/types'
import type { ForgeResult } from '../engine/runtime/orchestrator/types'
import { extractPathname } from '../framework/path/routePath'
import type { TestRequest, TestResponse, TestRouter } from './types'
import { ForgeTestClient } from './ForgeTestClient'

function createTestRouter(): TestRouter {
  return {
    routes: new Map(),
    children: new Map(),
  }
}

/** Builder for configuring Forge with a test adapter and creating a test client. */
export interface TestFrameworkAdapterBuilder extends FrameworkAdapterBuilder<TestRouter, TestRequest, TestResponse> {
  createClient(router: TestRouter): ForgeTestClient
}

/**
 * In-memory framework adapter for testing Forge journeys without HTTP or HTML rendering.
 *
 * Routes are stored in a plain tree structure and render/redirect results are
 * captured directly, so tests can assert on the engine's output without
 * standing up a server or a template environment.
 *
 * @example
 * ```typescript
 * const adapter = TestFrameworkAdapter.configure()
 * const forge = new Forge({ frameworkAdapter: adapter })
 * forge.registerPackage(myPackage, { api: mockApi })
 *
 * const client = adapter.createClient(forge.getRouter() as TestRouter)
 * const result = await client.get('/my-journey/step-one', {
 *   session: { answers: { name: 'John' } },
 * })
 *
 * expect(result.type).toBe('render')
 * ```
 */
export default class TestFrameworkAdapter implements FrameworkAdapter<TestRouter, TestRequest, TestResponse> {

  /**
   * Create a builder to pass to `new Forge()`.
   *
   * Call `createClient()` on the returned builder after registering
   * packages to get a {@link ForgeTestClient} for dispatching requests.
   */
  static configure(): TestFrameworkAdapterBuilder {
    let instance: TestFrameworkAdapter | undefined

    return {
      build: (_deps: FrameworkAdapterDependencies) => {
        instance = new TestFrameworkAdapter()

        return instance
      },
      createClient: (router: TestRouter) => {
        if (!instance) {
          throw new Error(
            'TestFrameworkAdapter has not been built yet. Register the adapter with Forge before creating a client.',
          )
        }

        return instance.createClient(router)
      },
    }
  }

  createRouter(): TestRouter {
    return createTestRouter()
  }

  mountRouter(parent: TestRouter, path: string, child: TestRouter): void {
    parent.children.set(path, child)
  }

  get(router: TestRouter, path: string, handler: StepHandler<TestRequest, TestResponse>): void {
    const route = router.routes.get(path) ?? {}

    route.get = { handler }
    router.routes.set(path, route)
  }

  post(router: TestRouter, path: string, handler: StepHandler<TestRequest, TestResponse>): void {
    const route = router.routes.get(path) ?? {}

    route.post = { handler }
    router.routes.set(path, route)
  }

  toStepRequest(req: TestRequest): StepRequest {
    const url = req.url
    const pathname = extractPathname(url)

    return {
      method: req.method,
      url,
      baseUrl: req.baseUrl,
      location: {
        origin: 'http://localhost',
        href: url,
        pathname,
        basePath: req.baseUrl,
      },
      getHeader: (name: string) => req.headers[name.toLowerCase()],
      getAllHeaders: () => req.headers,
      getCookie: (name: string) => req.cookies[name],
      getAllCookies: () => req.cookies,
      getParam: (name: string) => req.params[name],
      getParams: () => req.params,
      getQuery: (name: string) => req.query[name],
      getAllQuery: () => req.query,
      getPost: (name: string) => req.body[name],
      getAllPost: () => req.body,
      getSession: () => req.session,
      getState: (key: string) => req.state[key],
      getAllState: () => req.state,
    }
  }

  toStepResponse(res: TestResponse): StepResponse {
    return {
      setHeader: (name: string, value: string) => {
        res.headers.set(name, value)
      },
      getHeader: (name: string) => res.headers.get(name),
      getAllHeaders: () => res.headers,
      setCookie: (name: string, value: string, options?: CookieOptions) => {
        res.cookies.set(name, { value, options })
      },
      getCookie: (name: string) => res.cookies.get(name),
      getAllCookies: () => res.cookies,
    }
  }

  redirect(res: TestResponse, url: string): void {
    res.redirectUrl = url
  }

  render(context: RenderContext, _req: TestRequest, res: TestResponse, _componentRegistry: ComponentRegistry): void {
    res.renderContext = context
  }

  applyResult(result: ForgeResult, req: TestRequest, res: TestResponse, componentRegistry: ComponentRegistry): void {
    if (result.type === 'redirect') {
      this.redirect(res, result.url)

      return
    }

    this.render(result.context, req, res, componentRegistry)
  }

  forwardError(_res: TestResponse, error: unknown): void {
    throw error
  }

  /** Create a test client that can dispatch requests against the given route tree. */
  createClient(router: TestRouter): ForgeTestClient {
    return new ForgeTestClient(router)
  }
}
