import request from 'supertest'
import { createApp } from '../../server/app'
import { openDatabase } from '../../server/database'
import { ACTING_USER_HEADER } from '../../shared/contracts'

const [databaseUrl, phase, input] = process.argv.slice(2)
if (!databaseUrl || !input || (phase !== 'write' && phase !== 'read')) {
  throw new Error('Expected a database URL, persistence phase, and phase input.')
}

const db = await openDatabase({ url: databaseUrl })
try {
  const app = createApp(db)
  if (phase === 'write') {
    const owner = request.agent(app).set(ACTING_USER_HEADER, 'alex')
    const created = await owner.post('/api/documents').send({ title: 'Saved document' }).expect(201)
    const id = String(created.body.id)
    const url = `/api/documents/${id}`
    await owner.patch(url).send({ content: JSON.parse(input) }).expect(200)
    await owner.post(`${url}/shares`).send({ userId: 'jamie' }).expect(201)
    process.stdout.write(id)
  } else {
    const reopened = await request(app).get(`/api/documents/${input}`).set(ACTING_USER_HEADER, 'jamie').expect(200)
    process.stdout.write(JSON.stringify(reopened.body))
  }
} finally {
  db.close()
}
