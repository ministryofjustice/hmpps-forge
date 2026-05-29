import RegistrationErrorFormatter from '../engine/errors/RegistrationErrorFormatter'
import type { Logger } from '../framework/types/adapter.type'
import type { ForgeInstrumentationSink, ForgeSpan } from './types'
import { ForgeSpanStatus } from './types'

export default class LoggerSink implements ForgeInstrumentationSink {
  private readonly logger: Logger | Console

  constructor(logger: Logger | Console) {
    this.logger = logger
  }

  record(span: ForgeSpan): void {
    if (span.name !== 'journey-registration') {
      return
    }

    if (span.status === ForgeSpanStatus.ERROR) {
      this.logger.error(RegistrationErrorFormatter.format(span.error))

      return
    }

    this.logger.info(
      { journey: span.attributes.journeyCode, routes: span.attributes.routeCount },
      `Forge: Registered journey '${span.attributes.journeyTitle}' with ${span.attributes.routeCount} routes`,
    )
  }
}
