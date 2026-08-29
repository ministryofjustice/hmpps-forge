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

function createRequestState<TPackageDependencies>(
  functionBuilders: readonly FunctionRegistryBuilder<TPackageDependencies>[],
  packageDependencies: TPackageDependencies,
): RequestState {
  return createTestRequestState(createRuntimeContext(), { functionBuilders, packageDependencies })
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
