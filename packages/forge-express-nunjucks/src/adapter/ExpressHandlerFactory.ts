import type express from 'express'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import type {
  ForgeOutcome,
  ForgeRenderer,
  ForgeRoute,
  Logger,
  ResponseBindings,
} from '@ministryofjustice/hmpps-forge/core/framework'
import { extractPathname } from './routePath'
import ExpressSnapshotFactory from './ExpressSnapshotFactory'

export default class ExpressHandlerFactory {
  static create(
    forge: Forge,
    route: ForgeRoute,
    logger: Logger | Console,
    renderer: ForgeRenderer<unknown>,
    adapterDependencies?: object,
    requestDependencies?: (request: express.Request) => object | PromiseLike<object>,
  ): express.RequestHandler {
    return async (req, res, next) => {
      const requestPath = extractPathname(req.originalUrl ?? req.path)

      logger.debug(`${req.method} request to step at path ${requestPath}`)

      try {
        const snapshot = ExpressSnapshotFactory.create(route, req, res)
        const responseBindings = this.createResponseBindings(res)
        const outcome = await forge.execute({
          snapshot,
          responseBindings,
          renderer,
          ...(adapterDependencies === undefined ? {} : { adapterDependencies }),
          ...(requestDependencies === undefined ? {} : { requestDependencies: () => requestDependencies(req) }),
        })

        this.commitOutcome(outcome, res, next)
      } catch (error) {
        next(error)
      }
    }
  }

  private static createResponseBindings(res: express.Response): ResponseBindings {
    return {
      setHeader(name, value) {
        res.setHeader(name, value)
      },
      setCookie(name, value, options) {
        res.cookie(name, value, options ?? {})
      },
    }
  }

  private static commitOutcome(
    outcome: ForgeOutcome<unknown>,
    res: express.Response,
    next: express.NextFunction,
  ): void {
    if (outcome.kind === 'navigate') {
      res.redirect(outcome.url)

      return
    }

    if (outcome.kind === 'error') {
      const status = outcome.error.status ?? outcome.error.statusCode ?? 500

      next(this.toHttpError(status, outcome.error))

      return
    }

    if (!outcome.output) {
      next(this.toHttpError(500, new Error('Render outcome produced no output - renderer not bound')))

      return
    }

    res.type('html').send(outcome.output)
  }

  /**
   * Express's final handler and error middleware read `status`/`statusCode` to pick the response
   * code, and `expose` to decide whether `err.message` is shown in production. Both status
   * properties are set because middleware is split on which one it reads.
   */
  private static toHttpError(status: number, error: Error): Error {
    return Object.assign(error, { status, statusCode: status, expose: status < 500 })
  }
}
