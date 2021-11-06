import _ from 'lodash'
import Joi from 'joi'
import sha256 from 'sha256'

import canonicalize from './canonicalize.js'
import { validateSignature, signMessage } from './utils.js'

import { logger, colorizeTransactionManager } from './logger.js'
import { ObjectManager } from './objects.js'

const COINBASE_BASE_AMOUNT = 50 * (10 ** 12)

const transactionSchema = Joi.object({
  inputs: Joi.array().items(Joi.object({
    outpoint: Joi.object({
      txid: Joi.string().hex().required(),
      index: Joi.number().integer().min(0).required()
    }).required(),
    sig: Joi.string().hex().required()
  })).required(),
  outputs: Joi.array().items(Joi.object({
    pubkey: Joi.string().hex().required(),
    value: Joi.number().integer().unsafe().min(0).required()
  })).required()
})

const coinbaseTransactionSchema = Joi.object({
  outputs: Joi.array().length(1).items(Joi.object({
    pubkey: Joi.string().hex().required(),
    value: Joi.number().integer().unsafe().min(0).required()
  })).required(),
  height: Joi.number().integer().min(1).required()
})

export class TransactionManager {
  objectManager

  constructor() {
    this.objectManager = new ObjectManager()
  }

  getTransactionObject(transaction) {
    const transactionObject =  {
      type: 'transaction',
      outputs: transaction.outputs
    }

    if (transaction.inputs) {
      transactionObject.inputs = transaction.inputs
    }

    return transactionObject
  }

  getTransactionHash(transaction) {
    const transactionObject = this.getTransactionObject(transaction)
    return sha256(canonicalize(transactionObject))
  }

  validateTransactionSignatures({ UTXO, transaction }) {
    const messageObject = {
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

      const isValidSignature = validateSignature({ message: messageObject, signature: input.sig,
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
    for (const input of transaction.inputs) {
      const txid = input.outpoint.txid
      const index = input.outpoint.index

      const prevOutput = this.getOutputFromUTXO({ UTXO, txid, index })

      if (!prevOutput) {
        return false
      }

      inputAmount += prevOutput.value
    }

    transaction.outputs.forEach(output => {
      outputAmount += output.value
    })

    if (inputAmount < outputAmount) {
      this.logger('This transaction does not satisfy the law of conservation')
      return false
    }

    const fee = inputAmount - outputAmount

    this.logger(`Successfully validated law of conservation with fee ${fee} picabus`)
    return { fee }
  }

  getNewUTXO({ UTXO, transaction }) {
    const newUTXO = _.cloneDeep(UTXO)

    if (transaction.inputs) {
      transaction.inputs.forEach(input => {
        const txid = input.outpoint.txid
        const index = input.outpoint.index

        try {
          delete newUTXO[txid][index]

          if (_.isEmpty(newUTXO[txid])) {
            delete newUTXO[txid]
          }
        } catch {
          return false
        }
      })
    }

    const transactionObject = this.getTransactionObject(transaction)
    const transactionId = this.objectManager.getObjectHash(transactionObject)

    transaction.outputs.forEach((output, outputIndex) => {
      if (!newUTXO[transactionId]) {
        newUTXO[transactionId] = {}
      }

      newUTXO[transactionId][outputIndex] = output
    })

    return newUTXO
  }

  validateTransaction({ UTXO, transaction }) {
    this.logger('Validating transaction', transaction)

    if (!this.validateTransactionSchema(transaction)) {
      return false
    }

    if (!this.validateTransactionSignatures({ UTXO, transaction })) {
      return false
    }

    if (!this.validateTransactionConservation({ UTXO, transaction })) {
      return false
    }

    this.logger('Successfully validated the transaction', transaction)
    return true
  }

  validateCoinbaseTransactionSchema(coinbaseTransaction) {
    const schemaValidation = coinbaseTransactionSchema.validate(coinbaseTransaction)
    if (schemaValidation.error) {
      this.logger('Coinbase transaction schema validation failed: %O', schemaValidation.error)
      return false
    }

    this.logger('Successfully validated coinbase transaction schema')
    return true
  }

  validateCoinbaseAmount({ coinbaseTransaction, normalTransactions, UTXO }) {
    this.logger('Validating coinbase amount')

    const output = coinbaseTransaction.outputs[0]
    const coinbaseAmount = output.value
    let expectedAmount = COINBASE_BASE_AMOUNT

    let currentUTXO = _.cloneDeep(UTXO)

    for (const transaction of normalTransactions) {
      if (!this.validateTransactionSchema(transaction)) {
        this.logger(`Can not get transaction's fee`)
        return false
      }

      const transactionConservation = this.validateTransactionConservation({ UTXO: currentUTXO, transaction })

      if (!transactionConservation) {
        this.logger(`Transaction's fee is a negative number`)
        return false
      }

      expectedAmount += transactionConservation.fee
      currentUTXO = this.getNewUTXO({ UTXO: currentUTXO, transaction })
    }

    if (expectedAmount < coinbaseAmount) {
      this.logger('Coinbase amount is higher than it should be')
      return false
    }

    this.logger('Successfully validated coinbase amount')
    return true
  }

  validateCoinbaseHeight(coinbaseTransaction, height) {
    if (coinbaseTransaction.height !== height) {
      return false
    }

    return true
  }

  validateCoinbaseTransaction({ coinbaseTransaction, normalTransactions, UTXO, height }) {
    this.logger('Validating coinbase transaction')

    if (!this.validateCoinbaseTransactionSchema(coinbaseTransaction)) {
      return false
    }

    if (!this.validateCoinbaseHeight(coinbaseTransaction, height)) {
      return false
    }

    if (!this.validateCoinbaseAmount({ coinbaseTransaction, normalTransactions, UTXO })) {
      return false
    }

    this.logger('Successfully validated coinbase transaction')
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

  createCoinbase({ receiverPublicKey, blockTransactions }) {
  }

  createTransaction({ keyPair, UTXO, receiverPublicKey, amount, fee }) {
    this.logger('Creating a transaction')
    const transactionToSign = {
      type: 'transaction',
      inputs: [],
      outputs: []
    }

    let totalAmount = 0
    for (const [txid, outputs] of Object.entries(UTXO)) {
      for (const [index, output] of Object.entries(outputs)) {
        if (output.pubkey !== keyPair.publicKey) {
          continue
        }

        transactionToSign.inputs.push({
          outpoint: {
            txid,
            index
          },
          sig: null
        })

      totalAmount += output.value
      }
    }

    let amountLeft = totalAmount - amount

    if (fee) {
      amountLeft -= fee
    }

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
        value: amountLeft
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
  outputs

  constructor(transaction) {
    if (transaction?.inputs) {
      this.inputs = transaction.inputs.map(input => input)
    }
    if (transaction?.height) {
      this.height = transaction.height
    }
    this.outputs = transaction.outputs.map(output => output)
  }
}
