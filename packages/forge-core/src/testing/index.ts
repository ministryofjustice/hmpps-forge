export { ForgeTestClient } from './test-client/ForgeTestClient'
export { ForgeTestHarness } from './test-client/ForgeTestHarness'
export { FunctionRegistryTestHarness } from './functions/FunctionRegistryTestHarness'
export { ComponentRegistryTestHarness } from './components/ComponentRegistryTestHarness'
export { expectRenderOutcome, expectRedirectOutcome, expectErrorOutcome } from './assertions/outcomeAssertions'
export { default as ForgeTestOutcomeAssertionError } from './assertions/ForgeTestOutcomeAssertionError'
export { createTestEffectContext, TestEffectContext } from './functions/createTestEffectContext'
export type { EffectContextSeed } from './functions/createTestEffectContext'
export type {
  TestErrorResult,
  TestRequestOptions,
  TestResult,
  TestRenderResult,
  TestRedirectResult,
} from './test-client/testResult.type'
export type { ForgeTestHarnessOptions } from './test-client/ForgeTestHarness'
export type { ComponentTestError, FieldComponentTestInvocation } from './components/ComponentRegistryTestHarness'
export type {
  RequestTrace,
  RequestTraceEvent,
  RequestTracePhase,
  RequestTraceUnit,
} from '../engine/chassis/contracts/runtime/trace.type'
export type {
  CompilationTrace,
  CompilationTraceError,
  CompilationTraceEvent,
  CompilationTracePhase,
} from '../engine/chassis/contracts/compilation/trace.type'
export type { SerializedTraceSpan } from '../engine/chassis/tracing/traceSpan.type'
