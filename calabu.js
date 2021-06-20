import net from 'net'
import { ConnectedPeer, PeerManager } from './peer.js'

const peerManager = new PeerManager()
await peerManager.loadKnownPeers()

const server = net.createServer(socket => {
  console.log('Peer connected')
  new ConnectedPeer(socket, peerManager)
})

server.listen(18018, '0.0.0.0')

console.log('peerManager.knownPeers', peerManager.knownPeers)
Object.values(peerManager.knownPeers).forEach(peer => {
  console.log(`Trying to connect to ${peer.address}`)
  const client = new net.Socket()

  client.on('connect', () => {
    console.log('Connected to peer')
    new ConnectedPeer(client, peerManager)
  })

  client.on('error', () => {
    console.log('Could not connect to peer')
  })
  const [address, port] = peer.address.split(':')

  client.connect(parseInt(port, 10), address)
})
