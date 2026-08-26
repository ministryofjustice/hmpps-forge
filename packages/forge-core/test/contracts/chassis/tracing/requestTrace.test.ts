import { describe, expect, it } from 'vitest'
import { createForgePackage } from '../../../../src/authoring'
import { ForgeTestHarness, type RequestTraceEvent } from '../../../../src/testing'
import type { ForgeRenderer } from '../../../../src/framework/types/rendering.type'
import type {
  RequestTraceUnit,
  RuntimeContextSnapshotTrace,
} from '../../../../src/engine/chassis/contracts/runtime/trace.type'
import { createTracedClient, createTracedRenderClient } from '../../contractHelpers'
import {
  accessErrorJourney,
  branchedSubmitJourney,
  formJourney,
  hiddenBlockJourney,
  thrownErrorJourney,
  thrownStatusJourney,
} from './requestTrace.fixtures'

const STEP_GET_PHASES = [
  'context-preparation',
  'access',
  'answer-preparation',
  'validities',
  'reachability',
  'answer-cleardown',
  'entry-validation',
  'route-tree',
  'resolve',
]

const passthroughRenderer: ForgeRenderer<unknown> = {
  renderBlock: (entry, block) => entry.render(block),
  wrapNestedBlock: (block, output) => ({ block, html: output }),
  assemblePage: (_context, renderedBlocks) => renderedBlocks.join(''),
}

function phaseNames(event: RequestTraceEvent): string[] {
  return event.trace.phases.map(phase => phase.phase)
}

function contextSnapshotOf(event: RequestTraceEvent, phaseName: string): RuntimeContextSnapshotTrace {
  const snapshot = event.trace.phases.find(phase => phase.phase === phaseName)?.units.find(isContextSnapshot)

  if (snapshot === undefined) {
    throw new Error(`No context snapshot recorded for phase "${phaseName}"`)
  }

  return snapshot
}

function isContextSnapshot(unit: RequestTraceUnit): unit is RuntimeContextSnapshotTrace {
  return unit.kind === 'context-snapshot'
}

function flattenUnits(units: readonly RequestTraceUnit[]): RequestTraceUnit[] {
  return units.flatMap(unit => [unit, ...flattenUnits(unit.children)])
}

