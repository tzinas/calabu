import net from 'net'
import canonicalize from './canonicalize.js'

export class Peer {
  handshakeCompleted = false
  socket = net.Socket
  buffer = ''
  agent = ''

  constructor(socket) {
    this.socket = socket
    this.logger(`Peer connected`)
    this.sendHello()

    socket.on('data', data => {
      this.logger('Received: ' + data)
      this.buffer += data
      const messages = this.buffer.split('\n')
      this.buffer = messages.pop()

      messages.forEach(message => {
        try {
          messageObject = JSON.parse(message)
        } catch {
          this.logger('Could not parse message')
          this.socket.destroy()
        }
        this.logger('I have this message object: ', messageObject)

        this.handleMessage(messageObject)
      })
    })

    socket.on('end', () => {
      this.logger('Peer disconnected')
    })
  }

  send(message) {
    this.socket.write(canonicalize(message))
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

  handleMessage(message) {
    if (message.type === 'hello') {
      return
    }

    this.logger('Unknown message type')
    this.socket.destroy()
  }

  logger(message) {
    console.log(`${this.socket.remoteAddress}:${this.socket.remotePort}: ${message}`)
  }
}
