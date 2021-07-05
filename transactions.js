import _ from 'lodash'
import Joi from 'joi'
import { validateSignature, signMessage } from './utils.js'
import keyManager from './keys.js'

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
        return false
      }

      return true

    })

    if (!isValid) {
      logger.info('Transaction failed signature validation', transaction)
      return false
    }

    logger.info(`Successfully validated transaction's signatures`, transaction)
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
    logger.info('Validating transaction', transaction)
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

  getOutputFromUTXO({ UTXO, txid, index }) {
    let outputObject = null

    try {
      outputObject = UTXO[txid][index]
    } catch {
      logger.info('Could not find output object in UTXO')
      return false
    }

    if (!outputObject) {
      logger.info('Could not find output object in UTXO')
      return false
    }

    return outputObject
  }

  createTransaction({ keyPair, wallet, UTXO, receiverPublicKey, amount }) {
    logger.info('Creating a transaction')
    const transactionToSign = {
      type: 'transaction',
      inputs: [],
      outputs: []
    }

    let totalAmount = 0
    wallet[keyPair.publicKey].forEach(output => {
      const outputFromUTXO = this.getOutputFromUTXO({ UTXO, ...output})

      transactionToSign.inputs.push({
        outpoint: {
          ...output
        },
        sig: null
      })

      totalAmount += outputFromUTXO.value
    })

    const amountLeft = totalAmount - amount

    if (amountLeft < 0) {
      logger.warn('Not enough balance to make the transaction')
      throw 'not-enough-balance'
    }

    transactionToSign.outputs.push({
      pubkey: receiverPublicKey,
      value: amount
    })

    if (amountLeft > 0) {
      logger.info(`This transaction has change (${amountLeft} picabus)`)
      transactionToSign.outputs.push({
        pubkey: keyPair.publicKey,
        value: totalAmount - amount
      })
    } else {
      logger.info('This transaction does not have change')
    }

    const signedTransaction = _.cloneDeep(transactionToSign)

    transactionToSign.inputs.forEach((input, inputIndex) => {
      signedTransaction.inputs[inputIndex].sig = signMessage({ message: transactionToSign, privateKey: keyPair.privateKey })
    })

    logger.info('The transaction was signed')

    return new Transaction(signedTransaction)
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
