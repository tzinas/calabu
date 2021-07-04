import ed25519 from 'ed25519'
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
