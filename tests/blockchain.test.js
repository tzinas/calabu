import _ from 'lodash'
import net from 'net'

import { BlockchainManager } from '../blockchain'
import { Block, BlockManager } from '../blocks'
import { logger } from '../logger'
import { ConnectedPeer, PeerManager } from '../peers.js'
import { TransactionManager, Transaction } from '../transactions.js'

const transactionManager = new TransactionManager
const blockManager = new BlockManager()

beforeAll(() => {
  logger.transports.forEach(transport => {
    transport.silent = true
  })
})

logger.transports.forEach(transport => {
  transport.silent = true
})

let UTXO = {}

//publicKey: 6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5
//privateKey: b8a4eb6b6cb68b833a00e691e8dc9fe70ef55374d7588aeb838ef9431ba136a46a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5

//publicKey: 1d5d5d4fc6688588dbfc57f0544bc2eda44ceed7afe4299eba2cd811e6f1dbbb
//privateKey: 4addab16b2ff83f1b407c72f6c0a3c7ed281f43632ee7ed62eacfc30422412261d5d5d4fc6688588dbfc57f0544bc2eda44ceed7afe4299eba2cd811e6f1dbbb

const COINBASE_1 =  new Transaction({ type: "transaction", outputs: [{ pubkey: "6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5", value: 50 * 10**12 + 200 }] })
UTXO = transactionManager.getNewUTXO({ UTXO, transaction: COINBASE_1 })

const TRANSACTION_1 = transactionManager.createTransaction({
  keyPair: {
    publicKey: '6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5',
    privateKey: 'b8a4eb6b6cb68b833a00e691e8dc9fe70ef55374d7588aeb838ef9431ba136a46a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5'
  },
  UTXO,
  receiverPublicKey: '1d5d5d4fc6688588dbfc57f0544bc2eda44ceed7afe4299eba2cd811e6f1dbbb',
  amount: 3000000,
  fee: 200
})
UTXO = transactionManager.getNewUTXO({ UTXO, transaction: TRANSACTION_1 })

const TRANSACTION_2 = transactionManager.createTransaction({
  keyPair: {
    publicKey: '1d5d5d4fc6688588dbfc57f0544bc2eda44ceed7afe4299eba2cd811e6f1dbbb',
    privateKey: '4addab16b2ff83f1b407c72f6c0a3c7ed281f43632ee7ed62eacfc30422412261d5d5d4fc6688588dbfc57f0544bc2eda44ceed7afe4299eba2cd811e6f1dbbb'
  },
  UTXO,
  receiverPublicKey: '6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5',
  amount: 200000,
  fee: 200
})

const GENESIS_BLOCK = new Block({ "T": "00000002af000000000000000000000000000000000000000000000000000000", "created": 1624219079, "miner": "dionyziz", "nonce": "0000000000000000000000000000000000000000000000000000002634878840", "note": "The Economist 2021-06-20: Crypto-miners are probably to blame for the graphics-chip shortage", "previd": null, "txids": [], "type": "block" })
const BLOCK_1 = new Block({ "type": "block", "txids": [transactionManager.getTransactionHash(COINBASE_1), transactionManager.getTransactionHash(TRANSACTION_1)], "nonce": "312cb872ce00a3b16df299614", "previd": "00000000a420b7cefa2b7730243316921ed59ffe836e111ca3801f82a4f5360e", "created": 1624219080, "T": "00000002af000000000000000000000000000000000000000000000000000000" })
const BLOCK_2 = new Block({ "type": "block", "txids": [transactionManager.getTransactionHash(TRANSACTION_2)], "nonce": "1adfa12cabb872ce016df299614", "previd": blockManager.getBlockHash(BLOCK_1), "created": 1624219081, "T": "00000002af000000000000000000000000000000000000000000000000000000" })
const BLOCK_3 = new Block({ "type": "block", "txids": [transactionManager.getTransactionHash(COINBASE_1), transactionManager.getTransactionHash(TRANSACTION_1)], "nonce": "8531872ce00a3b16df299614", "previd": "00000000a420b7cefa2b7730243316921ed59ffe836e111ca3801f82a4f5360e", "created": 1624219079, "T": "00000002af000000000000000000000000000000000000000000000000000000" })

const requestObject = async (objectId) => {
  if (objectId === blockManager.getBlockHash(GENESIS_BLOCK)) {
    return GENESIS_BLOCK
  }

  if (objectId === blockManager.getBlockHash(BLOCK_1)) {
    return BLOCK_1
  }

  if (objectId === blockManager.getBlockHash(BLOCK_2)) {
    return BLOCK_2
  }

  if (objectId === blockManager.getBlockHash(BLOCK_3)) {
    return BLOCK_3
  }

  if (objectId === transactionManager.getTransactionHash(COINBASE_1)) {
    return COINBASE_1
  }

  if (objectId === transactionManager.getTransactionHash(TRANSACTION_1)) {
    return TRANSACTION_1
  }

  if (objectId === transactionManager.getTransactionHash(TRANSACTION_2)) {
    return TRANSACTION_2
  }
}

