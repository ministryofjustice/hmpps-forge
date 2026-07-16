import type { Environment } from 'nunjucks'
import { getErrorSummaryList } from './toErrorList'

export function registerForgeGovUKComponentsGlobals(nunjucksEnv: Environment): void {
  nunjucksEnv.addGlobal('getErrorSummaryList', getErrorSummaryList)
}
