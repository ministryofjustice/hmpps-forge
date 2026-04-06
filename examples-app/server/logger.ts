import { pino } from 'pino'
import config from './config'

const logger = pino({
  name: 'HMPPS Forge Examples App',
  level: config.logLevel,
  transport: config.production
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true },
      },
})

export default logger
