import { BlockchainManager } from '../blockchain'
import { Block, BlockManager } from '../blocks'
import { logger } from '../logger'

const GENESIS_BLOCK = new Block({ "T": "00000002af000000000000000000000000000000000000000000000000000000", "created": 1624219079, "miner": "dionyziz", "nonce": "0000000000000000000000000000000000000000000000000000002634878840", "note": "The Economist 2021-06-20: Crypto-miners are probably to blame for the graphics-chip shortage", "previd": null, "txids": [], "type": "block" })
const BLOCK_1 = new Block({ "type": "block", "txids": [ "84685e2f0681e6cd36ca31e343168af24e135904dfdb41ac0652114522404e05", "99f6456367a15d538f3e3f3540a22a87777bd49838e2721b233760515a680374", "a26a7f74483170be3f34365ac1a09f5b5ebb17aeec1cd5baccb1fc17b9b0fb78" ], "nonce": "a", "previd": "00000000a420b7cefa2b7730243316921ed59ffe836e111ca3801f82a4f5360e", "created": "1622825642", "T": "00000002af000000000000000000000000000000000000000000000000000000" })
const BLOCK_2 = new Block({ "type": "block", "txids": [], "nonce": "first", "previd": "ec6d126b393fa7bcb2bd153e8b02f8ecf789aa08793847b67d32dd61c61a5d2b", "created": "1622825645", "T": "00000002af000000000000000000000000000000000000000000000000000000" })
const BLOCK_3 = new Block({ "type": "block", "txids": [], "nonce": "second", "previd": "00000000a420b7cefa2b7730243316921ed59ffe836e111ca3801f82a4f5360e", "created": "1622825645", "T": "00000002af000000000000000000000000000000000000000000000000000000" })

const blockManager = new BlockManager()

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
}

beforeAll(() => {
  logger.transports.forEach(transport => {
    transport.silent = true
  })
})

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
