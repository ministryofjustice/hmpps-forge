import { DateGenerators } from './dateGenerators'
import { FormatGenerators } from './formatGenerators'
import { FunctionEntryRegistry } from '../../../authoring/functions/FunctionEntryRegistry'

// TypeScript declaration emit drops JSDoc when it structurally expands a type
// imported from another file, so the built .d.ts would lose every per-function
// doc comment. Annotating with `typeof` references makes the emitter print a
// reference instead of expanding, keeping the docs on each group's own declaration.
interface GeneratorGroups {
  /** Generators for producing formatted string values */
  FormatString: typeof FormatGenerators.FormatString

  /** Generators for producing date values */
  Date: typeof DateGenerators
}

export const Generator: GeneratorGroups = {
  /** Generators for producing formatted string values */
  FormatString: FormatGenerators.FormatString,

  /** Generators for producing date values */
  Date: DateGenerators,
}

export const GeneratorsRegistry = (() => {
  const entryRegistry = new FunctionEntryRegistry()
  const generatorGroups = [FormatGenerators, DateGenerators]

  generatorGroups.forEach(entries => Object.values(entries).forEach(entry => entryRegistry.collectListed(entry)))

  return entryRegistry.build()
})()