describe('request trace contracts', () => {
  describe('event delivery', () => {
    it('should emit one trace event carrying the request snapshot and route context when a step renders', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(formJourney, traces)

      // Act
      const result = await client.get('/trace-form/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')
      expect(traces).toHaveLength(1)
      expect(traces[0].trace.outcome).toBe('render')
      expect(traces[0].snapshot.method).toBe('GET')
      expect(traces[0].route).toEqual({
        journeyCode: 'trace-form',
        routeTemplatePath: '/trace-form/form',
        journeyTitle: 'Trace Form',
        stepTitle: 'Form',
      })
    })

    it('should deliver request traces only to sinks whose shouldTrace accepts the request', async () => {
      // Arrange
      const accepted: RequestTraceEvent[] = []
      const declined: RequestTraceEvent[] = []
      const client = new ForgeTestHarness({
        instrumentation: {
          sinks: [
            { onRequestTrace: event => accepted.push(event), shouldTrace: () => true },
            { onRequestTrace: event => declined.push(event), shouldTrace: () => false },
          ],
        },
      })
        .registerPackage(createForgePackage({ journey: formJourney }))
        .createClient()

      // Act
      await client.get('/trace-form/form', { session: {} })

      // Assert
      expect(accepted).toHaveLength(1)
      expect(declined).toHaveLength(0)
    })
  })

  describe('phases', () => {
    it('should record the step GET phases in pipeline order ending at resolve when no renderer is supplied', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(formJourney, traces)

      // Act
      await client.get('/trace-form/form', { session: {} })

      // Assert
      expect(phaseNames(traces[0])).toEqual(STEP_GET_PHASES)
    })

    it('should run submit in place of entry-validation and halt there when a valid POST redirects', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(formJourney, traces)

      // Act
      const result = await client.post('/trace-form/form', { session: {}, body: { name: 'Ada' } })

      // Assert
      expect(result.type).toBe('redirect')
      expect(phaseNames(traces[0])).toEqual([
        'context-preparation',
        'access',
        'answer-preparation',
        'validities',
        'reachability',
        'answer-cleardown',
        'submit',
      ])
      // TODO: Probably should record redirect targets at one resolution level —
      // the projector copies result.target verbatim, so a submit-hook redirect
      // traces the authored goto ('done') while a reachability redirect traces
      // the resolved path ('/trace-form/form'). Asserting only "defined" here
      // until that is settled; then pin the exact target.
      expect(traces[0].trace.outcome).toBe('redirect')
      expect(traces[0].trace.redirect).toBeDefined()
    })

    it('should append a render phase after resolve when a renderer is supplied', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedRenderClient(formJourney, passthroughRenderer, traces, [])

      // Act
      const result = await client.get('/trace-form/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')
      expect(phaseNames(traces[0])).toEqual([...STEP_GET_PHASES, 'render'])
    })

    it('should append a context-snapshot unit to every completed phase', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(formJourney, traces)

      // Act
      await client.get('/trace-form/form', { session: {} })

      // Assert
      traces[0].trace.phases.forEach(phase => {
        const lastUnit = phase.units[phase.units.length - 1]

        expect(lastUnit.kind).toBe('context-snapshot')
        expect(lastUnit.key).toBe(`after-${phase.phase}`)
      })
    })

    it('should freeze each phase snapshot at completion so submitted answers appear only from answer-preparation onward', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(formJourney, traces)

      // Act
      await client.post('/trace-form/form', { session: {}, body: { name: 'Ada' } })

      // Assert
      const afterAccess = contextSnapshotOf(traces[0], 'access')
      const afterPreparation = contextSnapshotOf(traces[0], 'answer-preparation')

      expect(afterAccess.answers.name).toBeUndefined()
      expect(afterPreparation.answers.name.current).toBe('Ada')
      expect(afterPreparation.answers.name.mutations).toContainEqual({ value: 'Ada', source: 'post' })
    })

    it('should record execution slices and self duration on request phase units', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(formJourney, traces)

      // Act
      await client.get('/trace-form/form', { session: {} })

      // Assert
      const resolveUnit = traces[0].trace.phases
        .find(phase => phase.phase === 'resolve')
        ?.units.find(unit => unit.kind === 'resolve.blocks')

      expect(resolveUnit).toBeDefined()

      if (resolveUnit !== undefined && !isContextSnapshot(resolveUnit)) {
        expect(resolveUnit.selfDurationMs).toBeTypeOf('number')
        expect(resolveUnit.executionSlices?.length).toBeGreaterThan(0)
        resolveUnit.executionSlices?.forEach(slice => {
          expect(slice.completedAtMs).toBeGreaterThanOrEqual(slice.startedAtMs)
        })
      }
    })
  })

  describe('outcomes', () => {
    it('should stop at reachability and record the redirect target when the journey path is requested', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(formJourney, traces)

      // Act
      const result = await client.get('/trace-form', { session: {} })

      // Assert
      expect(result.type).toBe('redirect')
      expect(phaseNames(traces[0])).toEqual([
        'context-preparation',
        'access',
        'answer-preparation',
        'validities',
        'reachability',
      ])
      expect(traces[0].trace.outcome).toBe('redirect')
      expect(traces[0].trace.redirect?.target).toBe('/trace-form/form')
      expect(traces[0].route?.routeTemplatePath).toBe('/trace-form')
    })

    it('should record an error outcome with status and message when an access hook raises an error outcome', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(accessErrorJourney, traces)

      // Act
      const result = await client.get('/access-error-trace/form', { session: {} })

      // Assert
      expect(result.type).toBe('error')
      expect(traces[0].trace.outcome).toBe('error')
      expect(traces[0].trace.error).toEqual({ status: 403, message: 'No access' })
      expect(phaseNames(traces[0])).toEqual(['context-preparation', 'access'])
    })

    it('should include a reachability projection covering every journey step when reachability has run', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(formJourney, traces)

      // Act
      await client.get('/trace-form/form', { session: {} })

      // Assert
      const reachability = traces[0].trace.reachability

      expect(reachability).toBeDefined()
      expect(reachability?.steps.map(step => step.routeTemplatePath)).toEqual(['/trace-form/form', '/trace-form/done'])
      expect(reachability?.steps.every(step => typeof step.isReachable === 'boolean')).toBe(true)
      expect(reachability?.steps.find(step => step.routeTemplatePath === '/trace-form/form')?.isEntryPoint).toBe(true)
      expect(reachability?.currentStepId).toBeDefined()
    })
  })

  describe('thrown errors', () => {
    it('should emit an error trace with message and stack when a pipeline phase throws', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(thrownErrorJourney, traces)

      // Act
      const result = await client.get('/thrown-error-trace/form', { session: {} })

      // Assert
      expect(result.type).toBe('error')
      expect(traces).toHaveLength(1)
      expect(traces[0].trace.outcome).toBe('error')
      // The runtime wraps thrown evaluator errors, so the trace message carries
      // both the wrapper and the original text.
      expect(traces[0].trace.error?.message).toContain('Failed to evaluate compiled Forge hooks function')
      expect(traces[0].trace.error?.message).toContain('Access hook exploded')
      expect(traces[0].trace.error?.stack).toContain('ForgeRuntimeEvaluationError')
    })

    it('should record the status carried by the thrown error when a hook throws an error with a status property', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(thrownStatusJourney, traces)

      // Act
      const result = await client.get('/thrown-status-trace/form', { session: {} })

      // Assert
      expect(result.type).toBe('error')
      expect(traces[0].trace.error?.status).toBe(418)
      expect(traces[0].trace.error?.message).toContain('Access hook rejected')
    })

    it('should end the phase list at the incomplete failing phase when the pipeline throws', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(thrownErrorJourney, traces)

      // Act
      await client.get('/thrown-error-trace/form', { session: {} })

      // Assert
      expect(phaseNames(traces[0])).toEqual(['context-preparation', 'access'])
      expect(traces[0].trace.phases[0].completedAtMs).toBeDefined()
      expect(traces[0].trace.phases[1].completedAtMs).toBeUndefined()
    })

    it('should append a synthetic context-snapshot to the failing phase when the pipeline throws', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(thrownErrorJourney, traces)

      // Act
      await client.get('/thrown-error-trace/form', { session: {} })

      // Assert
      // The access phase never completed, so its snapshot cannot come from the
      // usual phase-completion capture — it is synthesized from the live
      // context at failure time.
      const accessPhase = traces[0].trace.phases.find(phase => phase.phase === 'access')
      const lastUnit = accessPhase?.units[accessPhase.units.length - 1]

      expect(accessPhase?.completedAtMs).toBeUndefined()
      expect(lastUnit?.kind).toBe('context-snapshot')
      expect(lastUnit?.key).toBe('after-access')
    })
  })

  describe('hidden units', () => {
    it('should omit hidden blocks from the render phase units when visibleWhen is false', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedRenderClient(hiddenBlockJourney, passthroughRenderer, traces, [])

      // Act
      const result = await client.get('/hidden-block-trace/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.output).toBe('<static>Visible</static>')
      }

      const renderBlocksUnit = traces[0].trace.phases
        .find(phase => phase.phase === 'render')
        ?.units.find(unit => unit.kind === 'render.render-blocks')

      expect(renderBlocksUnit).toBeDefined()
      // Two blocks entered the phase, but only the visible one keeps its unit.
      expect(renderBlocksUnit?.beginFields.blocks).toBe(2)
      expect(renderBlocksUnit?.children).toHaveLength(1)
      expect(renderBlocksUnit?.children[0].kind).toBe('render.render-blocks.block')
    })

    it('should omit unselected submit branch units from the submit phase trace', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(branchedSubmitJourney, traces)

      // Act
      const result = await client.post('/branched-submit-trace/form', { session: {}, body: { name: 'Ada' } })

      // Assert
      expect(result.type).toBe('redirect')

      const submitPhase = traces[0].trace.phases.find(phase => phase.phase === 'submit')
      const branchNames = flattenUnits(submitPhase?.units ?? [])
        .filter(unit => unit.kind === 'submit.branch')
        .map(unit => unit.beginFields.name)

      // The hook authored both branches; the unselected onInvalid one drops its unit.
      expect(branchNames).toEqual(['onValid'])
    })
  })

  describe('trace suppression', () => {
    it("should emit no request trace when every sink's shouldTrace declines the request", async () => {
      // Arrange
      const firstDeclined: RequestTraceEvent[] = []
      const secondDeclined: RequestTraceEvent[] = []
      const client = new ForgeTestHarness({
        instrumentation: {
          sinks: [
            { onRequestTrace: event => firstDeclined.push(event), shouldTrace: () => false },
            { onRequestTrace: event => secondDeclined.push(event), shouldTrace: () => false },
          ],
        },
      })
        .registerPackage(createForgePackage({ journey: formJourney }))
        .createClient()

      // Act
      const result = await client.get('/trace-form/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')
      expect(firstDeclined).toHaveLength(0)
      expect(secondDeclined).toHaveLength(0)
    })

    it('should serve the request normally when no instrumentation sinks are configured', async () => {
      // Arrange
      const client = new ForgeTestHarness()
        .registerPackage(createForgePackage({ journey: formJourney }))
        .createClient()

      // Act
      const rendered = await client.get('/trace-form/form', { session: {} })
      const redirected = await client.post('/trace-form/form', { session: {}, body: { name: 'Ada' } })

      // Assert
      expect(rendered.type).toBe('render')
      expect(redirected.type).toBe('redirect')
    })
  })
})
