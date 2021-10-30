import _ from 'lodash'

import { BlockManager, GENESIS_BLOCK_HASH } from './blocks.js'
import { logger, colorizeBlockchainManager } from './logger.js'

export class BlockchainManager {
  chainTip = GENESIS_BLOCK_HASH
  chainHeight = 1
  blockchain = new Set([GENESIS_BLOCK_HASH])
  blockManager = new BlockManager()

  async isBlockInMyBlockchain({ blockId }) {
    return this.blockchain.has(blockId)
  }

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

    return this.getFirstAncestorBlock({ blockchain, otherBlock: previousBlock, requestObject })
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

  async removeOrAddBlocksBefore({ type, fromBlock, beforeBlockHash, blockchain, requestObject }) {
    const newBlockchain = _.cloneDeep(blockchain)
    const fromBlockHash = this.blockManager.getBlockHash(fromBlock)

    if (fromBlockHash === beforeBlockHash) {
      return newBlockchain
    }

    if (type === 'add') {
      newBlockchain.add(fromBlockHash)
    } else if (type === 'remove') {
      newBlockchain.delete(fromBlockHash)
    }

    let previousBlock
    try {
      previousBlock = await requestObject(fromBlock.previd)
      this.logger('Got this previous block: %O', previousBlock)
    } catch (e) {
      this.logger('There was an error getting the previous block: %O', e)
      return false
    }

    return await this.removeOrAddBlocksBefore({ type, fromBlock: previousBlock, beforeBlockHash, blockchain: newBlockchain, requestObject })
  }

  async makeNewLongestChain({ ancestorBlock, oldChainTip, newChainTip, newChainHeight, requestObject }) {
    let newBlockchain = await this.removeOrAddBlocksBefore({ type: 'remove', fromBlock: oldChainTip, beforeBlockHash: this.blockManager.getBlockHash(ancestorBlock), blockchain: this.blockchain, requestObject })
    newBlockchain = await this.removeOrAddBlocksBefore({ type: 'add', fromBlock: newChainTip, beforeBlockHash: this.blockManager.getBlockHash(ancestorBlock), blockchain: newBlockchain, requestObject })

    this.chainHeight = newChainHeight
    this.chainTip = this.blockManager.getBlockHash(newChainTip)
    this.blockchain = newBlockchain
  }

  async handleNewValidBlock({ validBlock, requestObject }) {
    // check if valid block is already on my chain?
    this.logger('Received this valid block: %O', validBlock)
    const validBlockHash = this.blockManager.getBlockHash(validBlock)
    if (this.blockchain.has(validBlockHash)) {
      this.logger('Block already in the blockchain')
      return false
    }

    // recursively find first common ancestor block that is already on my longest chain
    const firstAncestorBlock = await this.getFirstAncestorBlock({ blockchain: this.blockchain, otherBlock: validBlock, requestObject })
    this.logger('Found this first common ancestor block: %O', firstAncestorBlock)

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
    this.logger('The height of the first common ancestor block is: %O', ancestorBlockHeight)

    // calculate the height of the new block
    const validBlockHeight = ancestorBlockHeight + -1 * await this.getBlockHeight({ knownHeightBlock: validBlock, ancestorBlockHash: this.blockManager.getBlockHash(firstAncestorBlock), knownHeight: 0, requestObject })
    this.logger(`The valid's block height is: %O`, validBlockHeight)

    if (validBlockHeight > this.chainHeight) {
      await this.makeNewLongestChain({ oldChainTip: chainTipBlock, ancestorBlock: firstAncestorBlock, newChainTip: validBlock, newChainHeight: validBlockHeight, requestObject })
    }
    this.logger(`The new chain tip is: %O`, this.chainTip)
    this.logger(`The new chain height is: %O`, this.chainHeight)
    this.logger(`The new blockchain is: %O`, this.blockchain)
    return true
  }

  logger(message, ...args) {
    logger.info(`${colorizeBlockchainManager()}: ${message}`, ...args)
  }
}
