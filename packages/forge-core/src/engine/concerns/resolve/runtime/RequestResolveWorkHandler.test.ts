import { describe, expect, it, vi } from 'vitest'
import { NO_OP_RESPONSE_BINDINGS } from '../../../../framework/types/responseBindings.type'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import WorkTaskFactory from '../../../runtime/evaluation/work/WorkTaskFactory'
import { REQUEST_RESOLVE_WORK_HANDLER } from './RequestResolveWorkHandler'
import { RESOLVE_BLOCKS_KIND } from './ResolveBlocksWorkHandler'
import type { CompiledResolveContext } from '../../../contracts/compiled/compiledContexts.type'
import type { CompiledResolveFunction } from '../../../contracts/compiled/compiledFunctions.type'
import type { RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import type { RequestResolveWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type { StepValidationFailure } from '../../../contracts/runtime/evaluationState.type'
import type { CompletedWork, WorkContextContract } from '../../../contracts/runtime/work.type'

function createRequestContext(
  failure: StepValidationFailure,
): WorkContextContract<RequestExecutionContext, RequestResolveWorkProps> {
  const compiled: CompiledResolveFunction = vi.fn(
    (_ctx: CompiledResolveContext): Awaited<ReturnType<CompiledResolveFunction>> =>
      WorkTaskFactory.resolveBlocks([], {}, []) as unknown as Awaited<ReturnType<CompiledResolveFunction>>,
  )
  const request: RequestExecutionContext = {
    context: {
      request: {
        url: '/step',
        path: '/step',
        method: 'POST',
        location: {
          origin: 'https://example.test',
          href: 'https://example.test/step',
          pathname: '/step',
          basePath: '',
        },
        headers: {},
        cookies: {},
        state: {},
        params: {},
        query: {},
        post: {},
        session: {},
      },
      domain: { data: {}, answers: {} },
      evaluation: {},
    },
    responseBindings: NO_OP_RESPONSE_BINDINGS,
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
    hasRenderer: false,
    traceEnabled: false,
    currentPageValidation: {
      isValid: false,
      fieldFailures: [failure],
      domainFailures: [],
    },
    buildStepValidation: () => undefined,
  }

  return {
    request,
    props: {
      compiled,
      path: '/step',
    },
    withWork: () => createRequestContext(failure),
  }
}

describe('REQUEST_RESOLVE_WORK_HANDLER', () => {
  describe('begin()', () => {
    it('should pass field failures keyed by block ID to compiled resolve', async () => {
      // Arrange
      const failure: StepValidationFailure = {
        blockId: 'compiled:template:1:0',
        blockCode: 'name',
        passed: false,
        message: 'Enter a name',
        submissionOnly: true,
        groups: ['default'],
      }
      const ctx = createRequestContext(failure)

      // Act
      await REQUEST_RESOLVE_WORK_HANDLER.begin(ctx)

      // Assert
      const compiled = ctx.props.compiled

      expect(compiled).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldFailures: {
            'compiled:template:1:0': [
              {
                blockCode: 'name',
                passed: false,
                message: 'Enter a name',
                submissionOnly: true,
                groups: ['default'],
              },
            ],
          },
        }),
      )
      expect(compiled).not.toHaveBeenCalledWith(
        expect.objectContaining({
          fieldFailures: expect.objectContaining({ name: expect.any(Array) }),
        }),
      )
    })

    it('should create the anchors record and share it with compiled resolve and the request', async () => {
      // Arrange
      const failure: StepValidationFailure = {
        blockId: 'compiled:template:1:0',
        blockCode: 'name',
        passed: false,
        message: 'Enter a name',
        submissionOnly: true,
        groups: ['default'],
      }
      const ctx = createRequestContext(failure)

      // Act
      await REQUEST_RESOLVE_WORK_HANDLER.begin(ctx)

      // Assert
      expect(ctx.request.fieldFailureAnchors).toEqual({})
      expect(ctx.props.compiled).toHaveBeenCalledWith(
        expect.objectContaining({ fieldFailureAnchors: ctx.request.fieldFailureAnchors }),
      )
    })
  })

  describe('complete()', () => {
    function createResolvedBlocksChild(): CompletedWork {
      return {
        key: 'resolve',
        kind: RESOLVE_BLOCKS_KIND,
        output: { ancestors: [], step: { path: '/step' }, blocks: [] },
        children: [],
      }
    }

    it('should attach the recorded anchor to each field validation error', async () => {
      // Arrange
      const failure: StepValidationFailure = {
        blockId: 'compiled:template:1:0',
        blockCode: 'employed',
        passed: false,
        message: 'Select an answer',
        submissionOnly: false,
        groups: ['default'],
      }
      const ctx = createRequestContext(failure)

      ctx.request.fieldFailureAnchors = { 'compiled:template:1:0': 'employed-unavailable' }

      // Act
      const output = await REQUEST_RESOLVE_WORK_HANDLER.complete!(ctx, [createResolvedBlocksChild()])

      // Assert
      if (output.action !== 'render') {
        throw new Error('Expected a render outcome')
      }

      expect(output.renderContext.fieldValidationErrors).toEqual([
        {
          blockCode: 'employed',
          passed: false,
          message: 'Select an answer',
          submissionOnly: false,
          groups: ['default'],
          anchor: 'employed-unavailable',
        },
      ])
    })

    it('should omit the anchor when no anchor was recorded for the failing block', async () => {
      // Arrange
      const failure: StepValidationFailure = {
        blockId: 'compiled:template:1:0',
        blockCode: 'employed',
        passed: false,
        message: 'Select an answer',
        submissionOnly: false,
        groups: ['default'],
      }
      const ctx = createRequestContext(failure)

      ctx.request.fieldFailureAnchors = {}

      // Act
      const output = await REQUEST_RESOLVE_WORK_HANDLER.complete!(ctx, [createResolvedBlocksChild()])

      // Assert
      if (output.action !== 'render') {
        throw new Error('Expected a render outcome')
      }

      expect(output.renderContext.fieldValidationErrors).toEqual([
        {
          blockCode: 'employed',
          passed: false,
          message: 'Select an answer',
          submissionOnly: false,
          groups: ['default'],
        },
      ])
    })
  })
})
