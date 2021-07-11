import Joi from 'joi'

import { createKeyPair, signMessage, validateSignature } from '../utils.js'
import { logger } from '../logger'


beforeAll(() => {
  logger.transports.forEach(transport => {
    transport.silent = true
  })
})

test('create key pair', () => {
  const keyPairSchema = Joi.object({
    publicKey: Joi.string().hex(),
    privateKey: Joi.string().hex(),
  })

	const keyPair = createKeyPair()
  const schemaValidation = keyPairSchema.validate(keyPair)

  const isValid = true
  if (schemaValidation.error) {
    isValid = false
  }

  expect(isValid).toBe(true)
})

test('sign message', () => {
  const signedMessage = signMessage({
    privateKey: '3a79fe29aa2bd873095bf15961444ebe68231c819755555cba38a2c1b1261aac17768eb427f119ce295711f8297b24f1750f1acd617ae860e0bd7155286b9e5e',
    message: 'hello'
  })

  const signedMessageSchema = Joi.string().hex()
  const schemaValidation = signedMessageSchema.validate(signedMessage)

  const isValid = true
  if (schemaValidation.error) {
    isValid = false
  }

  expect(isValid).toBe(true)
})

test('sign message and validate it', () => {
  const signedMessage = signMessage({
    privateKey: 'b8a4eb6b6cb68b833a00e691e8dc9fe70ef55374d7588aeb838ef9431ba136a46a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5',
    message: 'hello'
  })

  const isValid = validateSignature({
    message: 'hello',
    signature: signedMessage,
    publicKey: '6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5'
  })

  expect(isValid).toBe(true)
})
