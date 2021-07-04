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

