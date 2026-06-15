import type { FunctionRegistryEntry } from '../../../../authoring/types/functions.type'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import type TraceRecorder from './TraceRecorder'
import { measureAsync } from './TraceRecorder'

export default class TracingFunctionRegistry extends FunctionRegistry {
  constructor(
    private readonly functionRegistry: FunctionRegistry,
    private readonly trace: TraceRecorder,
  ) {
    super()
  }

  override get(name: string): FunctionRegistryEntry | undefined {
    const entry = this.functionRegistry.get(name)

    if (!entry?.isAsync) {
      return entry
    }

    return {
      ...entry,
      evaluate: (...args: Parameters<FunctionRegistryEntry['evaluate']>) =>
        measureAsync(this.trace, { kind: 'async-function', name }, () => entry.evaluate(...args)),
    }
  }

  override has(name: string): boolean {
    return this.functionRegistry.has(name)
  }

  override getAll(): Map<string, FunctionRegistryEntry> {
    return this.functionRegistry.getAll()
  }

  override size(): number {
    return this.functionRegistry.size()
  }
}
