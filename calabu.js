import net from 'net'
import { ConnectedPeer, PeerManager } from './peers.js'
import { ObjectManager } from './objects.js'

const peerManager = new PeerManager()
await peerManager.loadKnownPeers()
const objectManager = new ObjectManager()

const server = net.createServer(socket => {
  new ConnectedPeer(socket, peerManager, objectManager)
})

server.listen(18018, '0.0.0.0')

Object.values(peerManager.knownPeers).forEach(peer => {
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

  client.connect(parseInt(port, 10), address)
})
