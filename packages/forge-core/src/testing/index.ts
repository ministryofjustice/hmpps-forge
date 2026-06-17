export { ForgeTestClient } from './ForgeTestClient'
export { ForgeTestHarness } from './ForgeTestHarness'
export { createTestPackage } from './createTestPackage'
export type { TestPackageOptions } from './createTestPackage'
export type { TestRequestOptions, TestResult, TestRenderResult, TestRedirectResult } from './types'

// TODO: restore when work descriptor tracing is implemented
export type RequestTraceEvent = {
  trace: { phases: { units: { kind: string; answers?: Record<string, unknown> }[] }[] }
}
