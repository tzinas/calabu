import { BlockManager, GENESIS_BLOCK_HASH } from './blocks'
import { logger, colorizeBlockchainManager } from './logger.js'

export class BlockchainManager {
  chainTip = GENESIS_BLOCK_HASH
  chainHeight = 1
  blockchain = new Set([GENESIS_BLOCK_HASH])
  blockManager = new BlockManager()

  async getFirstAncestorBlock({ blockchain, otherBlock, requestObject }) {
    const otherBlockHash = this.blockManager.getBlockHash(otherBlock)
    if (blockchain.has(otherBlockHash)) {
      return otherBlock
    }

    let previousBlock
    try {
      previousBlock = await requestObject(otherBlock.previd)
      this.logger('Got this previous block: %O', previousBlock)
    } catch (e) {
      this.logger('There was an error getting the previous block: %O', e)
    }

    return this.getFirstAncestorBlock({ blockchain, otherBlock: previousBlock })
  }

  async getBlockHeight({ knownHeightBlock, ancestorBlockHash, knownHeight, requestObject }) {
    const knownHeightBlockHash = this.blockManager.getBlockHash(knownHeightBlock)
    if (knownHeightBlockHash === ancestorBlockHash) {
      return knownHeight
    }

    let previousBlock
    try {
      previousBlock = await requestObject(knownHeightBlock.previd)
      this.logger('Got this previous block: %O', previousBlock)
    } catch (e) {
      this.logger('There was an error getting the previous block: %O', e)
      return false
    }

    return await this.getBlockHeight({ knownHeightBlock: previousBlock, ancestorBlockHash, knownHeight: knownHeight - 1, requestObject})
  }

  async handleNewValidBlock({ validBlock, requestObject }) {
    // check if valid block is already on my chain?

    // recursively find first common ancestor block that is already on my longest chain
    const firstAncestorBlock = this.getFirstAncestorBlock({ blockchain: this.blockchain, otherBlock: validBlock })

    let chainTipBlock
    try {
      chainTipBlock = await requestObject(this.chainTip)
      this.logger('Got this chain tip block: %O', chainTipBlock)
    } catch (e) {
      this.logger('There was an error getting the chain tip block: %O', e)
      return false
    }

    // find the height of the common ancestor block
    const ancestorBlockHeight = await this.getBlockHeight({ knownHeightBlock: chainTipBlock, ancestorBlockHash: this.blockManager.getBlockHash(firstAncestorBlock), knownHeight: this.chainHeight, requestObject })

    // calculate the height of the new block
    const validBlockHeight = ancestorBlockHeight + -1 * await this.getBlockHeight({ knownHeightBlock: validBlock, ancestorBlockHash: this.blockManager.getBlockHash(firstAncestorBlock), knownHeight: 0, requestObject })

    // if (newBlockHeight > chainHeight) make new block the chain tip and change chainHeight
    // remove all blocks from the previous chain tip till the common ancestor block
    // add all blocks from the common ancestor block till the new chain tip
  }

  logger(message, ...args) {
    logger.info(`${colorizeBlockchainManager()}: ${message}`, ...args)
  }
}