test('find correct ancestor block', async () => {
  const blockchainManager = new BlockchainManager()

  const blockchain = new Set([blockManager.getBlockHash(GENESIS_BLOCK), blockManager.getBlockHash(BLOCK_1), blockManager.getBlockHash(BLOCK_2)])

  const ancestor = await blockchainManager.getFirstAncestorBlock({ blockchain, otherBlock: BLOCK_3, requestObject })

  const isValid = blockManager.getBlockHash(GENESIS_BLOCK) === blockManager.getBlockHash(ancestor)

  expect(isValid).toBe(true)
})

test('find correct height of block', async () => {
  const blockchainManager = new BlockchainManager()

  const blockHeight = await blockchainManager.getBlockHeight({ knownHeightBlock: BLOCK_2, ancestorBlockHash: blockManager.getBlockHash(GENESIS_BLOCK), knownHeight: 3, requestObject })

  expect(blockHeight).toBe(1)
})

test('remove blocks from blockchain before block', async () => {
  const blockchainManager = new BlockchainManager()

  const blockchain = new Set([blockManager.getBlockHash(GENESIS_BLOCK), blockManager.getBlockHash(BLOCK_1), blockManager.getBlockHash(BLOCK_2)])
  const expectedBlockchain = new Set([blockManager.getBlockHash(GENESIS_BLOCK)])

  const newBlockchain = await blockchainManager.removeOrAddBlocksBefore({ type: 'remove', fromBlock: BLOCK_2, beforeBlockHash: blockManager.getBlockHash(GENESIS_BLOCK), blockchain, requestObject })

  expect(_.isEqual(newBlockchain, expectedBlockchain)).toBe(true)
})

test('change to longest chain', async () => {
  const blockchainManager = new BlockchainManager()

  // longest chain
  await blockchainManager.handleNewValidBlock({ validBlock: BLOCK_3, requestObject })
  expect(blockchainManager.chainTip).toBe(blockManager.getBlockHash(BLOCK_3))
  expect(blockchainManager.chainHeight).toBe(2)
  expect(_.isEqual(blockchainManager.blockchain, new Set([blockManager.getBlockHash(GENESIS_BLOCK), blockManager.getBlockHash(BLOCK_3)]))).toBe(true)

  // equal length chain
  await blockchainManager.handleNewValidBlock({ validBlock: BLOCK_1, requestObject })
  expect(blockchainManager.chainTip).toBe(blockManager.getBlockHash(BLOCK_3))
  expect(blockchainManager.chainHeight).toBe(2)
  expect(_.isEqual(blockchainManager.blockchain, new Set([blockManager.getBlockHash(GENESIS_BLOCK), blockManager.getBlockHash(BLOCK_3)]))).toBe(true)

  // equal length chain
  await blockchainManager.handleNewValidBlock({ validBlock: BLOCK_2, requestObject })
  expect(blockchainManager.chainTip).toBe(blockManager.getBlockHash(BLOCK_2))
  expect(blockchainManager.chainHeight).toBe(3)
  expect(_.isEqual(blockchainManager.blockchain, new Set([blockManager.getBlockHash(GENESIS_BLOCK),blockManager.getBlockHash(BLOCK_1), blockManager.getBlockHash(BLOCK_2)]))).toBe(true)
})

describe('tests with sockets', () => {
  let clientSocket, connectedPeer

  beforeEach(async () => {
    const blockchainManager = new BlockchainManager()
    const peerManager = new PeerManager({ blockchainManager })

    clientSocket = new net.Socket()
    connectedPeer = new ConnectedPeer({ socket: clientSocket, peerManager })
  })

  test('get correct chain tip and set blockchain', async () => {
    await connectedPeer.handleChainTip({ blockId: blockManager.getBlockHash(BLOCK_3), requestObject })
    expect(connectedPeer.peerManager.blockchainManager.chainTip).toBe(blockManager.getBlockHash(BLOCK_3))
    expect(connectedPeer.peerManager.blockchainManager.chainHeight).toBe(2)
    expect(_.isEqual(connectedPeer.peerManager.blockchainManager.blockchain, new Set([blockManager.getBlockHash(GENESIS_BLOCK),blockManager.getBlockHash(BLOCK_3)]))).toBe(true)

    await connectedPeer.handleChainTip({ blockId: blockManager.getBlockHash(BLOCK_2), requestObject })
    expect(connectedPeer.peerManager.blockchainManager.chainTip).toBe(blockManager.getBlockHash(BLOCK_2))
    expect(connectedPeer.peerManager.blockchainManager.chainHeight).toBe(3)
    expect(_.isEqual(connectedPeer.peerManager.blockchainManager.blockchain, new Set([blockManager.getBlockHash(GENESIS_BLOCK),blockManager.getBlockHash(BLOCK_1), blockManager.getBlockHash(BLOCK_2)]))).toBe(true)
  })

  afterEach(() => {
    clientSocket.destroy()
  })
})
