import RegistrationErrorFormatter from '../engine/errors/RegistrationErrorFormatter'
import type { ForgeInstrumentationForgeOptions } from './ForgeInstrumentation'
import type { ForgeInstrumentationSink, ForgeSpan } from './types'
import { ForgeSpanStatus } from './types'

export default class LoggerSink implements ForgeInstrumentationSink {
  private readonly forgeOptions: ForgeInstrumentationForgeOptions

  constructor(forgeOptions: ForgeInstrumentationForgeOptions) {
    this.forgeOptions = forgeOptions
  }

  record(span: ForgeSpan): void {
    if (span.name !== 'journey-registration') {
      return
    }

    if (span.status === ForgeSpanStatus.ERROR) {
      if (!this.forgeOptions.strictRegistration) {
        this.forgeOptions.logger.error(RegistrationErrorFormatter.format(span.error))
      }

      return
    }

    this.forgeOptions.logger.info(
      { journey: span.attributes.journeyCode, routes: span.attributes.routeCount },
      `Forge: Registered journey '${span.attributes.journeyTitle}' with ${span.attributes.routeCount} routes`,
    )
  }
}
