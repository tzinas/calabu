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

  async getFirstAncestorBlock({ blockchain, otherBlock, getObject }) {
    const otherBlockHash = this.blockManager.getBlockHash(otherBlock)
    if (blockchain.has(otherBlockHash)) {
      return otherBlock
    }

    let previousBlock
    try {
      previousBlock = await getObject(otherBlock.previd)
      this.logger('Got this previous block: %O', previousBlock)
    } catch (e) {
      this.logger('There was an error getting the previous block: %O', e)
    }

    return this.getFirstAncestorBlock({ blockchain, otherBlock: previousBlock, getObject })
  }

  async getBlockHeight({ knownHeightBlock, ancestorBlockHash, knownHeight, getObject }) {
    const knownHeightBlockHash = this.blockManager.getBlockHash(knownHeightBlock)
    if (knownHeightBlockHash === ancestorBlockHash) {
      return knownHeight
    }

    let previousBlock
    try {
      previousBlock = await getObject(knownHeightBlock.previd)
      this.logger('Got this previous block: %O', previousBlock)
    } catch (e) {
      this.logger('There was an error getting the previous block: %O', e)
      return false
    }

    return await this.getBlockHeight({ knownHeightBlock: previousBlock, ancestorBlockHash, knownHeight: knownHeight - 1, getObject})
  }

  async removeOrAddBlocksBefore({ type, fromBlock, beforeBlockHash, blockchain, getObject }) {
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
      previousBlock = await getObject(fromBlock.previd)
      this.logger('Got this previous block: %O', previousBlock)
    } catch (e) {
      this.logger('There was an error getting the previous block: %O', e)
      return false
    }

    return await this.removeOrAddBlocksBefore({ type, fromBlock: previousBlock, beforeBlockHash, blockchain: newBlockchain, getObject })
  }

  async makeNewLongestChain({ ancestorBlock, oldChainTip, newChainTip, newChainHeight, getObject }) {
    let newBlockchain = await this.removeOrAddBlocksBefore({ type: 'remove', fromBlock: oldChainTip, beforeBlockHash: this.blockManager.getBlockHash(ancestorBlock), blockchain: this.blockchain, getObject })
    newBlockchain = await this.removeOrAddBlocksBefore({ type: 'add', fromBlock: newChainTip, beforeBlockHash: this.blockManager.getBlockHash(ancestorBlock), blockchain: newBlockchain, getObject })

    this.chainHeight = newChainHeight
    this.chainTip = this.blockManager.getBlockHash(newChainTip)
    this.blockchain = newBlockchain
  }

  async handleNewValidBlock({ validBlock, getObject }) {
    // check if valid block is already on my chain?
    this.logger('Received this valid block: %O', validBlock)
    const validBlockHash = this.blockManager.getBlockHash(validBlock)
    if (this.blockchain.has(validBlockHash)) {
      this.logger('Block already in the blockchain')
      return false
    }

    // recursively find first common ancestor block that is already on my longest chain
    const firstAncestorBlock = await this.getFirstAncestorBlock({ blockchain: this.blockchain, otherBlock: validBlock, getObject })
    this.logger('Found this first common ancestor block: %O', firstAncestorBlock)

    let chainTipBlock
    try {
      chainTipBlock = await getObject(this.chainTip)
      this.logger('Got this chain tip block: %O', chainTipBlock)
    } catch (e) {
      this.logger('There was an error getting the chain tip block: %O', e)
      return false
    }

    // find the height of the common ancestor block
    const ancestorBlockHeight = await this.getBlockHeight({ knownHeightBlock: chainTipBlock, ancestorBlockHash: this.blockManager.getBlockHash(firstAncestorBlock), knownHeight: this.chainHeight, getObject })
    this.logger('The height of the first common ancestor block is: %O', ancestorBlockHeight)

    // calculate the height of the new block
    const validBlockHeight = ancestorBlockHeight + -1 * await this.getBlockHeight({ knownHeightBlock: validBlock, ancestorBlockHash: this.blockManager.getBlockHash(firstAncestorBlock), knownHeight: 0, getObject })
    this.logger(`The valid's block height is: %O`, validBlockHeight)

    if (validBlockHeight > this.chainHeight) {
      await this.makeNewLongestChain({ oldChainTip: chainTipBlock, ancestorBlock: firstAncestorBlock, newChainTip: validBlock, newChainHeight: validBlockHeight, getObject })
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
