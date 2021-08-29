import Joi from 'joi'
import sha256 from 'sha256'
import _ from 'lodash'
import canonicalize from './canonicalize.js'
import { logger, colorizeBlockManager } from './logger.js'

const TARGET_T = '00000002af000000000000000000000000000000000000000000000000000000'
const transactionWaitTimeout = 50000

const blockSchema = Joi.object({
  txids: Joi.array().items(Joi.string().hex()),
  nonce: Joi.string().hex(),
  previd: Joi.string().hex().allow(null),
  created: Joi.number().integer(),
  T: Joi.string().valid(TARGET_T),
  miner: Joi.string().optional(),
  note: Joi.string().optional()
})

export class BlockManager {
  constructor() {
    this.logger = this.logger.bind(this)
  }

  async validateBlockTransactions({ block, requestObject, addPendingTransactionRequest }) {
    block.txids.map(async txid => {
      this.logger('Requesting transaction: %O', txid)
      requestObject(txid)

      this.logger('Creating promise for transaction: %O', txid)
      try {
        const transaction = await new Promise((resolve, reject) => {
          this.logger('Adding pending object request for transaction: %O', txid)
          addPendingTransactionRequest({ txid, resolve })
  
          setTimeout(() => {
            reject(new Error('Timeout waiting for transaction: %O', txid));
          }, transactionWaitTimeout)
        })
        this.logger('Got this transaction: %O', transaction)
      } catch (e) {
        this.logger('There was an error with the promise of transaction: %O', txid)
      }

    })
  }

  validatePoW(block) {
    const blockObject = {
      type: 'block',
      txids: block.txids,
      nonce: block.nonce,
      previd: block.previd,
      created: block.created,
      T: block.T,
      miner: block.miner,
      note: block.note
    }

    const blockHash = sha256(canonicalize(blockObject))
    this.logger('Block hash is: %O', blockHash)


    if (blockHash >= TARGET_T) {
      this.logger('Block does not satisfy PoW')
      return false
    }

    this.logger('Block satisfies PoW')
    return true
  }

  validateBlockSchema(block) {
    const schemaValidation = blockSchema.validate(block)
    if (schemaValidation.error) {
      this.logger('Block schema validation failed with error: %O', schemaValidation.error)
      return false
    }

    this.logger('Successfully validated block schema')
    return true
  }

  async validateBlock({ block, requestObject, addPendingTransactionRequest }) {
    const isValid = _.every([
      this.validateBlockSchema(block),
      //this.validatePoW(block),
      await this.validateBlockTransactions({ block, requestObject, addPendingTransactionRequest })
    ], validation => {
      return validation
    })
  }

  logger(message, ...args) {
    logger.info(`${colorizeBlockManager()}: ${message}`, ...args)
  }
}

export class Block {
  txids = []
  nonce
  previd
  created
  T
  miner
  note

  constructor(block) {
    this.txids = block.txids
    this.nonce = block.nonce
    this.previd = block.previd
    this.created = block.created
    this.T = block.T
    this.miner = block.miner
    this.note = block.note
  }
}
