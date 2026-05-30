import Forge from '../engine/Forge'
import type { ForgeFunctionImplementations, ForgePackageRegistration } from '../engine/contracts/ast/engine.type'
import type { ComponentRegistryEntry } from '../components/types/components.type'
import type { BlockDefinition } from '../components/types/structures.type'
import type { TestRouter } from './types'
import TestFrameworkAdapter from './TestFrameworkAdapter'
import type { TestFrameworkAdapterBuilder } from './TestFrameworkAdapter'
import { ForgeTestClient } from './ForgeTestClient'

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as Console

/**
 * Convenience wrapper for testing Forge journeys without boilerplate.
 *
 * Wires up the test adapter and a silent logger internally so tests
 * only need to register packages and call `createClient()`.
 *
 * @example
 * ```typescript
 * const client = new ForgeTestHarness()
 *   .registerGlobalComponents(govukComponents)
 *   .registerPackage({ journey: myJourney, functions: myEffects }, deps)
 *   .createClient()
 *
 * const result = await client.get('/my-journey/step-one', { session: {} })
 * expect(result.type).toBe('render')
 * ```
 */
export class ForgeTestHarness {
  private readonly adapter: TestFrameworkAdapterBuilder

  private readonly forge: Forge

  constructor() {
    this.adapter = TestFrameworkAdapter.configure()
    this.forge = new Forge({
      frameworkAdapter: this.adapter,
      logger: silentLogger,
    })
  }

  registerGlobalComponents(components: ComponentRegistryEntry<BlockDefinition>[]): this {
    this.forge.registerGlobalComponents(components)

    return this
  }

  registerGlobalFunctions<TDeps>(functions: ForgeFunctionImplementations<TDeps>, deps?: TDeps): this {
    this.forge.registerGlobalFunctions(functions, deps)

    return this
  }

  registerPackage<TDeps>(pkg: ForgePackageRegistration<TDeps>, deps?: TDeps): this {
    this.forge.registerPackage(pkg, deps)

    return this
  }

  createClient(): ForgeTestClient {
    return this.adapter.createClient(this.forge.getRouter() as TestRouter)
  }
}
