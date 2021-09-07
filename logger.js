import * as winston from 'winston'
const { transports, createLogger } = winston.default
const { combine, colorize, splat, timestamp, printf } = winston.default.format

const formatter = printf(
  info => {
		return `${info.timestamp} ${info.level}: ${info.message}`
	}
)

export const logger = createLogger({
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

const orange = '\x1B[38;2;255;207;84m'
const aqua = '\x1B[38;2;61;255;155m'
const purple = '\x1B[38;2;207;135;255m'
const blue = '\x1B[38;2;66;176;255m'
const red = '\x1B[38;2;255;66;82m'

const end = '\x1B[39m'

export const colorizeAddress = (address) => {
	return orange + address + end
}

export const colorizedPeerManager = () => {
	return aqua + '$calabu_peer_manager' + end
}

export const colorizeObjectManager = () => {
	return purple + '$calabu_object_manager' + end
}

export const colorizeTransactionManager = () => {
	return blue + '$calabu_transaction_manager' + end
}

export const colorizeBlockManager = () => {
	return red + '$calabu_block_manager' + end
}
export const colorizeBlockchainManager = () => {
	return red + '$calabu_blockchain_manager' + end
}
