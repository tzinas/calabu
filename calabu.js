import net from 'net'
import { Peer } from './peer.js'

const server = net.createServer(socket => {
  console.log('Peer connected')
  const peer = new Peer(socket)

  socket.on('end', () => {
    console.log('Peer disconnected')
  })
})

server.listen(18018, '0.0.0.0')

const client = new net.Socket()

client.on('connect', () => {
  console.log('Connected to peer')
  const peer = new Peer(client)
})

client.on('error', () => {
  console.log('could not connect to peer')
})

client.connect(18018, 'tzinas.ddns.net')
