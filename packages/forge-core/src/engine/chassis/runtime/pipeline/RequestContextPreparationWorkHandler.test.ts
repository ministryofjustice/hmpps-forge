import type { RequestSnapshot } from '../../../../framework/types/snapshot.type'
import type { RequestContextPreparationWorkProps } from '../../contracts/runtime/RequestPipelineWork.type'
import type RequestState from './RequestState'
import type { WorkContextContract } from '../../contracts/work/work.type'
import { REQUEST_CONTEXT_PREPARATION_WORK_HANDLER } from './RequestContextPreparationWorkHandler'
import { createTestRequestState } from './testing-helpers/requestStateTestHelpers'
import TransformerRegistry from '../../../../authoring/registries/TransformerRegistry'
import type { RuntimeContext } from '../../contracts/runtime/evaluationState.type'
import type { FunctionRegistryBuilder } from '../../../../authoring/types/functions.type'
import { FunctionEntryRegistry } from '../../../../authoring/functions/FunctionEntryRegistry'
import { transformer } from '../../../../authoring/functions/transformer'

describe('RequestContextPreparationWorkHandler', () => {
  describe('begin()', () => {
    it('should populate context data from compiled static data', () => {
      // Arrange
      const compiledStaticData = vi.fn(() => ({ shared: 'static', enabled: true }))
      const requestState = createTestRequestState(createRuntimeContext({ existing: 'value' }), {
        functionBuilders: [],
        packageDependencies: {},
      })
      const snapshot = {
        nodeId: 'journey::step',
        location: {
          origin: 'https://example.com',
          href: 'https://example.com/form/step?from=test',
          pathname: '/form/step',
          basePath: '/form',
        },
        method: 'GET',
        headers: {},
        cookies: {},
        state: {},
        params: {},
        query: { from: 'test' },
        post: {},
        session: undefined,
      } satisfies RequestSnapshot
      const workContext: WorkContextContract<RequestState, RequestContextPreparationWorkProps> = {
        state: requestState,
        props: {
          compiledStaticData,
          snapshot,
        },
        withWork: vi.fn(),
      }

      // Act
      const result = REQUEST_CONTEXT_PREPARATION_WORK_HANDLER.begin(workContext)

      // Assert
      expect(result).toEqual({ output: { action: 'continue' } })
      expect(compiledStaticData).toHaveBeenCalledOnce()
      expect(requestState.context.domain.data).toEqual({
        existing: 'value',
        shared: 'static',
        enabled: true,
      })
      expect(requestState.context.request).toMatchObject({
        url: 'https://example.com/form/step?from=test',
        path: '/form/step',
        method: 'GET',
        query: { from: 'test' },
        session: {},
      })
    })

    it('should build isolated evaluators once for each request with package dependencies', () => {
      // Arrange
      const packageDependencies = { prefix: 'case-' }
      const factory = vi.fn((dependencies: typeof packageDependencies) => {
        let invocation = 0

        return (value: unknown) => `${dependencies.prefix}${String(value)}-${++invocation}`
      })
      const functionBuilder = new TransformerRegistry<typeof packageDependencies>()
      functionBuilder.register('WithPrefix', factory)
      const firstRequest = createRequestState([functionBuilder], packageDependencies)
      const secondRequest = createRequestState([functionBuilder], packageDependencies)

      // Act
      REQUEST_CONTEXT_PREPARATION_WORK_HANDLER.begin(createWorkContext(firstRequest))
      REQUEST_CONTEXT_PREPARATION_WORK_HANDLER.begin(createWorkContext(secondRequest))

      // Assert
      const firstEvaluator = firstRequest.functionRegistry.get('WithPrefix')?.evaluate
      const secondEvaluator = secondRequest.functionRegistry.get('WithPrefix')?.evaluate

      expect(factory).toHaveBeenCalledTimes(2)
      expect(factory).toHaveBeenNthCalledWith(1, packageDependencies)
      expect(factory).toHaveBeenNthCalledWith(2, packageDependencies)
      expect(firstEvaluator).not.toBe(secondEvaluator)
      expect(firstEvaluator?.('123')).toBe('case-123-1')
      expect(firstEvaluator?.('123')).toBe('case-123-2')
      expect(secondEvaluator?.('123')).toBe('case-123-1')
    })

    it('should merge package, adapter and request dependencies once for every function builder', () => {
      // Arrange
      const packageDependencies = { packageService: { name: 'package' } }
      const adapterDependencies = { adapterService: { name: 'adapter' } }
      const resolvedRequestDependencies = { requestService: { name: 'request' } }
      const requestDependencies = vi.fn(() => resolvedRequestDependencies)
      const firstFactory = vi.fn((_dependencies: unknown) => (value: unknown) => value)
      const secondFactory = vi.fn((_dependencies: unknown) => (value: unknown) => value)
      const firstBuilder = new TransformerRegistry()
      const secondBuilder = new TransformerRegistry()
      firstBuilder.register('First', firstFactory)
      secondBuilder.register('Second', secondFactory)
      const requestState = createRequestState(
        [firstBuilder, secondBuilder],
        packageDependencies,
        requestDependencies,
        adapterDependencies,
      )

      // Act
      const result = REQUEST_CONTEXT_PREPARATION_WORK_HANDLER.begin(createWorkContext(requestState))

      // Assert
      const mergedDependencies = firstFactory.mock.calls[0][0]

      expect(result).toEqual({ output: { action: 'continue' } })
      expect(requestDependencies).toHaveBeenCalledOnce()
      expect(secondFactory).toHaveBeenCalledWith(mergedDependencies)
      expect(mergedDependencies).toEqual({
        ...packageDependencies,
        ...adapterDependencies,
        ...resolvedRequestDependencies,
      })
      expect(mergedDependencies).not.toBe(packageDependencies)
      expect(mergedDependencies).not.toBe(adapterDependencies)
      expect(mergedDependencies).not.toBe(resolvedRequestDependencies)
      expect(packageDependencies).toEqual({ packageService: { name: 'package' } })
      expect(adapterDependencies).toEqual({ adapterService: { name: 'adapter' } })
      expect(resolvedRequestDependencies).toEqual({ requestService: { name: 'request' } })
    })

    it('should merge adapter dependencies when no request dependencies are configured', () => {
      // Arrange
      const factory = vi.fn(() => (value: unknown) => value)
      const functionBuilder = new TransformerRegistry()
      functionBuilder.register('AdapterDependencies', factory)
      const packageDependencies = { packageService: 'package' }
      const adapterDependencies = { adapterService: 'adapter' }
      const requestState = createRequestState([functionBuilder], packageDependencies, undefined, adapterDependencies)

      // Act
      REQUEST_CONTEXT_PREPARATION_WORK_HANDLER.begin(createWorkContext(requestState))

      // Assert
      expect(factory).toHaveBeenCalledWith({ packageService: 'package', adapterService: 'adapter' })
    })

    it('should await promise request dependencies before building functions', async () => {
      // Arrange
      const factory = vi.fn(() => (value: unknown) => value)
      const functionBuilder = new TransformerRegistry()
      functionBuilder.register('AsyncDependencies', factory)
      const requestDependencies = vi.fn(async () => ({ requestService: 'ready' }))
      const requestState = createRequestState([functionBuilder], {}, requestDependencies)

      // Act
      const result = await REQUEST_CONTEXT_PREPARATION_WORK_HANDLER.begin(createWorkContext(requestState))

      // Assert
      expect(result).toEqual({ output: { action: 'continue' } })
      expect(requestDependencies).toHaveBeenCalledOnce()
      expect(factory).toHaveBeenCalledWith({ requestService: 'ready' })
    })

    it('should assimilate custom thenable request dependencies', async () => {
      // Arrange
      const factory = vi.fn(() => (value: unknown) => value)
      const functionBuilder = new TransformerRegistry()
      functionBuilder.register('ThenableDependencies', factory)
      const customThenable = {
        then(resolve: (value: object) => void) {
          resolve({ requestService: 'custom-thenable' })
        },
      } as unknown as PromiseLike<object>
      const requestState = createRequestState([functionBuilder], {}, () => customThenable)

      // Act
      await REQUEST_CONTEXT_PREPARATION_WORK_HANDLER.begin(createWorkContext(requestState))

      // Assert
      expect(factory).toHaveBeenCalledWith({ requestService: 'custom-thenable' })
    })

    it('should reject dependency collisions before building functions', () => {
      // Arrange
      const factory = vi.fn(() => (value: unknown) => value)
      const functionBuilder = new TransformerRegistry()
      functionBuilder.register('CollidingDependencies', factory)
      const packageDependencies = { shared: 'package-secret', packageOnly: true }
      const requestDependencies = vi.fn(() => ({ shared: 'request-secret', requestOnly: true }))
      const requestState = createRequestState([functionBuilder], packageDependencies, requestDependencies)

      // Act
      let error: unknown

      try {
        REQUEST_CONTEXT_PREPARATION_WORK_HANDLER.begin(createWorkContext(requestState))
      } catch (caught) {
        error = caught
      }

      // Assert
      expect(error).toBeInstanceOf(TypeError)
      expect(error).toMatchObject({
        message: 'requestDependencies contains keys already provided by packageDependencies: shared',
      })
      expect(String(error)).not.toContain('package-secret')
      expect(String(error)).not.toContain('request-secret')
      expect(requestDependencies).toHaveBeenCalledOnce()
      expect(factory).not.toHaveBeenCalled()
    })

    it('should reject adapter dependency collisions with package dependencies', () => {
      // Arrange
      const factory = vi.fn(() => (value: unknown) => value)
      const functionBuilder = new TransformerRegistry()
      functionBuilder.register('CollidingAdapterDependencies', factory)
      const requestState = createRequestState([functionBuilder], { shared: 'package-secret' }, undefined, {
        shared: 'adapter-secret',
      })

      // Act
      const act = () => REQUEST_CONTEXT_PREPARATION_WORK_HANDLER.begin(createWorkContext(requestState))

      // Assert
      expect(act).toThrow('adapterDependencies contains keys already provided by packageDependencies: shared')
      expect(factory).not.toHaveBeenCalled()
    })

    it('should reject request dependency collisions with adapter dependencies', () => {
      // Arrange
      const factory = vi.fn(() => (value: unknown) => value)
      const functionBuilder = new TransformerRegistry()
      functionBuilder.register('CollidingRequestDependencies', factory)
      const requestState = createRequestState([functionBuilder], {}, () => ({ shared: 'request-secret' }), {
        shared: 'adapter-secret',
      })

      // Act
      const act = () => REQUEST_CONTEXT_PREPARATION_WORK_HANDLER.begin(createWorkContext(requestState))

      // Assert
      expect(act).toThrow('requestDependencies contains keys already provided by adapterDependencies: shared')
      expect(factory).not.toHaveBeenCalled()
    })

    it.each([undefined, null, 'invalid', 123])(
      'should reject a non-object request dependency result of %s',
      invalidRequestDependencies => {
        // Arrange
        const factory = vi.fn(() => (value: unknown) => value)
        const functionBuilder = new TransformerRegistry()
        functionBuilder.register('InvalidDependencies', factory)
        const requestDependencies = (() => invalidRequestDependencies) as never
        const requestState = createRequestState([functionBuilder], {}, requestDependencies)

        // Act
        const act = () => REQUEST_CONTEXT_PREPARATION_WORK_HANDLER.begin(createWorkContext(requestState))

        // Assert
        expect(act).toThrow(TypeError)
        expect(act).toThrow('requestDependencies must resolve to an object')
        expect(factory).not.toHaveBeenCalled()
      },
    )

    it('should preserve a synchronous request dependency failure', () => {
      // Arrange
      const error = new Error('request dependency failed')
      const requestState = createRequestState([], {}, () => {
        throw error
      })

      // Act
      const act = () => REQUEST_CONTEXT_PREPARATION_WORK_HANDLER.begin(createWorkContext(requestState))

      // Assert
      expect(act).toThrow(error)
    })

    it('should preserve an asynchronous request dependency failure', async () => {
      // Arrange
      const error = new Error('async request dependency failed')
      const requestDependencies = vi.fn(() => Promise.reject(error))
      const requestState = createRequestState([], {}, requestDependencies)

      // Act
      const act = REQUEST_CONTEXT_PREPARATION_WORK_HANDLER.begin(createWorkContext(requestState))

      // Assert
      await expect(act).rejects.toBe(error)
      expect(requestDependencies).toHaveBeenCalledOnce()
    })

    it('should bind standalone function entries during context preparation', () => {
      // Arrange
      const packageDependencies = { suffix: '-ready' }
      const factory = vi.fn(
        (dependencies: typeof packageDependencies) => (value: unknown) => `${String(value)}${dependencies.suffix}`,
      )
      const entry = transformer<typeof packageDependencies>('AddSuffix', { factory })
      const functionBuilder = new FunctionEntryRegistry<typeof packageDependencies>()
      functionBuilder.collectListed(entry)
      const requestState = createRequestState([functionBuilder], packageDependencies)

      // Act
      REQUEST_CONTEXT_PREPARATION_WORK_HANDLER.begin(createWorkContext(requestState))

      // Assert
      expect(factory).toHaveBeenCalledOnce()
      expect(requestState.functionRegistry.get('AddSuffix')?.evaluate('case')).toBe('case-ready')
    })

    it('should fail context preparation with function diagnostics when a factory throws', () => {
      // Arrange
      const functionBuilder = new TransformerRegistry()
      functionBuilder.register('Broken', () => {
        throw new Error('boom')
      })
      const requestState = createRequestState([functionBuilder], {})

      // Act
      const act = () => REQUEST_CONTEXT_PREPARATION_WORK_HANDLER.begin(createWorkContext(requestState))

      // Assert
      expect(act).toThrow('Function preparation failed')

      try {
        act()
      } catch (error) {
        const [buildError] = (error as AggregateError).errors

        expect(buildError).toMatchObject({
          functionName: 'Broken',
          functionType: 'function.entry.transformer',
        })
      }
    })
  })
})

