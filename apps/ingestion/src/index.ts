import 'dotenv/config'
import express from 'express'
import { env } from './config/env'
import healthRouter from './http/routes/health'

const app = express()
app.use(express.json())
app.use(healthRouter)

app.listen(env.PORT, () => {
  console.log(`Ingestion service running on port ${env.PORT}`)
})
