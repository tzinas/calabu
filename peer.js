import net from 'net'

export class Peer {
  handshakeCompleted = false
  socket = net.Socket
  buffer = ''

  constructor(socket) {
    this.socket = socket

    socket.on('data', data => {
      console.log('Received: ' + data)
      this.buffer += data
      const messages = this.buffer.split('\n')
      this.buffer = messages.pop()

      messages.forEach(message => {
        messageObject = JSON.parse(message)
        console.log('I have this message object: ', messageObject)

        this.handleMessage(messageObject)
      })
    })
  }

  handleMessage(message) {
    if (message.type === 'hello') {
      const helloMessage = {
        type: 'hello',
        version: '0.3.1',
        agent: 'calabu - 0.3.1'
      }

      this.socket.write(JSON.stringify(helloMessage))
      return
    }

    console.log('Disconnecting peer')
    this.socket.destroy()
  }
}
