import pino from 'pino'
import pinoHttp from 'pino-http'

const level = process.env.LOG_LEVEL || 'info'

export const logger = pino({ level: level })
export const expressLogger = pinoHttp({ logger: logger as pino.Logger })
