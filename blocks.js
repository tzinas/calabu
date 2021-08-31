import Joi from 'joi'
import sha256 from 'sha256'
import _ from 'lodash'
import canonicalize from './canonicalize.js'
import { logger, colorizeBlockManager } from './logger.js'
import { TransactionManager } from './transactions.js'

const TARGET_T = '00000002af000000000000000000000000000000000000000000000000000000'
const GENESIS_BLOCK_HASH = '00000000a420b7cefa2b7730243316921ed59ffe836e111ca3801f82a4f5360e'
const promiseWaitTimeout = 50000

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
  transactionManager

  constructor() {
    this.logger = this.logger.bind(this)
    this.transactionManager = new TransactionManager
  }

  async validateBlockTransactions({ block, requestObject, addPendingObjectRequest, UTXO }) {
    let currentUTXO = _.clone(UTXO)

    for (const txid of block.txids) {
      this.logger('Requesting transaction: %O', txid)
      requestObject(txid)

      this.logger('Creating promise for transaction: %O', txid)
      try {
        const transaction = await new Promise((resolve, reject) => {
          this.logger('Adding pending object request for transaction: %O', txid)
          addPendingObjectRequest({ id: txid, resolve })
  
          setTimeout(() => {
            reject(new Error('Timeout waiting for transaction: %O', txid));
          }, promiseWaitTimeout)
        })
        this.logger('Got this transaction: %O', transaction)
        this.logger('Current UTXO: %O', currentUTXO)

        const isTransactionValid = this.transactionManager.validateTransaction({ UTXO: currentUTXO, transaction })
        if (!isTransactionValid) {
          this.logger('Failed block transaction validation')
          return false
        }
        currentUTXO = this.transactionManager.getNewUTXO({ UTXO: currentUTXO, transaction })
        this.logger('New UTXO: %O', currentUTXO)
      } catch (e) {
        this.logger('There was an error with transaction: %O', txid)
        this.logger('Failed block transaction validation')
        return false
      }
    }

    this.logger('Block transactions successfully validated')
    return true
  }

  getBlockObject(block) {
    return {
      type: 'block',
      txids: block.txids,
      nonce: block.nonce,
      previd: block.previd,
      created: block.created,
      T: block.T,
      miner: block.miner,
      note: block.note
    }
  }

  getBlockHash(block) {
    const blockObject = this.getBlockObject(block)
    return sha256(canonicalize(blockObject))
  }

  validatePoW(block) {
    const blockHash = this.getBlockHash(block)
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

    this.logger('Successfully validated block schema for block: %O', this.getBlockHash(block))
    return true
  }

  isGenesisBlock(block) {
    const blockObject = this.getBlockObject(block)
    const blockHash = sha256(canonicalize(blockObject))

    if (blockHash === GENESIS_BLOCK_HASH) {
      this.logger('Found the genesis block')
    }

    return blockHash === GENESIS_BLOCK_HASH
  }

  async validateBlock({ block, requestObject, addPendingObjectRequest }) {
    this.logger('Now validating block: %O', block)
    if (this.isGenesisBlock(block)) {
      return {}
    }

    this.logger('Requesting previous block: %O', block.previd)

    if (!block.previd) {
      this.logger('Wrong genesis block: %O', this.getBlockHash(block))
      return false
    }

    requestObject(block.previd)

    this.logger('Creating promise for previous block: %O', block.previd)
    let previousBlock

    try {
      previousBlock = await new Promise((resolve, reject) => {
        this.logger('Adding pending object request for previous block: %O', block.previd)
        addPendingObjectRequest({ id: block.previd, resolve })

        setTimeout(() => {
          reject(new Error('Timeout waiting for previous block: %O', block.previd));
        }, promiseWaitTimeout)
      })
      this.logger('Got this previous block: %O', previousBlock)
    } catch (e) {
      this.logger('There was an error with the promise of the previous block: %O', block.previd)
      return false
    }


    const currentUTXO = await this.validateBlock({ block: previousBlock, requestObject, addPendingObjectRequest })

    if (!currentUTXO) {
      this.logger('Failed validation for block: %O', this.getBlockHash(block))
      return false
    }

    const isValid = _.every([
      this.validateBlockSchema(block),
      //this.validatePoW(block),
      await this.validateBlockTransactions({ block, requestObject, addPendingObjectRequest, UTXO: currentUTXO }),
    ], validation => {
      return validation
    })

    if (!isValid) {
      this.logger('Failed validation for block: %O', this.getBlockHash(block))
      return false
    }

    this.logger('Successfully validated block: %O', this.getBlockHash(block))
    return true
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
