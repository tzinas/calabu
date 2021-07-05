import { ObjectManager } from '../objects.js'
import { TransactionManager, Transaction } from '../transactions.js'
import logger from '../logger'

beforeAll(() => {
  logger.transports.forEach(transport => {
    transport.silent = true
  })
})

test('validate correct transaction', () => {
  const objectManager = new ObjectManager()
  const transactionManager = new TransactionManager(objectManager)

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
  const objectManager = new ObjectManager()
  const transactionManager = new TransactionManager(objectManager)

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


test('try creating transaction with not available balance', () => {
  const objectManager = new ObjectManager()
  const transactionManager = new TransactionManager(objectManager)

  expect(() => {
    transactionManager.createTransaction({
      keyPair: {
        publicKey: '6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5',
        privateKey: 'b8a4eb6b6cb68b833a00e691e8dc9fe70ef55374d7588aeb838ef9431ba136a46a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5'
      },
      wallet: {
        '6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5': [{
          txid: '5c532068dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d',
          index: 0
        },
        {
          txid: '92532015dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d',
          index: 4
        }]
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
  const objectManager = new ObjectManager()
  const transactionManager = new TransactionManager(objectManager)

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
    wallet: {
      '6a8291f07d35181861ac1d255e35eda3bcc6e776ddeef0c129ca396bded546c5': [{
        txid: '5c532068dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d',
        index: 0
      },
      {
        txid: '92532015dcbedde528e788eb8a36f44110162685572d5834c81b50af6d27390d',
        index: 4
      }]
    },
    UTXO,
    receiverPublicKey: 'a71a1d74e700898209f776c9f71220f8360411277f5c7b792c67a807d8aa326c',
    amount: 3000
  })

  const isValid = transactionManager.validateTransaction({ UTXO, transaction: newTransaction })
  expect(isValid).toBe(true)
})