function createRequestState(
  functionBuilders: readonly FunctionRegistryBuilder[],
  packageDependencies: unknown,
  requestDependencies?: () => object | PromiseLike<object>,
  adapterDependencies?: object,
): RequestState {
  return createTestRequestState(createRuntimeContext(), {
    functionBuilders,
    packageDependencies,
    adapterDependencies,
    requestDependencies,
  })
}

function createRuntimeContext(data: Record<string, unknown> = {}): RuntimeContext {
  return {
    request: {
      url: '',
      path: '',
      method: '',
      location: { origin: '', href: '', pathname: '', basePath: '' },
      headers: {},
      cookies: {},
      state: {},
      params: {},
      query: {},
      post: {},
      session: {},
    },
    domain: { data, answers: {} },
    evaluation: {},
  }
}

function createWorkContext(
  requestState: RequestState,
): WorkContextContract<RequestState, RequestContextPreparationWorkProps> {
  return {
    state: requestState,
    props: {
      compiledStaticData: () => ({}),
      snapshot: {
        nodeId: 'journey::step',
        location: {
          origin: 'https://example.com',
          href: 'https://example.com/form/step',
          pathname: '/form/step',
          basePath: '/form',
        },
        method: 'GET',
        headers: {},
        cookies: {},
        state: {},
        params: {},
        query: {},
        post: {},
        session: undefined,
      },
    },
    withWork: vi.fn(),
  }
}
