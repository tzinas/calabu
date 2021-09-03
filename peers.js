import net from 'net'

import canonicalize from './canonicalize.js'
import db from './db.js'
import { Transaction, TransactionManager } from './transactions.js'
import { Block, BlockManager } from './blocks.js'
import { logger, colorizeAddress, colorizedPeerManager } from './logger.js'
import { isNormalInteger } from './utils.js'
import { ObjectManager } from './objects.js'
import _ from 'lodash'

const VERSION = '0.5.0'

export class PeerManager {
  knownPeers = {}
  connectedPeers = {}

  async loadKnownPeers() {
    try {
      const storedPeers = JSON.parse(await db.get('knownpeers'))
      this.logger(`Fetched ${Object.keys(storedPeers).length} peers from the db`)

      this.knownPeers = {}

      for (const [address, info] of Object.entries(storedPeers)) {
        const peer = new Peer()
        peer.address = info.address

        this.knownPeers[address] = peer
      }
    } catch {
      this.logger(`No stored peers`)
      try {
        db.put('knownpeers', JSON.stringify({}))
      } catch {
        this.logger(`Error storing peers`)
      }
    }
  }

  connectToKnownPeer = peer => {
    this.logger(`Trying to connect to ${colorizeAddress(`${peer.address}`)}`)
    const client = new net.Socket()

    const [address, port] = peer.address.split(':')

    client.on('connect', () => {
      new ConnectedPeer({ socket: client, peerManager: this, objectManager: new ObjectManager, transactionManager: new TransactionManager })
    })

    client.on('error', () => {
      this.logger(`Could not connect to peer ${colorizeAddress(`${address}:${port}\x1B[39m`)}`)
    })

    if (!address || isNaN(parseInt(port, 10))) {
      return
    }

    client.connect(parseInt(port, 10), address)
  }

  addNewPeer(newPeer) {
    if (this.knownPeers[newPeer.address]) {
      return false
    }

    const [address, port] = newPeer.address.split(':')
    const isValid = address && port &&
                    address !== '127.0.0.1' &&
                    isNormalInteger(port)

    if (!isValid) {
      return false
    }

    this.knownPeers[newPeer.address] = newPeer

    try {
      db.put('knownpeers', JSON.stringify(this.knownPeers))
    } catch {
      this.logger(`Error adding peer`)
    }
    this.logger(`Added new peer ${colorizeAddress(newPeer.address)}`)

    return newPeer
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
    logger.info(`${colorizedPeerManager()}: ${message}`, ...args)
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
  transactionManager
  blockManager
  objectManager
  pendingObjectRequests = {}

  constructor({ socket, peerManager, objectManager, transactionManager }) {
    super()
    this.socket = socket
    this.peerManager = peerManager
    this.transactionManager = transactionManager
    this.objectManager = objectManager
    this.blockManager = new BlockManager
    this.address = `${this.socket.remoteAddress}:${this.socket.remotePort}`
    this.peerManager.addNewConnectedPeer(this)
    this.logger(`Peer connected`)
    this.sendHello()

    this.requestObject = this.requestObject.bind(this)
    this.addPendingObjectRequest = this.addPendingObjectRequest.bind(this)
    this.receivedObject = this.receivedObject.bind(this)

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
        this.logger('Message: %O', canonicalize(messageObject))

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

    this.logger(`Sending Hello`)
    this.send(helloMessage)
  }

  getPeers() {
    const getPeersMessage = {type: 'getpeers'}

    this.logger('Sending getpeers')
    this.send(getPeersMessage)
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

    this.logger(`Sending object: %O`, canonicalize(objectToSend))
    this.send(objectToSend)
  }

  requestObject(objectId) {
    const requestedObject = {
      type: 'getobject',
      objectid: objectId
    }

    this.logger(`Requesting object with id ${objectId}: %O`, objectId)
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

  addPendingObjectRequest({ id, resolve }) {
    if (this.pendingObjectRequests[id]) {
      return
    }

    this.pendingObjectRequests[id] = resolve
  }

  async receivedObject(object) {
    const objectId = this.objectManager.getObjectHash(object)
    this.objectManager.logger(`Received object(${object.type}) with id: ${objectId}`)

    if (await this.objectManager.getObject(objectId)) {
      this.objectManager.logger(`Already have the object(${object.type}) with id: ${objectId}`)
      //return
    }

    const resolveOfPendingObjectRequest = this.pendingObjectRequests[objectId]
    if (resolveOfPendingObjectRequest) {
      this.blockManager.logger(`Resolving request for object(${object.type}): ${objectId}`)
      if (object.type === 'transaction') {
        resolveOfPendingObjectRequest(new Transaction(object))
      }

      if (object.type === 'block') {
        resolveOfPendingObjectRequest(new Block(object))
      }

      delete this.pendingObjectRequests[objectId]

      this.objectManager.logger(`No additional checks will be made for object(${object.type}): ${objectId}`)
      return
    }


    if (object.type === 'transaction') {
      this.transactionManager.logger(`Received a transaction with id: ${objectId}`)
      const transaction = new Transaction(object)

      const isValidTransaction = this.transactionManager.validateTransaction({
        UTXO: {},
        transaction
      })

      if (isValidTransaction) {
        await this.objectManager.addObject(object)
        this.sendIHaveObject(objectId)
        return
      }

      return
    }

    if (object.type === 'block') {
      this.blockManager.logger(`Received a block with id: ${objectId}`)

      const block = new Block(object)

      const isValidBlock = await this.blockManager.validateBlock({
        block,
        requestObject: this.requestObject,
        addPendingObjectRequest: this.addPendingObjectRequest
      })
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
    this.logger(`Sending this known peers: %O`, canonicalize(peersMessage))
    this.send(peersMessage)
  }

  handleMessage(message) {
    /*
    if (!this.handshakeCompleted && message.type !== 'hello') {
      this.logger(`Received message of type ${message.type} before handshake`)
      this.socket.destroy()
      return
    }
    */

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

      if (this.peerManager.addNewPeer(peer)) {
        this.peerManager.connectToKnownPeer(peer)
      }

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
      const peersAdded = message.peers.map(address => {
        const newPeer = new Peer()
        newPeer.address = address

        if (this.peerManager.addNewPeer(newPeer)) {
          this.peerManager.connectToKnownPeer(newPeer)
          return newPeer
        }

        return false
      })
      if (_.every(peersAdded, peer => !peer)) {
        this.peerManager.logger('No new peers added')
      }

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
    logger.info(`${colorizeAddress(`${this.socket.remoteAddress}:${this.socket.remotePort}${this.agent ? ` (${this.agent})`:''}`)}: ${message}`, ...args)
  }
}
