import * as winston from 'winston'
const { transports, createLogger } = winston.default
const { combine, colorize, splat, timestamp, printf } = winston.default.format

const formatter = printf(
  info =>
  `${info.timestamp} ${info.level}: ${info.message}`+(info.splat!==undefined?`${info.splat}`:" ")
)

const logger = createLogger({
	level: 'debug',
	format: combine(
	  splat(),
	  colorize(),
	  timestamp({
	    format: 'YYYY-MM-DD HH:mm:ss'
	  }),
	  formatter
	),
	transports: [
	  //
	  // - Write all logs with level `error` and below to `error.log`
	  // - Write all logs with level `info` and below to `combined.log`
	  //
	  new transports.File({ filename: 'error.log', level: 'error' }),
	  new transports.File({ filename: 'combined.log' }),
	  new transports.Console()
	],
})

export default logger
