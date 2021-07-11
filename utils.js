import ed25519 from 'ed25519'
import crypto from 'crypto'
import _ from 'lodash'

import canonicalize from './canonicalize.js'

export const validateSignature = ({ message, signature, publicKey }) => {
	const messageToVerify = Buffer.from(canonicalize(message), 'utf8')
	const signatureToUse = Buffer.from(signature, 'hex')
	const publicKeyToUse = Buffer.from(publicKey, 'hex')

	if (ed25519.Verify(messageToVerify, signatureToUse, publicKeyToUse)) {
		return true
	}

	return false
}

export const signMessage = ({ privateKey, message }) => {
	const messageToSign = canonicalize(message)
	let signedMessage = ed25519.Sign(Buffer.from(messageToSign, 'utf8'), Buffer.from(privateKey, 'hex'))
	signedMessage = signedMessage.toString('hex')
	return signedMessage
}

export const createKeyPair = () => {
	const randomBytes = crypto.randomBytes(32)

	let keyPair = ed25519.MakeKeypair(randomBytes)
	keyPair = _.mapValues(keyPair, key => key.toString('hex'))

	return keyPair
}

export const isNormalInteger = str => {
	var n = Math.floor(Number(str))
	return n !== Infinity && String(n) === str && n >= 0 && n <= 49151
}
