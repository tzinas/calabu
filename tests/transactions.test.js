import { TransactionManager, Transaction } from '../transactions.js'
import { logger } from '../logger'

beforeAll(() => {
  logger.transports.forEach(transport => {
    transport.silent = true
  })
})

test('validate correct transaction', () => {
  const transactionManager = new TransactionManager()

  const transaction = new Transaction({
    type: "transaction", 
    inputs: [{
      outpoint: {
        txid: "5c532068dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d",
        index: 0
      },
      sig: "aed4d1f13933e195f68add86915c099366f7d198602afb13551df5575dc57013b83d84f70b310e28c72b0c143d8fab6ce2fc38a7f88d466d1ccc88a4b2970809"}
    ],
    outputs: [{
      pubkey: "77bd8ef0bf4d9423f3681b01f8b5b4cfdf0ee69fb356a7762589f1b65cdcab63",
      value: 10
    }]
  })
  
  
  const isValid = transactionManager.validateTransaction({
    UTXO: {
      '5c532068dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d': {
        0: {
          pubkey: "77bd8ef0bf4d9423f3681b01f8b5b4cfdf0ee69fb356a7762589f1b65cdcab63",
          value: 50000000000
        }
      }
    },
    transaction
  })

  expect(isValid).toBe(true)
})

test('validate wrong transaction', () => {
  const transactionManager = new TransactionManager()

  const transaction = new Transaction({
    type: "transaction", 
    inputs: [{
      outpoint: {
        txid: "5c532068dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d",
        index: 0
      },
      sig: "aed4d1f13934e195f68add86915c099366f7d198602afb13551df5575dc57013b83d84f70b310e28c72b0c143d8fab6ce2fc38a7f88d466d1ccc88a4b2970809"}
    ],
    outputs: [{
      pubkey: "77bd8ef0bf4d9423f3681b01f8b5b4cfdf0ee69fb356a7762589f1b65cdcab63",
      value: 10
    }]
  })
  
  
  const isValid = transactionManager.validateTransaction({
    UTXO: {
      '5c532068dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d': {
        0: {
          pubkey: "77bd8ef0bf4d9423f3681b01f8b5b4cfdf0ee69fb356a7762589f1b65cdcab63",
          value: 50000000000
        }
      }
    },
    transaction
  })

  expect(isValid).toBe(false)
})

test('check transaction wrong conservation', () => {
  const transactionManager = new TransactionManager()

  const transaction = new Transaction({
    type: "transaction",
    inputs: [{
      outpoint: {
        txid: "5c532068dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d",
        index: 0
      },
      sig: "aed4d1f13933e195f68add86915c099366f7d198602afb13551df5575dc57013b83d84f70b310e28c72b0c143d8fab6ce2fc38a7f88d466d1ccc88a4b2970809"}
    ],
    outputs: [{
      pubkey: "77bd8ef0bf4d9423f3681b01f8b5b4cfdf0ee69fb356a7762589f1b65cdcab63",
      value: 10
    }]
  })

  const isValid = transactionManager.validateTransaction({
    UTXO: {
      '5c532068dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d': {
        0: {
          pubkey: "77bd8ef0bf4d9423f3681b01f8b5b4cfdf0ee69fb356a7762589f1b65cdcab63",
          value: 3
        }
      }
    },
    transaction
  })

  expect(isValid).toBe(false)
})


test('try creating transaction with not available balance', () => {
  const transactionManager = new TransactionManager()

  expect(() => {
    transactionManager.createTransaction({
      keyPair: {
        publicKey: '6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5',
        privateKey: 'b8a4eb6b6cb68b833a00e691e8dc9fe70ef55374d7588aeb838ef9431ba136a46a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5'
      },
      UTXO: {
        '5c532068dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d':
        {
          0: {
            publicKey: '6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5',
            value: 4999
          }
        },
        '92532015dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d':
        {
          4: {
            publicKey: '6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5',
            value: 4
          }
        }
      },
      receiverPublicKey: 'a71a1d74e700898209f776c9f71220f8360411277f5c7b792c67a807d8aa326c',
      amount: 7000
    })
  }).toThrow('not-enough-balance')
})

test('create transaction and validate', () => {
  const transactionManager = new TransactionManager()

  const UTXO = {
    '5c532068dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d':
    {
      0: {
        pubkey: '6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5',
        value: 4999
      }
    },
    '92532015dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d':
    {
      4: {
        pubkey: '6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5',
        value: 4
      }
    }
  }

  const newTransaction = transactionManager.createTransaction({
    keyPair: {
      publicKey: '6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5',
      privateKey: 'b8a4eb6b6cb68b833a00e691e8dc9fe70ef55374d7588aeb838ef9431ba136a46a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5'
    },
    UTXO,
    receiverPublicKey: 'a71a1d74e700898209f776c9f71220f8360411277f5c7b792c67a807d8aa326c',
    amount: 3000
  })

  const isValid = transactionManager.validateTransaction({ UTXO, transaction: newTransaction })
  expect(isValid).toBe(true)
})

