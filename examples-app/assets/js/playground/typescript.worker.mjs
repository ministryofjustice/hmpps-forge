import { initialize, TypeScriptWorker } from 'monaco-editor/language/typescript/ts.worker.js'

const supportedModules = new Set([
  '@ministryofjustice/hmpps-forge/core/authoring',
  '@ministryofjustice/hmpps-forge/core/components',
  '@ministryofjustice/hmpps-forge/govuk-components',
])
const preferences = {
  includeCompletionsForModuleExports: true,
  includeCompletionsWithInsertText: true,
  importModuleSpecifierPreference: 'relative',
  quotePreference: 'single',
}

self.onmessage = () => {
  initialize((context, configuration) => {
    const worker = new TypeScriptWorker(context, configuration)
    const languageService = worker.getLanguageService()

    return Object.assign(worker, {
      async getImportCompletions(fileName, position) {
        const projectRoot = fileName.match(/^file:\/\/\/playground\/[^/]+\//)?.[0]

        if (!projectRoot) {
          return []
        }

        const completions = languageService.getCompletionsAtPosition(fileName, position, preferences)

        return completions?.entries.filter(entry => entry.hasAction && (
          supportedModules.has(entry.source) || entry.data?.fileName?.startsWith(projectRoot)
        )) ?? []
      },

      async getImportCompletionDetails(fileName, position, entry) {
        return languageService.getCompletionEntryDetails(
          fileName,
          position,
          entry.name,
          { indentSize: 2, tabSize: 2, newLineCharacter: '\n', semicolons: 'remove' },
          entry.source,
          preferences,
          entry.data,
        )
      },
    })
  })
}
