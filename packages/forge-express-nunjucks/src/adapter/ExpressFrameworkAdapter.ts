import type express from 'express'
import type { Forge, ForgeRouterAdapter } from '@ministryofjustice/hmpps-forge/core'
import { createExpressRouter } from './createExpressRouter'
import type { ExpressForgeRouterOptions } from './createExpressRouter'

/**
 * @deprecated Build the router directly with `createExpressRouter(forge, options)`.
 */
export interface ExpressForgeAdapter extends ForgeRouterAdapter {
  build(forge: Forge): express.Router
}

/**
 * @deprecated Build the router directly with `createExpressRouter(forge, options)`.
 */
export const ExpressFrameworkAdapter = {
  configure(options: ExpressForgeRouterOptions): ExpressForgeAdapter {
    return {
      build: (forge: Forge) => createExpressRouter(forge, options),
    }
  },
}
