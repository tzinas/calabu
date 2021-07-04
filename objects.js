import db from "./db.js"
import canonicalize from './canonicalize.js'
import sha256 from 'sha256'

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
      return false
    }
    await db.put(`object/${objectId}`, JSON.stringify(object))
    this.logger(`Added object with id ${objectId}`)
    return true
  }

  logger(message, ...args) {
    const now = new Date()

    console.log(`${now.toUTCString()} - $calabu_object_manager: ${message}`, ...args)
  }
}
