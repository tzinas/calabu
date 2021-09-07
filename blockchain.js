export class BlockChainManager {
  chainTip
  chainHeight

  handleNewValidBlock({ block }) {
    // recursively find first common ancestor block that is already on my longest chain
    // find the height of the common ancestor block
    // calculate the height of the new block
    // if (newBlockHeight > chainHeight) make new block the chain tip and change chainHeight
    // remove all blocks from the previous chain tip till the common ancestor block
    // add all blocks from the common ancestor block till the new chain tip
  }
}
