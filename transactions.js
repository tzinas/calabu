import _ from 'lodash'
import Joi from 'joi'
import canonicalize from './canonicalize.js'
import { validateSignature } from './utils.js'

import logger from './logger.js'

const transactionSchema = Joi.object({
  inputs: Joi.array().items(Joi.object({
    outpoint: Joi.object({
      txid: Joi.string().hex(),
      index: Joi.number().integer().min(0)
    }),
    sig: Joi.string().hex()
  })),
  outputs: Joi.array().items(Joi.object({
    pubkey: Joi.string().hex(),
    value: Joi.number().integer().min(0)
  }))
})

export class TransactionManager {
  objectManager

  constructor(objectManager) {
    this.objectManager = objectManager
  }

  validateTransactionSignatures({ UTXO, transaction }) {
    const message = {
      type: 'transaction',
      inputs: transaction.inputs.map(input => ({outpoint: input.outpoint, sig: null })),
      outputs: transaction.outputs
    }

    const isValid = _.every(transaction.inputs, input => {
      const txid = input.outpoint.txid
      const index = input.outpoint.index

      let prevOutput = null
      try {
        prevOutput = UTXO[txid][index]
      } catch {
        logger.info('Could not find previous output txid', prevOutput)
        return false
      }

      if (!prevOutput) {
        logger.info('Could not find previous output index', prevOutput)
        return false
      }

      const isValidSignature = validateSignature({ message, signature: input.sig,
                                          publicKey: prevOutput.pubkey })

      if (!isValidSignature) {
        logger.info('Transaction failed signature validation', transaction)
        return false
      }

      logger.info(`Successfully validated transaction's signature`, transaction)
      return true

    })

    if (!isValid) {
      return false
    }

    return true
  }

  validateTransactionSchema(transaction) {
    const schemaValidation = transactionSchema.validate(transaction)
    if (schemaValidation.error) {
      logger.info('Transaction schema validation failed', transaction, schemaValidation.error)
      return false
    }

    logger.info('Successfully validated transaction schema', transaction)
    return true
  }

  validateTransaction({ UTXO, transaction }) {
    const isValid = _.every([
      this.validateTransactionSchema(transaction),
      this.validateTransactionSignatures({ UTXO, transaction })
    ], validation => {
      return validation
    })


    if (!isValid) {
      logger.info('Failed to validate the transaction', transaction)
      return false
    }

    logger.info('Successfully validated the transaction', transaction)
    return true
  }
}

export class Transaction {
  inputs
  outputs

  constructor(transaction) {
    this.inputs = transaction.inputs.map(input => input)
    this.outputs = transaction.outputs.map(output => output)
  }
}
