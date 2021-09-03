import db from "./db.js"
import canonicalize from './canonicalize.js'
import sha256 from 'sha256'
import { logger, colorizeObjectManager } from './logger.js'

export class ObjectManager {
  getObjectHash(object) {
    let objectHash = canonicalize(object)
    objectHash = sha256(objectHash)

    return objectHash
  }

  async getObject(objectId) {
    let object
    try {
      object = await db.get(`object/${objectId}`)
    } catch {
      return false
    }

    object = JSON.parse(object)
    return object
  }

  async addObject(object) {
    const objectId = this.getObjectHash(object)

    if (await this.getObject(objectId)) {
      this.logger(`Object with id ${objectId} already exists and cannot be added`)
      return false
    }
    try {
      await db.put(`object/${objectId}`, JSON.stringify(object))
      this.logger(`Added object: ${objectId}`)
    } catch {
      this.logger(`Error adding object: ${objectId}`)
      return false
    }
    return true
  }

  logger(message, ...args) {
    logger.info(`${colorizeObjectManager()}: ${message}`, ...args)
  }
}
