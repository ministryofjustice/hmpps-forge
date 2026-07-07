import forgeCore from './forge-core/rolldown.config.mjs'
import forgeExpressNunjucks from './forge-express-nunjucks/rolldown.config.mjs'
import forgeGovukComponents from './forge-govuk-components/rolldown.config.mjs'
import forgeMojComponents from './forge-moj-components/rolldown.config.mjs'
import forgeDevtools from './forge-devtools/rolldown.config.mjs'
import { jsFormats, createIsExternal, createJsConfig } from './rolldown.shared.mjs'
import { createDtsConfig } from './rolldown.dts.mjs'

const packageConfigs = [forgeCore, forgeExpressNunjucks, forgeGovukComponents, forgeMojComponents, forgeDevtools]

const entrypoints = packageConfigs.flatMap(config => config.entrypoints)
const dtsOwnershipRules = packageConfigs.flatMap(config => config.dtsOwnershipRules)
const extraConfigs = packageConfigs.flatMap(config => config.extraConfigs)

const registry = Object.fromEntries(entrypoints.map(({ name, input }) => [name, input]))
const isExternal = createIsExternal(registry)

const jsConfigs = entrypoints.flatMap(({ name, input, jsPlugins = [] }) =>
  jsFormats.map(format => createJsConfig(name, input, format, isExternal, jsPlugins)),
)

export default [
  ...jsConfigs,
  createDtsConfig(registry, dtsOwnershipRules, isExternal),
  ...extraConfigs,
]
