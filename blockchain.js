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

  async handleNewValidBlock({ validBlock, requestObject }) {
    // recursively find first common ancestor block that is already on my longest chain
    const firstAncestorBlock = this.getFirstAncestorBlock({ blockchain: this.blockchain, otherBlock: validBlock })

    let chainTipBlock
    try {
      chainTipBlock = await requestObject(this.chainTip)
      this.logger('Got this chain tip block: %O', chainTipBlock)
    } catch (e) {
      this.logger('There was an error getting the chain tip block: %O', e)
    }

    // find the height of the common ancestor block
    // calculate the height of the new block
    // if (newBlockHeight > chainHeight) make new block the chain tip and change chainHeight
    // remove all blocks from the previous chain tip till the common ancestor block
    // add all blocks from the common ancestor block till the new chain tip
  }

  logger(message, ...args) {
    logger.info(`${colorizeBlockchainManager()}: ${message}`, ...args)
  }
}
