import net from 'net'
import { Peer, ConnectedPeer, PeerManager } from './peers.js'
import { BlockchainManager } from './blockchain.js'
//import { MiningManager } from './miningManager.js'

const blockchainManager = new BlockchainManager()
const peerManager = new PeerManager({ blockchainManager })
//const miningManager = new MiningManager({ blockchainManager, peerManager })
//miningManager.minerSetUp()
//new Promise (async () => miningManager.mine())

await peerManager.loadKnownPeers()
//console.log(peerManager.knownPeers)

const server = net.createServer(socket => {
  new ConnectedPeer({ socket, peerManager })
})

server.listen(18018, '0.0.0.0')

Object.values(peerManager.knownPeers).forEach(peer => {
  peerManager.connectToPeer(peer)
})

if (Object.entries(peerManager.knownPeers).length === 0) {
  const startingPeer = new Peer()
  startingPeer.address = '149.28.220.241:18018'
  peerManager.connectToPeer(startingPeer)
}
