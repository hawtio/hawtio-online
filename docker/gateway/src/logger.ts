import pino from 'pino'
import * as pinoms from 'pino-multi-stream'
import expressPinoLogger from 'express-pino-logger'
import * as fs from 'fs'

const streams = [
  { stream: process.stdout },
  { stream: fs.createWriteStream('gateway-api.log', { flags: 'a' }) },
]

export const logger = pino({ level: process.env.LOG_LEVEL || 'info' }, pinoms.multistream(streams))
export const expressLogger = expressPinoLogger(logger)
