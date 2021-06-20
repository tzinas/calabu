import net from 'net'
import canonicalize from './canonicalize.js'

export class Peer {
  handshakeCompleted = false
  socket = net.Socket
  buffer = ''
  agent = ''

  constructor(socket) {
    this.socket = socket
    console.log(`Connected ${this.socket.remoteAddress}:${this.socket.remotePort}`)
    this.sendHello()

    socket.on('data', data => {
      console.log('Received: ' + data)
      this.buffer += data
      const messages = this.buffer.split('\n')
      this.buffer = messages.pop()

      messages.forEach(message => {
        try {
          messageObject = JSON.parse(message)
        } catch {
          console.log('Could not parse message, disconnecting...')
          this.socket.destroy()
        }
        console.log('I have this message object: ', messageObject)

        this.handleMessage(messageObject)
      })
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

    console.log('Sending Hello')
    this.send(helloMessage)
  }

  handleMessage(message) {
    if (message.type === 'hello') {
      return
    }

    console.log('Unknown message type, disconnecting peer')
    this.socket.destroy()
  }
}