test('validate correct coinbase transaction', () => {
  const transactionManager = new TransactionManager()

  const coinbaseTransaction = new Transaction({
    type: "transaction",
    outputs: [{
      pubkey: "77bd8ef0bf4d9423f3681b01f8b5b4cfdf0ee69fb356a7762589f1b65cdcab63",
      value: 10
    }]
  })

  const isValid = transactionManager.validateCoinbaseTransaction({ coinbaseTransaction, normalTransactions: [], UTXO: {} })
  expect(isValid).toBe(true)
})

test('validate wrong coinbase transaction', () => {
  const transactionManager = new TransactionManager()

  const wrongCoinbaseTransaction = new Transaction({
    type: "transaction",
    outputs: [{
      pubkey: "77bd8ef0bf4d9423f3681b01f8b5b4cfdf0ee69fb356a7762589f1b65cdcab63",
      value: 10
    },
    {
      pubkey: "59bd8ef0bf4d9423f3681b01f8b5b4cfdf0ee69fb356a7762589f1b65cdcab63",
      value: 16
    }]
  })

  const isValid = transactionManager.validateCoinbaseTransaction({ coinbaseTransaction: wrongCoinbaseTransaction, normalTransactions: [], UTXO: {} })
  expect(isValid).toBe(false)
})

test('get new UTXO with transaction', () => {
  const transactionManager = new TransactionManager()

  const UTXO = {
    '5c532068dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d':
    {
      0: {
        pubkey: '6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5',
        value: 4999
      }
    },
    '92532015dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d':
    {
      4: {
        pubkey: '6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5',
        value: 4
      }
    }
  }


  const firstTransaction = new Transaction({
    type: "transaction",
    inputs: [
      {
        outpoint: {
          txid: "5c532068dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d",
          index: 0
        },
        sig: "a8c14e1372bbf978641fbf1c5d7dc97a979ac79ea1ac2b02f9e6ea21d61afec3e6d9f1c576745787b1e617b4776f2da812de0895dda3bffdef179c3ff9dd070a"
      },
      {
        outpoint: {
          txid: "92532015dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d",
          index: 4
        },
        sig: "a8c14e1372bbf978641fbf1c5d7dc97a979ac79ea1ac2b02f9e6ea21d61afec3e6d9f1c576745787b1e617b4776f2da812de0895dda3bffdef179c3ff9dd070a"
      }
    ],
    outputs:[
      {
        pubkey: "a71a1d74e700898209f776c9f71220f8360411277f5c7b792c67a807d8aa326c",
        value: 3000
      },
      {
        pubkey: "6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5",
        value: 2003
      }
    ]
  })

  const secondTransaction = new Transaction({
    type: "transaction",
    inputs: [
      {
        outpoint: {
          txid: "1b8e10df02ed41f6453e743024e1b82b8a5558b019020497ca8701d9069dc427",
          index: 1
        },
        sig: "fc4ec8f9d0ecc7fb4b891d255ef67109d3030047954cb78c2607cf1a4a1cffd62e1f9731c8a09c106c39d14299bc340dbb45ca39bad57572cfa774d144916409"
      }
    ],
    outputs:[
      {
        pubkey: "22222274e700898209f776c9f71220f8360411277f5c7b792c67a807d8aa326c",
        value: 2000
      },
      {
        pubkey: "6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5",
        value: 3
      }
    ]
  })


  let newUTXO = transactionManager.getNewUTXO({ transaction: firstTransaction, UTXO })
  newUTXO = transactionManager.getNewUTXO({ transaction: secondTransaction, UTXO: newUTXO })

  const expectedUTXO = {
    '1b8e10df02ed41f6453e743024e1b82b8a5558b019020497ca8701d9069dc427': {
      '0': {
        pubkey: 'a71a1d74e700898209f776c9f71220f8360411277f5c7b792c67a807d8aa326c',
        value: 3000
      }
    },
    'ce2d0f368c2415a97583c5b62d225a5cd2e936ef61a154016c70707886168695': {
      '0': {
        pubkey: '22222274e700898209f776c9f71220f8360411277f5c7b792c67a807d8aa326c',
        value: 2000
      },
      '1': {
        pubkey: '6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5',
        value: 3
      }
    }
  }

  expect(JSON.stringify(newUTXO)).toBe(JSON.stringify(expectedUTXO))
})

test('get new UTXO with coinbase transaction', () => {
  const transactionManager = new TransactionManager()

  const UTXO = {
    '5c532068dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d':
    {
      0: {
        pubkey: '6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5',
        value: 4999
      }
    },
    '92532015dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d':
    {
      4: {
        pubkey: '6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5',
        value: 4
      }
    }
  }


  const coinbaseTransaction = new Transaction({
    type: "transaction",
    outputs: [{
      pubkey: "77bd8ef0bf4d9423f3681b01f8b5b4cfdf0ee69fb356a7762589f1b65cdcab63",
      value: 10
    }]
  })


  const newUTXO = transactionManager.getNewUTXO({ transaction: coinbaseTransaction, UTXO })
  const expectedUTXO = {
    ...UTXO,
    'fc492e0cd9ac3850c74939f7d06b4734b24d6f1f172e04dd9e2819bc4dad5965': {
      '0': {
        pubkey: '77bd8ef0bf4d9423f3681b01f8b5b4cfdf0ee69fb356a7762589f1b65cdcab63',
        value: 10
      }
    }
  }

  expect(JSON.stringify(newUTXO)).toBe(JSON.stringify(expectedUTXO))
})
