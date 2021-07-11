import _ from 'lodash'
import Joi from 'joi'
import { validateSignature, signMessage } from './utils.js'

import { logger, colorizeTransactionManager } from './logger.js'

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

      const prevOutput = this.getOutputFromUTXO({ UTXO, txid, index })

      if (!prevOutput) {
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
      this.logger('Transaction failed signature validation')
      return false
    }

    this.logger(`Successfully validated transaction's signatures`)
    return true
  }

  validateTransactionSchema(transaction) {
    const schemaValidation = transactionSchema.validate(transaction)
    if (schemaValidation.error) {
      this.logger('Transaction schema validation failed', transaction, schemaValidation.error)
      return false
    }

    this.logger('Successfully validated transaction schema', transaction)
    return true
  }

  validateTransactionConservation({ UTXO, transaction }) {
    let inputAmount = 0
    let outputAmount = 0
    transaction.inputs.forEach(input => {
      const txid = input.outpoint.txid
      const index = input.outpoint.index

      const prevOutput = this.getOutputFromUTXO({ UTXO, txid, index })

      if (!prevOutput) {
        return
      }
      inputAmount += prevOutput.value
    })

    transaction.outputs.forEach(output => {
      outputAmount += output.value
    })

    if (inputAmount < outputAmount) {
      this.logger('This transaction does not satisfy the law of conservation')
      return false
    }

    this.logger(`Successfully validated transaction' s law of conservation`, transaction)
    return true
  }

  validateTransaction({ UTXO, transaction }) {
    this.logger('Validating transaction', transaction)
    const isValid = _.every([
      this.validateTransactionSchema(transaction),
      this.validateTransactionSignatures({ UTXO, transaction }),
      this.validateTransactionConservation({ UTXO, transaction })
    ], validation => {
      return validation
    })


    if (!isValid) {
      this.logger('Failed to validate the transaction', transaction)
      return false
    }

    this.logger('Successfully validated the transaction', transaction)
    return true
  }

  getOutputFromUTXO({ UTXO, txid, index }) {
    let outputObject = null

    try {
      outputObject = UTXO[txid][index]
    } catch {
      this.logger('Could not find output object in UTXO')
      return false
    }

    if (!outputObject) {
      this.logger('Could not find output object in UTXO')
      return false
    }

    return outputObject
  }

  createTransaction({ keyPair, wallet, UTXO, receiverPublicKey, amount }) {
    this.logger('Creating a transaction')
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
      this.logger(`This transaction has change (${amountLeft} picabus)`)
      transactionToSign.outputs.push({
        pubkey: keyPair.publicKey,
        value: totalAmount - amount
      })
    } else {
      this.logger('This transaction does not have change')
    }

    const signedTransaction = _.cloneDeep(transactionToSign)

    transactionToSign.inputs.forEach((input, inputIndex) => {
      signedTransaction.inputs[inputIndex].sig = signMessage({ message: transactionToSign, privateKey: keyPair.privateKey })
    })

    this.logger('The transaction was signed')

    return new Transaction(signedTransaction)
  }

  logger(message, ...args) {
    logger.info(`${colorizeTransactionManager()}: ${message}`, ...args)
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
