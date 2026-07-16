import type { Environment } from 'nunjucks'
import { getErrorSummaryList } from './toErrorList'

export function registerNunjucksGlobals(nunjucksEnv: Environment): void {
  nunjucksEnv.addGlobal('getErrorSummaryList', getErrorSummaryList)
}
