import { BlockManager, Block } from '../blocks.js'
import { logger } from '../logger'

const GENESIS_BLOCK = new Block({
  T: "00000002af000000000000000000000000000000000000000000000000000000",
  created: 1624219079,
  miner: "dionyziz",
  nonce: "0000000000000000000000000000000000000000000000000000002634878840",
  note: "The Economist 2021-06-20: Crypto-miners are probably to blame for the graphics-chip shortage",
  previd: null,
  txids: [],
  type: "block"
})

beforeAll(() => {
  logger.transports.forEach(transport => {
    transport.silent = true
  })
})


test('validate correct block schema', () => {
  const blockManager = new BlockManager()

  const isValid = blockManager.validateBlockSchema(GENESIS_BLOCK)

  expect(isValid).toBe(true)
})

test('validate PoW', () => {
  const blockManager = new BlockManager()

  const isValid = blockManager.validatePoW(GENESIS_BLOCK)

  expect(isValid).toBe(true)
})

test('validate is genesis block', () => {
  const blockManager = new BlockManager()

  const isValid = blockManager.isGenesisBlock(GENESIS_BLOCK)

  expect(isValid).toBe(true)
})
