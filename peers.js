import canonicalize from './canonicalize.js'
import db from './db.js'

const VERSION = '0.5.0'

export class PeerManager {
  knownPeers = {}
  connectedPeers = {}

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
    if (!this.knownPeers[newPeer.address]) {
      this.knownPeers[newPeer.address] = newPeer

      this.logger('Adding new peer', newPeer)
      db.put('knownpeers', JSON.stringify(this.knownPeers))
    }
  }

  addNewConnectedPeer(peer) {
    this.connectedPeers[peer.address] = peer
  }

  broadcast(message) {
    for (const [address, peer] of Object.entries(this.connectedPeers)) {
      peer.socket.write(canonicalize(message) + '\n')
    }
  }

  logger(message, ...args) {
    const now = new Date()

    console.log(`${now.toUTCString()} - $calabu_peer_manager: ${message}`, ...args)
  }
}

export class Peer {
  address = ''
}

export class ConnectedPeer extends Peer {
  handshakeCompleted = false
  socket
  buffer = ''
  agent
  peerManager

  constructor(socket, peerManager, objectManager) {
    super()
    this.socket = socket
    this.peerManager = peerManager
    this.objectManager = objectManager
    this.address = `${this.socket.remoteAddress}:${this.socket.remotePort}`
    this.peerManager.addNewConnectedPeer(this)
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
      version: VERSION,
      agent: `tzinas/calabu/${VERSION}`
    }

    this.logger('Sending Hello')
    this.send(helloMessage)
  }

  getPeers() {
    const getPeersMessage = {type: 'getpeers'}

    this.logger('Sending getpeers')
    this.send(getPeersMessage)
  }

  sendRandomObject() {
    const objectToSend = {
      "type": "object",
      "object": {
        "type": "block",
        "txids": [
          "740bcfb434489a7e17b11bc80200cd3495e87ebf89d0dadb076bc50453590104"
        ],
        "nonce": "a26d92800cf58e88a5ecf37156c031a4147c2128beeaf1cca2785c93242a4c8b",
        "previd": "0024839ec9632d382486ba7aac7e0bda3b4bda1d4bd79be9ae78e7e1e813ddd8",
        "created": "1622825642",
        "T": "003a000000000000000000000000000000000000000000000000000000000000"
      }
    }

    this.logger(`Sending object: `, objectToSend)
    this.send(objectToSend)
  }

  async sendObject(objectId) {
    const object = await this.objectManager.getObject(objectId)

    if (!object) {
      this.logger(`The object with id ${objectId} does not exist and can't be sent.`)
      return
    }

    const objectToSend = {
      type: 'object',
      object
    }

    this.logger(`Sending object: `, objectToSend)
    this.send(objectToSend)
  }

  requestObject(objectId) {
    const requestedObject = {
      type: 'getobject',
      objectid: objectId
    }

    this.logger(`Requesting object with id ${objectId}`)
    this.send(requestedObject)
  }

  sendIHaveObject(objectId) {
    const iHaveObject = {
      type: 'ihaveobject',
      objectid: objectId
    }

    this.logger(`Advertising object with id ${objectId}`)
    this.peerManager.broadcast(iHaveObject)
  }

  async receivedObject(object) {
    const objectId = this.objectManager.getObjectHash(object)
    this.logger(`Received object with id ${objectId}`)
    if (await this.objectManager.addObject(object)) {
      this.logger(`Already have object with id ${objectId}`)
    }
  }

  async handleIHaveObject(objectId) {
    if (objectId && typeof objectId === 'string') {
      const response = await this.objectManager.getObject(objectId)
      if (response) {
        return
      }
      this.requestObject(objectId)
      return
    }

    this.logger(`Incorrect 'ihaveobject' object id ${message.objectid}`)
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
      if (message.version !== VERSION) {
        this.logger(`Wrong version ${message.version}`)
        this.socket.destroy()
        return
      }

      const peer = new Peer()
      peer.address = `${this.socket.remoteAddress}:${this.socket.remotePort}`
      this.agent = message.agent
      this.handshakeCompleted = true
      this.logger('Handshake completed')
      this.peerManager.addNewPeer(peer)
      this.getPeers()
      this.sendRandomObject()
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

    if (message.type === 'object') {
      this.receivedObject(message.object)
      return
    }

    if (message.type === 'getobject') {
      this.sendObject(message.objectid)
      return
    }

    if (message.type === 'ihaveobject') {
      this.handleIHaveObject(message.objectid)
      return
    }

    this.logger(`Unknown message type ${message.type}`)
    this.socket.destroy()
  }

  logger(message, ...args) {
    const now = new Date()
    console.log(`${now.toUTCString()} - ${this.socket.remoteAddress}:${this.socket.remotePort}${this.agent ? ` (${this.agent})`:''}): ${message}`, ...args)
  }
}
