import net from 'net'
import { Peer, ConnectedPeer, PeerManager } from './peers.js'
import { ObjectManager } from './objects.js'
import { TransactionManager, Transaction } from './transactions.js'
import { logger, colorizeAddress } from './logger.js'

const peerManager = new PeerManager()
await peerManager.loadKnownPeers()
const objectManager = new ObjectManager()
const transactionManager = new TransactionManager(objectManager)

const server = net.createServer(socket => {
  new ConnectedPeer({ socket, peerManager, objectManager, transactionManager })
})

server.listen(18018, '0.0.0.0')


Object.values(peerManager.knownPeers).forEach(peer => {
  peerManager.connectToKnownPeer(peer)
})

if (Object.entries(peerManager.knownPeers).length === 0) {
  const startingPeer = new Peer()
  startingPeer.address = 'keftes.di.uoa.gr:18018'
  peerManager.connectToKnownPeer(startingPeer)
}
