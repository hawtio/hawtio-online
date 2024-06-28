import pino from 'pino'
import pinoHttpLogger from 'pino-http'

const level = process.env.LOG_LEVEL || 'info'

export const logger = pino({ level: level })
export const expressLogger = pinoHttpLogger({ logger: logger })
