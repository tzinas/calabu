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

const connectToKnownPeer = peer => {
  logger.info(`Trying to connect to ${colorizeAddress(`${peer.address}`)}`)
  const client = new net.Socket()

  const [address, port] = peer.address.split(':')

  client.on('connect', () => {
    new ConnectedPeer({ socket: client, peerManager, objectManager, transactionManager })
  })

  client.on('error', () => {
    logger.debug(`Could not connect to peer ${colorizeAddress(`${address}:${port}\x1B[39m`)}`)
  })

  if (!address || isNaN(parseInt(port, 10))) {
    return
  }

  client.connect(parseInt(port, 10), address)
}

Object.values(peerManager.knownPeers).forEach(peer => {
  connectToKnownPeer(peer)
})

if (Object.entries(peerManager.knownPeers).length === 0) {
  const startingPeer = new Peer()
  startingPeer.address = 'keftes.di.uoa.gr:18018'
  connectToKnownPeer(startingPeer)
}
