const net = require('net')

const server = net.createServer(socket => {
  console.log('Peer connected')
	socket.pipe(socket)

  socket.on('end', () => {
    console.log('Peer disconnected');
  })
})

server.listen(18018, '127.0.0.1')

const client = new net.Socket()

client.on('connect', () => {
  console.log('connected to peer')
  client.write("{ type: 'hello', version: '0.3.1', agent: 'Calabu' }" + '\n')
})

client.on('error', () => {
  console.log('could not connect to peer')
})

client.on('data', data => {
	console.log('Received: ' + data);
});

client.connect(18018, 'keftes.di.uoa.gr')
