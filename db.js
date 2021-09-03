import level from 'level'

const areWeTestingWithJest = () => {
  return process.env.JEST_WORKER_ID !== undefined;
}

let db
if (!areWeTestingWithJest()) {
  db = level('db-calabu')
}

export default db
