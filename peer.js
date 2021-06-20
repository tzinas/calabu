import net from 'net'
import canonicalize from './canonicalize.js'
import db from './db.js'

export class PeerManager {
  knownPeers = {}

  async loadKnownPeers() {
    try {
      const storedPeers = JSON.parse(await db.get('knownpeers'))
      this.logger(`Fetched this peers from the db`, storedPeers)

      this.knownPeers = {}

      for (const [address, info] of Object.entries(storedPeers)) {
        const peer = new Peer()
        peer.address = info.address

        this.knownPeers[address] = peer
      }
    } catch {
      this.logger(`No stored peers`)
      db.put('knownpeers', JSON.stringify({}))
    }
  }

  addNewPeer(newPeer) {
    this.logger('Trying to add new peer', newPeer)
    if (!this.knownPeers[newPeer.address]) {
      this.knownPeers[newPeer.address] = newPeer

      this.logger('Adding new peer', newPeer)
      db.put('knownpeers', JSON.stringify(this.knownPeers))
    }
  }

  logger(message, ...args) {
    console.log(`$Calabu peer manager: ${message}`, ...args)
  }
}

export class Peer {
  address = ''
}

export class ConnectedPeer {
  handshakeCompleted = false
  socket
  buffer = ''
  agent = ''
  peerManager

  constructor(socket, peerManager) {
    this.socket = socket
    this.peerManager = peerManager
    this.logger(`Peer connected`)
    this.sendHello()

    socket.on('data', data => {
      this.buffer += data
      const messages = this.buffer.split('\n')
      this.buffer = messages.pop()

      messages.forEach(message => {
        let messageObject
        try {
          messageObject = JSON.parse(message)
        } catch {
          this.logger(`Could not parse message ${message}`)
          this.socket.destroy()
          return
        }
        this.logger('Message: ', messageObject)

        this.handleMessage(messageObject)
      })
    })

    socket.on('end', () => {
      this.logger('Peer disconnected')
    })
  }

  send(message) {
    this.socket.write(canonicalize(message) + '\n')
  }

  sendHello() {
    const helloMessage = {
      type: 'hello',
      version: '0.3.1',
      agent: 'calabu - 0.3.1'
    }

    this.logger('Sending Hello')
    this.send(helloMessage)
  }

  getPeers() {
    const getPeersMessage = {type: 'getpeers'}

    this.logger('Sending getpeers')
    this.send(getPeersMessage)
  }

  sendPeers() {
    const peersMessage = {
      type: 'peers',
      peers: Object.values(this.peerManager.knownPeers).map(info => info.address)
    }
    this.logger(`Sending this known peers`, peersMessage)
    this.send(peersMessage)
  }

  handleMessage(message) {
    if (!this.handshakeCompleted && message.type !== 'hello') {
      this.logger(`Received message of type ${message.type} before handshake`)
      this.socket.destroy()
      return
    }

    if (message.type === 'hello') {
      if (message.version !== '0.3.1') {
        this.logger(`Wrong version ${message.version}`)
        this.socket.destroy()
        return
      }

      this.logger('Handshake completed')
      this.handshakeCompleted = true
      const peer = new Peer()
      peer.address = `${this.socket.remoteAddress}:${this.socket.remotePort}`
      this.peerManager.addNewPeer(peer)
      this.getPeers()
      return
    }

    if (message.type === 'getpeers') {
      this.sendPeers()
      return
    }

    if (message.type === 'peers') {
      if (!Array.isArray(message.peers)) {
        this.logger(`Peers is not in the correct format`)
        this.socket.destroy()
        return
      }
      message.peers.forEach(address => {
        const newPeer = new Peer()
        newPeer.address = address
        this.peerManager.addNewPeer(newPeer)
      })
      return
    }

    this.logger(`Unknown message type ${message.type}`)
    this.socket.destroy()
  }

  logger(message, ...args) {
    console.log(`${this.socket.remoteAddress}:${this.socket.remotePort}: ${message}`, ...args)
  }
}
