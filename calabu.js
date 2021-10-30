import net from 'net'
import { Peer, ConnectedPeer, PeerManager } from './peers.js'
import { BlockchainManager } from './blockchain.js'

const blockchainManager = new BlockchainManager()
const peerManager = new PeerManager({ blockchainManager })
await peerManager.loadKnownPeers()

const server = net.createServer(socket => {
  new ConnectedPeer({ socket, peerManager })
})

server.listen(18018, '0.0.0.0')

Object.values(peerManager.knownPeers).forEach(peer => {
  peerManager.connectToKnownPeer(peer)
})

if (Object.entries(peerManager.knownPeers).length === 0) {
  const startingPeer = new Peer()
  startingPeer.address = 'marabu.dionyziz.com:18018'
  peerManager.connectToKnownPeer(startingPeer)
}

export const { server }
