import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createApp } from './app'
import { openDatabase } from './database'

async function start() {
  if (existsSync('.env')) process.loadEnvFile()
  const port = Number(process.env.PORT || 3001)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.')
  }

  const staticDirectory = process.argv.includes('--production') ? resolve('dist') : undefined
  if (staticDirectory && !existsSync(resolve(staticDirectory, 'index.html'))) {
    throw new Error('Run npm run build before npm start.')
  }

  const db = await openDatabase()
  const server = createApp(db, staticDirectory).listen(port, '127.0.0.1', () => {
    console.log(`Workspace ${staticDirectory ? 'app' : 'API'} listening at http://127.0.0.1:${port}`)
  })
  server.once('error', (error) => {
    db.close()
    console.error(error)
    process.exitCode = 1
  })
}

start().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
