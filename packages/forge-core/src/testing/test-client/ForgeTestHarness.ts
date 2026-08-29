import Forge from '../../engine/Forge'
import type { ForgePackageRegistration } from '../../engine/chassis/contracts/ast/engine.type'
import type { ForgeInstrumentationOptions } from '../../engine/chassis/tracing/ForgeTraceSinkDispatcher'
import type { Logger } from '../../framework/types/adapter.type'
import type { ForgeRenderer } from '../../framework/types/rendering.type'
import { ForgeTestClient } from './ForgeTestClient'

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as Console

export interface ForgeTestHarnessOptions {
  readonly instrumentation?: ForgeInstrumentationOptions
  readonly maxIteratorIterations?: number
  readonly strictRegistration?: boolean
  readonly logger?: Logger | Console
  readonly basePath?: string
}

/**
 * Convenience wrapper for testing Forge journeys without boilerplate.
 *
 * Wires up the test adapter and a silent logger internally so tests
 * only need to register packages and call `createClient()`.
 *
 * @example
 * ```typescript
 * const client = new ForgeTestHarness()
 *   .registerPackage(createForgePackage({ journey: myJourney, functions: myEffects }), deps)
 *   .createClient()
 *
 * const result = await client.get('/my-journey/step-one', { session: {} })
 * expect(result.type).toBe('render')
 * ```
 */
export class ForgeTestHarness {
  private readonly forge: Forge

  constructor(options: ForgeTestHarnessOptions = {}) {
    this.forge = new Forge({
      logger: options.logger ?? silentLogger,
      instrumentation: options.instrumentation,
      maxIteratorIterations: options.maxIteratorIterations,
      strictRegistration: options.strictRegistration ?? true,
      basePath: options.basePath ?? '',
    })
  }

  registerPackage<TDeps>(pkg: ForgePackageRegistration<TDeps>, deps?: TDeps): this {
    this.forge.registerPackage(pkg, deps)

    return this
  }

  createClient(renderer?: ForgeRenderer<unknown>): ForgeTestClient {
    return new ForgeTestClient(this.forge, renderer)
  }
}
