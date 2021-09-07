import Joi from 'joi'
import sha256 from 'sha256'
import _ from 'lodash'
import canonicalize from './canonicalize.js'
import { logger, colorizeBlockManager } from './logger.js'
import { TransactionManager } from './transactions.js'

const TARGET_T = '00000002af000000000000000000000000000000000000000000000000000000'
export const GENESIS_BLOCK_HASH = '00000000a420b7cefa2b7730243316921ed59ffe836e111ca3801f82a4f5360e'

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

    this.getBlockHash = this.getBlockHash.bind(this)
    this.getBlockObject = this.getBlockObject.bind(this)
  }

  async validateBlockTransactions({ block, requestObject, UTXO }) {
    let currentUTXO = _.clone(UTXO)

    const transactions = []

    for (const txid of block.txids) {
      this.logger('Requesting transaction: %O', txid)
      let transaction
      try {
        transaction = await requestObject(txid)
        this.logger('Got this transaction: %O', transaction)
        transactions.push(transaction)
      } catch (e) {
        this.logger('There was an error with transaction: %O', txid)
        this.logger('Failed block transaction validation')
        return false
      }
    }

    if (transactions.length === 0) {
      this.logger('No transactions in this block')
      return true
    }

    const coinbaseTransaction = transactions[0]

    if (this.transactionManager.validateCoinbaseTransactionSchema(coinbaseTransaction)) {
      this.logger('This block has a coinbase transaction')

      transactions.splice(0, 1) //remove the coinbase transaction from the rest of the transactions

      if (!this.transactionManager.validateCoinbaseTransaction({ coinbaseTransaction, normalTransactions: transactions, UTXO: currentUTXO })) {
        this.logger('Incorrect coinbase transaction for this block')
        return false
      }

      currentUTXO = this.transactionManager.getNewUTXO({ UTXO: currentUTXO, transaction: coinbaseTransaction })
      this.logger('New UTXO: %O', currentUTXO)

    } else {
      this.logger('This block does not have a coinbase transaction')
    }

    for (const transaction of transactions) {
      const isTransactionValid = this.transactionManager.validateTransaction({ UTXO: currentUTXO, transaction })
      if (!isTransactionValid) {
        this.logger('Failed block transaction validation')
        return false
      }

      currentUTXO = this.transactionManager.getNewUTXO({ UTXO: currentUTXO, transaction })
      this.logger('New UTXO: %O', currentUTXO)
    }

    this.logger('Block transactions successfully validated')
    return true
  }

  getBlockObject(block) {
    const blockObject = {
      type: 'block',
      txids: block.txids,
      nonce: block.nonce,
      previd: block.previd,
      created: block.created,
      T: block.T
    }

    if (block.miner) {
      blockObject.miner = block.miner
    }

    if (block.note) {
      blockObject.note = block.note
    }
    return blockObject
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

  async validateBlock({ block, requestObject }) {
    this.logger('Now validating block: %O', block)

    if (!this.validateBlockSchema(block)) {
      return false
    }

    if (this.isGenesisBlock(block)) {
      return {}
    }

    if (!block.previd) {
      this.logger('Wrong genesis block: %O', this.getBlockHash(block))
      return false
    }

    /*
    if (!this.validatePoW(block)) {
      return false
    }
    */

    this.logger('Requesting previous block: %O', block.previd)
    let previousBlock

    try {
      previousBlock = await requestObject(block.previd)
      this.logger('Got this previous block: %O', previousBlock)
    } catch (e) {
      this.logger('There was an error with the promise of the previous block: %O %O', block.previd, e)
      return false
    }

    const currentUTXO = await this.validateBlock({ block: previousBlock, requestObject })

    if (!currentUTXO) {
      this.logger('Failed validation for block: %O', this.getBlockHash(block))
      return false
    }


    if (!await this.validateBlockTransactions({ block, requestObject, UTXO: currentUTXO })) {
      this.logger('Failed transaction validation for block: %O', this.getBlockHash(block))
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
