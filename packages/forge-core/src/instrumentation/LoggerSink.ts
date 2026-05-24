import RegistrationErrorFormatter from '../engine/errors/RegistrationErrorFormatter'
import type { Logger } from '../framework/types/adapter.type'
import { isForgeLifecycleEvent } from './typeguards'
import type { ForgeInstrumentationSink } from './types'

export default class LoggerSink implements ForgeInstrumentationSink {
  private readonly logger: Logger | Console

  constructor(logger: Logger | Console) {
    this.logger = logger
  }

  record(trace: unknown): void {
    if (!isForgeLifecycleEvent(trace)) {
      return
    }

    switch (trace.type) {
      case 'journey-registered':
        this.logger.info(
          { journey: trace.journeyCode, routes: trace.routeCount },
          `Forge: Registered journey '${trace.journeyTitle}' with ${trace.routeCount} routes`,
        )
        break
      case 'registration-error':
        this.logger.error(RegistrationErrorFormatter.format(trace.error))
        break
      default:
        break
    }
  }
}
