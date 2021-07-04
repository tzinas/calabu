import net from 'net'
import { ConnectedPeer, PeerManager } from './peers.js'
import { ObjectManager } from './objects.js'
import { TransactionManager, Transaction } from './transactions.js'
import { start } from 'repl'

const peerManager = new PeerManager()
await peerManager.loadKnownPeers()
const objectManager = new ObjectManager()
const transactionManager = new TransactionManager(objectManager)

const server = net.createServer(socket => {
  new ConnectedPeer(socket, peerManager, objectManager)
})

server.listen(18018, '0.0.0.0')

const connectToKnownPeer = peer => {
  console.log(`Trying to connect to ${peer.address}`)
  const client = new net.Socket()

  client.on('connect', () => {
    new ConnectedPeer(client, peerManager, objectManager)
  })

  client.on('error', () => {
    const now = new Date()

    console.log(`${now.toUTCString()} - ${client.remoteAddress}:${client.remotePort}: Could not connect to peer`)
  })
  const [address, port] = peer.address.split(':')

  if (!address || isNaN(parseInt(port, 10))) {
    return
  }

  client.connect(parseInt(port, 10), address)
}

Object.values(peerManager.knownPeers).forEach(peer => {
  connectToKnownPeer(peer)
})

if (peerManager.knownPeers.length === 0) {
  const startingPeer = new Peer()
  startingPeer.address = 'keftes.di.uoa.gr:18018'
  connectToKnownPeer(startingPeer)
}
