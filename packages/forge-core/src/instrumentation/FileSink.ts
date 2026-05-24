import { appendFileSync } from 'fs'
import type { ForgeInstrumentationSink, ForgeSpan } from './types'

export default class FileSink implements ForgeInstrumentationSink {
  private readonly filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
  }

  record(span: ForgeSpan): void {
    const serialised = JSON.stringify(span, (_key, value) => {
      if (value instanceof Error) {
        return { name: value.name, message: value.message, stack: value.stack }
      }

      return value
    })

    appendFileSync(this.filePath, `${serialised}\n`, 'utf8')
  }
}
